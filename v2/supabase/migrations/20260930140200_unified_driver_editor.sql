-- One scoped editor transaction; no historical results, identities or XP are rewritten.
create function league_roster_private.driver_editor(p_driver_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lid uuid := private.roster_admin_league(); d public.drivers%rowtype; tags jsonb; state jsonb;
begin
  if p_driver_id is null then return jsonb_build_object('driver',null,'gamertags',jsonb_build_object('main',null,'aliases','[]'::jsonb),'revision','new'); end if;
  select * into d from public.drivers where id=p_driver_id and league_id=lid;
  if d.id is null then raise exception using errcode='42501',message='Fahrer gehört nicht zu dieser Liga.'; end if;
  if private.result_participation_status(d.ai_driver_reference,null)='PLAYER' then
    tags := profile_private.get_gamertags(d.id);
  else
    tags := jsonb_build_object('main',d.gamertag,'aliases','[]'::jsonb);
  end if;
  state := jsonb_build_object('driver',to_jsonb(d),'gamertags',tags);
  return state || jsonb_build_object('revision',md5(state::text));
end; $$;

-- A shared gamertag may genuinely be used on several gaming platforms.
drop index public.driver_aliases_driver_normalized_unique;
create unique index driver_aliases_driver_normalized_unique on public.driver_aliases(driver_id,normalized_alias,platform) where driver_id is not null;

create function league_roster_private.save_driver_editor(p_driver_id uuid,p_profile jsonb,p_aliases jsonb,
  p_ai_driver_id uuid,p_round integer,p_revision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lid uuid := private.roster_admin_league(); d public.drivers%rowtype; ai public.drivers%rowtype;
  sid uuid; saved jsonb; item jsonb; keep_ids uuid[] := '{}'; alias_id uuid; team text; seat public.season_driver_assignments%rowtype;
begin
  perform 1 from public.leagues where id=lid for update;
  select id into sid from public.seasons where league_id=lid and is_active order by created_at desc limit 1 for update;
  if p_driver_id is not null then
    select * into d from public.drivers where id=p_driver_id and league_id=lid for update;
    if d.id is null then raise exception using errcode='42501',message='Fahrer gehört nicht zu dieser Liga.'; end if;
  end if;
  if p_revision is distinct from (league_roster_private.driver_editor(p_driver_id)->>'revision') then
    raise exception using errcode='40001',message='DRIVER_EDITOR_STALE';
  end if;
  if p_profile is null or jsonb_typeof(p_profile)<>'object' or p_profile ? 'number' then
    raise exception using errcode='22023',message='Die Startnummer wird nicht manuell bearbeitet.';
  end if;
  if p_aliases is null or jsonb_typeof(p_aliases)<>'array' or jsonb_array_length(p_aliases)>20 then
    raise exception using errcode='22023',message='Höchstens 20 Gamertags sind erlaubt.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_aliases) a where jsonb_typeof(a)<>'object'
    or a->>'alias' is null or char_length(btrim(a->>'alias')) not between 2 and 60 or a->>'alias' ~ '[<>[:cntrl:]]'
    or a->>'platform' is null or a->>'platform' not in ('ea','playstation','steam','xbox','other')) then
    raise exception using errcode='22023',message='Prüfe die Gamertags und ihre Plattformen.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_aliases) a group by lower(btrim(a->>'alias')),a->>'platform' having count(*)>1) then
    raise exception using errcode='22023',message='Ein Gamertag ist für dieselbe Plattform doppelt eingetragen.';
  end if;
  saved := public.upsert_league_driver(p_profile->>'display_name',p_driver_id,p_profile->>'gamertag',d.number,
    p_profile->>'nationality_code',d.league_team,d.car_name,coalesce((p_profile->>'is_active')::boolean,true));
  select * into d from public.drivers where id=(saved->>'id')::uuid;
  -- Only aliases scoped to this league driver can be changed. Personal account aliases remain untouched.
  for item in select value from jsonb_array_elements(p_aliases) loop
    insert into public.driver_aliases(driver_id,alias,alias_type,platform)
      values(d.id,btrim(item->>'alias'),'gamertag',item->>'platform')
      on conflict(driver_id,normalized_alias,platform) where driver_id is not null do update set alias=excluded.alias
      returning id into alias_id;
    keep_ids := array_append(keep_ids,alias_id);
  end loop;
  delete from public.driver_aliases where driver_id=d.id and not(id=any(keep_ids));
  if p_ai_driver_id is not null then
    if sid is null then raise exception using errcode='22023',message='Bitte zuerst eine Saison einrichten.'; end if;
    if not d.is_active then raise exception using errcode='22023',message='Aktiviere den Fahrer vor der KI-Zuordnung.'; end if;
    select a.* into ai from public.drivers a join public.seasons s on s.id=sid
      where a.id=p_ai_driver_id and a.league_id=lid and a.ai_driver_reference like s.game_key||':%';
    if ai.id is null then raise exception using errcode='22023',message='Der KI-Fahrer gehört nicht zum Spiel dieser Saison.'; end if;
    select v.team_name into team from private.season_vehicle_assignments v
      where v.season_id=sid and v.driver_id=d.id and v.effective_from_round<=p_round order by v.effective_from_round desc limit 1;
    if team is null then select t.name into team from league_roster_private.driver_teams dt
      join league_roster_private.teams t on t.id=dt.team_id where dt.driver_id=d.id; end if;
    team := coalesce(team,d.league_team,ai.league_team);
    -- Retain existing effective-date, occupied-seat and locked-result checks, and preserve the independent league team.
    perform public.change_season_vehicle(d.id,p_round,team,ai.car_name,ai.id);
    if p_round=1 then
      -- Before any race is run the initial grid must reflect the chosen human, not the displaced AI.
      select * into seat from public.season_driver_assignments where season_id=sid and seat_code=split_part(ai.ai_driver_reference,':',2);
      if seat.id is null then raise exception using errcode='22023',message='Der KI-Sitz fehlt im Starterfeld.'; end if;
      update public.season_driver_assignments a set driver_id=bot.id,participant_type='BOT',gamertag_snapshot=null,
        team_name=bot.league_team,car_name=bot.car_name
        from public.drivers bot join public.seasons s on s.id=sid
        where a.season_id=sid and a.driver_id=d.id and a.id<>seat.id
          and bot.league_id=lid and bot.ai_driver_reference=s.game_key||':'||a.seat_code;
      update public.season_driver_assignments set driver_id=d.id,participant_type='PLAYER',gamertag_snapshot=d.gamertag,
        team_name=team,car_name=ai.car_name where id=seat.id;
      -- Start number is derived from the game seat, never supplied by the editor.
      update public.drivers set number=seat.number where id=d.id;
    end if;
  elsif p_round is not null then raise exception using errcode='22023',message='Wähle einen KI-Fahrer für die Zuordnung.';
  end if;
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata)
    values('league',lid,auth.uid(),'driver.editor_saved','driver',d.id,jsonb_build_object('alias_count',jsonb_array_length(p_aliases),'ai_driver_id',p_ai_driver_id,'effective_from_round',p_round));
  return league_roster_private.driver_editor(d.id);
end; $$;

create function league_roster_private.start_without_assignments(p_name text,p_slug text,p_game_key text,
  p_start_date date,p_calendar jsonb,p_fastest_lap_bonus_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lid uuid := private.roster_admin_league(); active_humans uuid[]; result jsonb;
begin
  perform 1 from public.leagues where id=lid for update;
  select array_agg(id) into active_humans from public.drivers where league_id=lid and is_active
    and private.result_participation_status(ai_driver_reference,null)='PLAYER';
  result := league_roster_private.start_from_profiles(p_name,p_slug,p_game_key,p_start_date,'[]',p_calendar,p_fastest_lap_bonus_enabled);
  -- Preserve directory eligibility, without assigning a single human to the new season grid.
  update public.drivers set is_active=true where id=any(active_humans);
  return result;
end; $$;

create function public.get_league_driver_editor(p_driver_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select league_roster_private.driver_editor(p_driver_id); $$;
create function public.save_league_driver_editor(p_driver_id uuid,p_profile jsonb,p_aliases jsonb,p_ai_driver_id uuid,p_round integer,p_revision text) returns jsonb
language sql security invoker set search_path='' as $$ select league_roster_private.save_driver_editor(p_driver_id,p_profile,p_aliases,p_ai_driver_id,p_round,p_revision); $$;
create function public.start_league_season_setup(p_name text,p_slug text,p_game_key text,p_start_date date,p_calendar jsonb,p_fastest_lap_bonus_enabled boolean) returns jsonb
language sql security invoker set search_path='' as $$ select league_roster_private.start_without_assignments(p_name,p_slug,p_game_key,p_start_date,p_calendar,p_fastest_lap_bonus_enabled); $$;
revoke all on function league_roster_private.driver_editor(uuid),league_roster_private.save_driver_editor(uuid,jsonb,jsonb,uuid,integer,text),league_roster_private.start_without_assignments(text,text,text,date,jsonb,boolean),public.get_league_driver_editor(uuid),public.save_league_driver_editor(uuid,jsonb,jsonb,uuid,integer,text),public.start_league_season_setup(text,text,text,date,jsonb,boolean) from public,anon,authenticated;
grant execute on function league_roster_private.driver_editor(uuid),league_roster_private.save_driver_editor(uuid,jsonb,jsonb,uuid,integer,text),league_roster_private.start_without_assignments(text,text,text,date,jsonb,boolean),public.get_league_driver_editor(uuid),public.save_league_driver_editor(uuid,jsonb,jsonb,uuid,integer,text),public.start_league_season_setup(text,text,text,date,jsonb,boolean) to authenticated;
