-- Preserve all values that league admins confirm in the result import review table.

create or replace function public.create_league_result_draft(
  p_race_id uuid,
  p_rows jsonb,
  p_change_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league_id uuid;
  target_season_id uuid;
  current_version_id uuid;
  new_version_id uuid;
  clean_reason text := btrim(coalesce(p_change_reason, ''));
  row_item jsonb;
  row_no integer := 0;
  target_driver public.drivers%rowtype;
  finish_value integer;
  grid_value integer;
  pit_stops_value integer;
  points_value numeric;
  fastest_lap_value bigint;
  fastest_lap_text text;
  race_time_text text;
  participant_value text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select s.league_id, s.id, r.current_result_version_id
  into target_league_id, target_season_id, current_version_id
  from public.races r
  join public.seasons s on s.id = r.season_id
  join public.leagues l on l.id = s.league_id
  where r.id = p_race_id
    and l.slug = public.requested_league_slug();

  if target_league_id is null
    or not private.has_league_capability(target_league_id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League result access denied.';
  end if;

  if jsonb_typeof(p_rows) <> 'array'
    or jsonb_array_length(p_rows) not between 1 and 40
    or char_length(clean_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'Result rows or change reason are invalid.';
  end if;

  new_version_id := private.create_result_version(p_race_id, clean_reason, current_version_id, null);

  for row_item in select value from jsonb_array_elements(p_rows)
  loop
    row_no := row_no + 1;

    select d.*
    into target_driver
    from public.drivers d
    where d.league_id = target_league_id
      and (
        d.id::text = nullif(row_item->>'driver_id', '')
        or lower(d.display_name) = lower(btrim(coalesce(row_item->>'driver_name', '')))
        or lower(coalesce(d.gamertag, '')) = lower(btrim(coalesce(row_item->>'driver_name', '')))
      )
    limit 1;

    if target_driver.id is null then
      raise exception using errcode = 'P0002', message = format('Unknown driver in row %s.', row_no);
    end if;

    begin
      finish_value := nullif(row_item->>'finish_position', '')::integer;
      grid_value := nullif(row_item->>'grid_position', '')::integer;
      pit_stops_value := coalesce(nullif(row_item->>'pit_stops', '')::integer, 0);
      points_value := coalesce(nullif(row_item->>'points', '')::numeric, 0);
      fastest_lap_value := coalesce(
        nullif(row_item->>'fastest_lap_time_ms', '')::bigint,
        nullif(row_item->>'fastest_lap_ms', '')::bigint
      );
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = '22023', message = format('Invalid numeric value in row %s.', row_no);
    end;

    if finish_value is not null and finish_value not between 1 and 99 then
      raise exception using errcode = '22023', message = format('Invalid finish position in row %s.', row_no);
    end if;
    if grid_value is not null and grid_value not between 1 and 99 then
      raise exception using errcode = '22023', message = format('Invalid grid position in row %s.', row_no);
    end if;
    if pit_stops_value not between 0 and 99 then
      raise exception using errcode = '22023', message = format('Invalid pit-stop count in row %s.', row_no);
    end if;
    if fastest_lap_value is not null and fastest_lap_value not between 1 and 600000 then
      raise exception using errcode = '22023', message = format('Invalid fastest lap in row %s.', row_no);
    end if;

    fastest_lap_text := nullif(btrim(coalesce(row_item->>'fastest_lap_time', '')), '');
    race_time_text := nullif(btrim(coalesce(row_item->>'race_time', '')), '');

    select case when upper(a.participant_type) = 'BOT' then 'BOT' else 'PLAYER' end
    into participant_value
    from public.season_driver_assignments a
    where a.season_id = target_season_id
      and a.driver_id = target_driver.id
    limit 1;
    participant_value := coalesce(participant_value, 'PLAYER');

    insert into public.result_version_rows (
      result_version_id, row_order, driver_id, finish_position, grid_position,
      pit_stops, participation_status, awarded_points, base_points, points,
      fastest_lap_time, fastest_lap_time_ms, fastest_lap_ms, race_time,
      points_team_name, points_car_name, car_name_snapshot
    ) values (
      new_version_id, row_no, target_driver.id, finish_value, grid_value,
      pit_stops_value, participant_value, points_value, points_value, points_value,
      fastest_lap_text, fastest_lap_value, fastest_lap_value, race_time_text,
      coalesce(nullif(row_item->>'team_name', ''), target_driver.league_team),
      coalesce(nullif(row_item->>'car_name', ''), target_driver.car_name),
      target_driver.car_name
    );
  end loop;

  perform private.validate_result_version(new_version_id);

  insert into public.v2_audit_events (
    scope, league_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', target_league_id, actor_id, 'result.draft_created', 'result_version', new_version_id,
    jsonb_build_object('race_id', p_race_id, 'rows', row_no, 'base_version_id', current_version_id)
  );

  return jsonb_build_object('id', new_version_id, 'status', 'validated', 'rows', row_no);
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'A driver or finish row occurs more than once.';
end
$$;

revoke all on function public.create_league_result_draft(uuid, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_league_result_draft(uuid, jsonb, text)
  to authenticated, service_role;
