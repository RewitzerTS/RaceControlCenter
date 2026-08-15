-- Atomically replace one official race result from a reviewed draft.
-- The function runs as the authenticated caller and keeps RLS in force.

create or replace function public.publish_race_result_draft(
  p_import_id uuid,
  p_race_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_import_race_id uuid;
  v_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select ri.race_id, s.league_id
    into v_import_race_id, v_league_id
  from public.race_result_imports ri
  join public.races r on r.id = ri.race_id
  join public.seasons s on s.id = r.season_id
  where ri.id = p_import_id;

  if v_import_race_id is null then
    raise exception 'Result draft not found';
  end if;
  if v_import_race_id <> p_race_id then
    raise exception 'Draft does not belong to race';
  end if;
  if not public.has_league_role(v_league_id, array['owner','admin','steward'])
     and not public.is_platform_owner() then
    raise exception 'Insufficient league role';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Official result must contain at least one row';
  end if;

  delete from public.race_results where race_id = p_race_id;

  insert into public.race_results (
    race_id,
    driver_id,
    team_id,
    car_name_snapshot,
    ai_driver_reference_snapshot,
    grid_position,
    finish_position,
    race_time_ms,
    fastest_lap_time_ms,
    fastest_lap_ms,
    pit_stops,
    participation_status,
    base_points,
    penalty_time_delta_ms,
    awarded_points,
    fastest_lap_time,
    race_time,
    points_car_name,
    points
  )
  select
    p_race_id,
    x.driver_id,
    tm.id,
    d.car_name,
    d.ai_driver_reference,
    x.grid_position,
    x.finish_position,
    x.race_time_ms,
    x.fastest_lap_time_ms,
    x.fastest_lap_ms,
    coalesce(x.pit_stops, 0),
    coalesce(nullif(x.participation_status, ''), 'PLAYER'),
    coalesce(x.base_points, 0),
    coalesce(x.penalty_time_delta_ms, 0),
    coalesce(x.awarded_points, 0),
    x.fastest_lap_time,
    x.race_time,
    d.car_name,
    coalesce(x.points, x.base_points, 0)
  from jsonb_to_recordset(p_rows) as x(
    driver_id uuid,
    grid_position integer,
    finish_position integer,
    race_time_ms bigint,
    fastest_lap_time_ms bigint,
    fastest_lap_ms bigint,
    pit_stops integer,
    participation_status text,
    base_points numeric(7,2),
    penalty_time_delta_ms integer,
    awarded_points numeric(7,2),
    fastest_lap_time text,
    race_time text,
    points numeric
  )
  join public.drivers d on d.id = x.driver_id
  left join lateral (
    select t.id
    from public.teams t
    where t.league_id = v_league_id
      and (
        lower(btrim(coalesce(t.display_name, ''))) = lower(btrim(coalesce(d.league_team, '')))
        or lower(btrim(coalesce(t.short_name, ''))) = lower(btrim(coalesce(d.league_team, '')))
      )
    order by t.created_at asc
    limit 1
  ) tm on true;

  update public.races
  set status = 'completed'
  where id = p_race_id;

  update public.race_result_imports
  set status = 'published',
      published_by = coalesce(published_by, auth.uid()),
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = p_import_id;
end;
$$;

revoke all on function public.publish_race_result_draft(uuid, uuid, jsonb) from public;
revoke all on function public.publish_race_result_draft(uuid, uuid, jsonb) from anon;
grant execute on function public.publish_race_result_draft(uuid, uuid, jsonb) to authenticated;
