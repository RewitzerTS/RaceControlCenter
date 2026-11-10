begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.races add column annulled_at timestamptz;
alter table public.races add constraint races_annulled_status_check check(annulled_at is null or status='cancelled');

create table private.race_annulments (
  race_id uuid primary key references public.races(id) on delete restrict,
  result_version_id uuid references public.result_versions(id) on delete restrict,
  actor_id uuid not null,
  reason text not null check(char_length(btrim(reason)) between 3 and 500),
  annulled_at timestamptz not null default now()
);
alter table private.race_annulments enable row level security;
revoke all on private.race_annulments from public,anon,authenticated,service_role;
create trigger race_annulments_immutable before update or delete on private.race_annulments
for each row execute function private.protect_steward_history();

create function private.annul_league_race(p_race_id uuid,p_expected_version_id uuid,
  p_expected_updated_at timestamptz,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  lid uuid:=private.roster_admin_league(); race public.races%rowtype;
  event_id uuid; processing jsonb;
begin
  perform 1 from public.leagues where id=lid for update;
  select r.* into race from public.races r join public.seasons s on s.id=r.season_id
    where r.id=p_race_id and s.league_id=lid and s.is_active for update of r;
  if not found then raise exception using errcode='42501',message='ANNUL_ACCESS_DENIED'; end if;
  if exists(select 1 from private.race_annulments where race_id=p_race_id) then
    return jsonb_build_object('raceId',p_race_id,'status','cancelled','alreadyAnnulled',true);
  end if;
  if p_expected_updated_at is null or race.updated_at is distinct from p_expected_updated_at
    or race.current_result_version_id is distinct from p_expected_version_id then
    raise exception using errcode='40001',message='ANNUL_STALE';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then
    raise exception using errcode='22023',message='ANNUL_REASON_REQUIRED';
  end if;
  if race.current_result_version_id is not null then
    perform private.void_current_result_version(p_race_id,btrim(p_reason));
    select id into event_id from public.domain_events
      where result_version_id=race.current_result_version_id and event_type='result.voided';
    if event_id is null then raise exception 'ANNUL_EVENT_MISSING'; end if;
  end if;
  -- Keep imports as audit evidence, but never offer them for publication again.
  insert into private.result_draft_discards(result_version_id,actor_id)
    select id,auth.uid() from public.result_versions
    where race_id=p_race_id and status in ('draft','validated')
    on conflict do nothing;
  insert into private.race_annulments(race_id,result_version_id,actor_id,reason)
    values(p_race_id,race.current_result_version_id,auth.uid(),btrim(p_reason));
  -- Deliberately touch no calendar dates, rounds, other races or seat assignments.
  update public.races set status='cancelled',current_result_version_id=null,annulled_at=now() where id=p_race_id;
  if event_id is not null then
    processing:=private.process_domain_event_queue(1,event_id);
    if exists(select 1 from private.domain_event_processing where domain_event_processing.event_id=annul_league_race.event_id and status<>'succeeded') then
      raise exception 'ANNUL_RECALCULATION_FAILED';
    end if;
  end if;
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata)
    values('league',lid,auth.uid(),'race.annulled','race',p_race_id,
      jsonb_build_object('reason',btrim(p_reason),'result_version_id',race.current_result_version_id,'processing',processing));
  return jsonb_build_object('raceId',p_race_id,'status','cancelled','alreadyAnnulled',false);
end $$;
revoke all on function private.annul_league_race(uuid,uuid,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function private.annul_league_race(uuid,uuid,timestamptz,text) to authenticated;
create function public.annul_league_race(p_race_id uuid,p_expected_version_id uuid,p_expected_updated_at timestamptz,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$
  select private.annul_league_race(p_race_id,p_expected_version_id,p_expected_updated_at,p_reason);
$$;
revoke all on function public.annul_league_race(uuid,uuid,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function public.annul_league_race(uuid,uuid,timestamptz,text) to authenticated;

create function private.guard_annulled_race() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='races' then
    if exists(select 1 from private.race_annulments where race_id=new.id)
      and (new.status<>'cancelled' or new.current_result_version_id is not null) then
      raise exception using errcode='22023',message='RACE_ANNULLED';
    end if;
  elsif exists(select 1 from private.race_annulments where race_id=new.race_id)
    and new.status in ('draft','validated','active') then
    raise exception using errcode='22023',message='RACE_ANNULLED';
  end if;
  return new;
end $$;
revoke all on function private.guard_annulled_race() from public,anon,authenticated,service_role;
create trigger guard_annulled_race before update on public.races
  for each row execute function private.guard_annulled_race();
create trigger guard_annulled_result before insert or update on public.result_versions
  for each row execute function private.guard_annulled_race();

do $$ declare body text; marker text; begin
  body:=pg_get_functiondef('public.publish_league_result_draft(uuid)'::regprocedure);
  marker:='v_target_race_id:=race.id;';
  if strpos(body,marker)=0 then raise exception 'Publication guard anchor missing'; end if;
  execute replace(body,marker,marker||E'\n  if exists(select 1 from private.race_annulments where race_id=race.id) then raise exception ''RACE_ANNULLED''; end if;');
  body:=pg_get_functiondef('public.get_result_draft_championship_preview(uuid)'::regprocedure);
  marker:='if source.status<>''validated''';
  if strpos(body,marker)=0 then raise exception 'Preview guard anchor missing'; end if;
  execute replace(body,marker,E'if race.status=''cancelled'' then raise exception ''PREVIEW_DRAFT_STALE''; end if;\n  '||marker);
  body:=pg_get_functiondef('public.get_league_race_admin_workspace()'::regprocedure);
  marker:='''status'', r.status, ''has_sprint'', r.has_sprint,';
  if strpos(body,marker)=0 then raise exception 'Race workspace anchor missing'; end if;
  execute replace(body,marker,marker||E'\n        ''updated_at'',r.updated_at,''current_result_version_id'',r.current_result_version_id,\n        ''annulment'',(select jsonb_build_object(''reason'',a.reason,''annulled_at'',a.annulled_at) from private.race_annulments a where a.race_id=r.id),');
end $$;

create function private.reverse_grid_workspace(p_include_drafts boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare lid uuid:=private.roster_admin_league(); season public.seasons%rowtype;
  view_round integer; source record; rows jsonb; drafts jsonb:='[]';
begin
  select * into season from public.seasons where league_id=lid and is_active order by created_at desc limit 1;
  if not found then return jsonb_build_object('data',null,'seats','[]'::jsonb,'drafts','[]'::jsonb,'generatedAt',statement_timestamp()); end if;
  select coalesce(min(round_number) filter(where status='upcoming'),max(round_number),1)
    into view_round from public.races where season_id=season.id;
  if p_include_drafts then
    for source in
      select distinct on (r.id) v.*,r.grand_prix_name,r.round_number,r.current_result_version_id
      from public.races r join public.result_versions v on v.race_id=r.id
      left join public.result_versions current_version on current_version.id=r.current_result_version_id
      where r.season_id=season.id and r.status<>'cancelled' and v.status in ('draft','validated')
        and v.version_number>coalesce(current_version.version_number,0)
        and not exists(select 1 from private.result_draft_discards where result_version_id=v.id)
        and not exists(select 1 from private.steward_publication_receipts where source_version_id=v.id)
      order by r.id,v.version_number desc
    loop
      if source.previous_version_id is distinct from source.current_result_version_id then raise exception 'PREVIEW_DRAFT_STALE'; end if;
      select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('race_id',source.race_id,'result_version_id',source.id) order by p.row_order),'[]')
        into rows from private.preview_result_rows(source.id) p;
      if jsonb_array_length(rows)=0 then raise exception 'PREVIEW_EMPTY_DRAFT'; end if;
      drafts:=drafts||jsonb_build_array(jsonb_build_object('raceId',source.race_id,'raceName',source.grand_prix_name,
        'round',source.round_number,'versionId',source.id,'versionNumber',source.version_number,'rows',rows));
    end loop;
  end if;
  return jsonb_build_object('generatedAt',statement_timestamp(),'drafts',drafts,
    'seats',coalesce((select jsonb_agg(jsonb_build_object('driverId',m.id,'gamertag',m.gamertag,'isAi',m.is_ai,
      'aiName',case when m.is_ai then coalesce(a.ai_driver_name,m.display_name) else m.ai_driver_name end))
      from league_roster_private.season_members(season.id,view_round) m
      left join public.season_driver_assignments a on a.season_id=season.id and a.driver_id=m.id),'[]'),
    'data',jsonb_build_object(
      'season',jsonb_build_object('id',season.id,'name',season.name),'assignments','[]'::jsonb,
      'currentRoster',coalesce((select jsonb_agg(to_jsonb(m)) from public.get_season_championship_roster(season.id) m),'[]'),
      'championshipAiAssignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.get_season_championship_ai_assignments(season.id) a),'[]'),
      'drivers',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'display_name',coalesce(nullif(d.public_name,''),d.display_name),
        'gamertag',d.gamertag,'league_team',d.league_team,'car_name',d.car_name,'is_active',d.is_active)) from public.drivers d where d.league_id=lid),'[]'),
      'races',coalesce((select jsonb_agg(to_jsonb(r) order by r.round_number) from public.races r where r.season_id=season.id),'[]'),
      'results',coalesce((select jsonb_agg(to_jsonb(rr) order by r.round_number,rr.finish_position,rr.id)
        from public.race_results rr join public.races r on r.id=rr.race_id and r.current_result_version_id=rr.result_version_id
        where r.season_id=season.id and r.status<>'cancelled'),'[]')));
end $$;
revoke all on function private.reverse_grid_workspace(boolean) from public,anon,authenticated,service_role;
grant execute on function private.reverse_grid_workspace(boolean) to authenticated;
create function public.get_reverse_grid_workspace(p_include_drafts boolean default false) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.reverse_grid_workspace(p_include_drafts); $$;
revoke all on function public.get_reverse_grid_workspace(boolean) from public,anon,authenticated,service_role;
grant execute on function public.get_reverse_grid_workspace(boolean) to authenticated;

commit;
