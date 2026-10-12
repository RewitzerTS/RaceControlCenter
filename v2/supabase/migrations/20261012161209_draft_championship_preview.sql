-- Read-only draft projection. No result activation, ledger, event or XP writes.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create function private.preview_result_rows(p_version_id uuid)
returns setof public.result_version_rows
language plpgsql stable security definer set search_path='' as $$
declare
  race public.races%rowtype; season public.seasons%rowtype;
  rows public.result_version_rows[]; original public.result_version_rows[];
  corrections jsonb; adjustment jsonb; winner_time bigint; fastest_id uuid;
  point_scale jsonb; i integer; target_index integer; ranked record;
  old_base numeric; new_base numeric; old_bonus numeric; new_bonus numeric;
begin
  select r.* into race from public.races r join public.result_versions v on v.race_id=r.id where v.id=p_version_id;
  select * into season from public.seasons where id=race.season_id;
  select array_agg(r order by r.row_order) into rows from public.result_version_rows r where r.result_version_id=p_version_id;
  original:=rows;
  select jsonb_agg(jsonb_build_object('driver_id',p.driver_id,'delta',p.time_delta_ms) order by d.finalized_at,p.id)
    into corrections from public.steward_penalties p
    join public.steward_decision_versions d on d.id=p.decision_version_id
    join public.steward_cases c on c.id=d.case_id
    where c.race_id=race.id and c.deleted_at is null and p.penalty_type in ('time_penalty','time_credit')
      and not exists(select 1 from public.steward_penalty_applications a where a.penalty_id=p.id);
  if corrections is null then return query select * from unnest(rows); return; end if;

  -- Mirror prepare_steward_time_corrections without creating a result version.
  select coalesce(r.race_time_ms,private.steward_duration_ms(r.race_time)) into winner_time
    from unnest(rows) r where r.finish_position=1;
  for i in 1..coalesce(cardinality(rows),0) loop
    if rows[i].race_time_ms is null then
      rows[i].race_time_ms:=case when btrim(rows[i].race_time) like '+%'
        then winner_time+private.steward_duration_ms(substr(btrim(rows[i].race_time),2))
        else private.steward_duration_ms(rows[i].race_time) end;
    end if;
  end loop;
  for adjustment in select value from jsonb_array_elements(corrections) loop
    target_index:=null;
    for i in 1..coalesce(cardinality(rows),0) loop
      if rows[i].driver_id=(adjustment->>'driver_id')::uuid and rows[i].classification_status='classified'
        and rows[i].race_time_ms is not null and rows[i].finish_position is not null
        and coalesce(rows[i].race_time,'') !~* '(lap|runde|dnf|dns|dsq)' then target_index:=i; end if;
    end loop;
    if target_index is null then raise exception 'PREVIEW_STEWARD_TIMES_REQUIRED'; end if;
    rows[target_index].penalty_time_delta_ms:=rows[target_index].penalty_time_delta_ms+(adjustment->>'delta')::integer;
  end loop;
  for i in 1..coalesce(cardinality(rows),0) loop
    if rows[i].classification_status='classified' and coalesce(rows[i].race_time,'') !~* '(lap|runde|dnf|dns|dsq)'
      and (rows[i].race_time_ms is null or rows[i].finish_position is null) then
      raise exception 'PREVIEW_STEWARD_TIMES_REQUIRED';
    end if;
    if rows[i].race_time_ms+rows[i].penalty_time_delta_ms<0 then raise exception 'PREVIEW_NEGATIVE_TIME'; end if;
  end loop;
  for ranked in
    with timed as (
      select r.id,r.finish_position,r.row_order,r.race_time_ms+r.penalty_time_delta_ms effective
      from unnest(rows) r where r.classification_status='classified' and r.race_time_ms is not null
        and coalesce(r.race_time,'') !~* '(lap|runde|dnf|dns|dsq)'
    ), slots as (select finish_position,row_number() over(order by finish_position) n from timed),
    ordered as (select id,row_number() over(order by effective,finish_position,row_order) n from timed)
    select o.id,s.finish_position from ordered o join slots s using(n)
  loop
    for i in 1..cardinality(rows) loop
      if rows[i].id=ranked.id then rows[i].finish_position:=ranked.finish_position; end if;
    end loop;
  end loop;
  select coalesce(nullif(l.settings#>'{scoring,points}','[]'::jsonb),'[25,18,15,12,10,8,6,4,2,1]'::jsonb)
    into point_scale from public.leagues l where l.id=season.league_id;
  select r.driver_id into fastest_id from unnest(original) r
    where coalesce(r.fastest_lap_time_ms,r.fastest_lap_ms,private.steward_duration_ms(r.fastest_lap_time))>0
    order by coalesce(r.fastest_lap_time_ms,r.fastest_lap_ms,private.steward_duration_ms(r.fastest_lap_time)),r.finish_position nulls last,r.row_order limit 1;
  for i in 1..cardinality(rows) loop
    if original[i].classification_status='classified' and coalesce(original[i].race_time,'') !~* '(dnf|dns|dsq)' then
      old_base:=coalesce((point_scale->>(original[i].finish_position-1))::numeric,0);
      new_base:=coalesce((point_scale->>(rows[i].finish_position-1))::numeric,0);
      old_bonus:=case when season.fastest_lap_bonus_enabled and original[i].driver_id=fastest_id and original[i].finish_position<=season.fastest_lap_bonus_max_finish_position then season.fastest_lap_bonus_points else 0 end;
      new_bonus:=case when season.fastest_lap_bonus_enabled and rows[i].driver_id=fastest_id and rows[i].finish_position<=season.fastest_lap_bonus_max_finish_position then season.fastest_lap_bonus_points else 0 end;
      rows[i].awarded_points:=greatest(0,new_base+new_bonus+original[i].awarded_points-old_base-old_bonus);
    end if;
    return next rows[i];
  end loop;
end $$;
revoke all on function private.preview_result_rows(uuid) from public,anon,authenticated,service_role;

create function public.get_result_draft_championship_preview(p_result_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  source public.result_versions%rowtype; race public.races%rowtype; season public.seasons%rowtype;
  draft_rows jsonb; pending_count integer;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='PREVIEW_ACCESS_DENIED'; end if;
  select * into source from public.result_versions where id=p_result_version_id;
  select * into race from public.races where id=source.race_id;
  select * into season from public.seasons where id=race.season_id;
  if season.id is null or not public.matches_requested_league(season.league_id)
    or not private.has_league_capability(season.league_id,'league_admin') then
    raise exception using errcode='42501',message='PREVIEW_ACCESS_DENIED';
  end if;
  if source.status not in ('draft','validated') or source.previous_version_id is distinct from race.current_result_version_id then
    raise exception 'PREVIEW_DRAFT_STALE';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'race_id',race.id,'result_version_id',source.id,'driver_id',r.driver_id,
    'points_owner_driver_id',r.points_owner_driver_id,'awarded_points',r.awarded_points,
    'finish_position',r.finish_position,'participation_status',r.participation_status,
    'fastest_lap_time_ms',r.fastest_lap_time_ms,'fastest_lap_ms',r.fastest_lap_ms,'fastest_lap_time',r.fastest_lap_time,
    'points_team_name',r.points_team_name,'points_car_name',r.points_car_name,'car_name_snapshot',r.car_name_snapshot
  ) order by r.row_order),'[]'::jsonb) into draft_rows from private.preview_result_rows(source.id) r;
  if jsonb_array_length(draft_rows)=0 then raise exception 'PREVIEW_EMPTY_DRAFT'; end if;
  select count(*) into pending_count from public.steward_penalties p
    join public.steward_decision_versions d on d.id=p.decision_version_id join public.steward_cases c on c.id=d.case_id
    where c.race_id=race.id and c.deleted_at is null and p.penalty_type in ('time_penalty','time_credit')
      and not exists(select 1 from public.steward_penalty_applications a where a.penalty_id=p.id);
  return jsonb_build_object('versionId',source.id,'versionNumber',source.version_number,
    'raceId',race.id,'raceName',race.grand_prix_name,'pendingCorrections',pending_count,
    'generatedAt',statement_timestamp(),'replacesPublished',race.current_result_version_id is not null,'draftRows',draft_rows,
    'data',jsonb_build_object(
      'season',jsonb_build_object('id',season.id,'name',season.name),'assignments','[]'::jsonb,
      'currentRoster',coalesce((select jsonb_agg(to_jsonb(m)) from public.get_season_championship_roster(season.id) m),'[]'::jsonb),
      'drivers',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'display_name',d.display_name,'gamertag',d.gamertag,
        'league_team',d.league_team,'car_name',d.car_name,'is_active',d.is_active)) from public.drivers d where d.league_id=season.league_id),'[]'::jsonb),
      'races',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'season_id',r.season_id,'round_number',r.round_number,
        'grand_prix_name',r.grand_prix_name,'country_code',r.country_code,'status',r.status,
        'current_result_version_id',r.current_result_version_id) order by r.round_number) from public.races r where r.season_id=season.id),'[]'::jsonb),
      'results',coalesce((select jsonb_agg(jsonb_build_object('id',rr.id,'race_id',rr.race_id,'result_version_id',rr.result_version_id,
        'driver_id',rr.driver_id,'points_owner_driver_id',rr.points_owner_driver_id,'awarded_points',rr.awarded_points,
        'finish_position',rr.finish_position,'participation_status',rr.participation_status,'fastest_lap_time_ms',rr.fastest_lap_time_ms,
        'fastest_lap_ms',rr.fastest_lap_ms,'fastest_lap_time',rr.fastest_lap_time,'points_team_name',rr.points_team_name,
        'points_car_name',rr.points_car_name,'car_name_snapshot',rr.car_name_snapshot) order by r.round_number,rr.finish_position,rr.id)
        from public.race_results rr join public.races r on r.id=rr.race_id and r.current_result_version_id=rr.result_version_id
        where r.season_id=season.id),'[]'::jsonb)));
end $$;
revoke all on function public.get_result_draft_championship_preview(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_result_draft_championship_preview(uuid) to authenticated;
comment on function public.get_result_draft_championship_preview(uuid) is
  'Read-only, league-admin scoped snapshot: official season plus one saved draft and pending steward time corrections. Never activates or awards anything.';
commit;
