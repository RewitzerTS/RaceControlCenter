-- Staging-only fixture enrichment. Never apply this file to Production.
-- Publishes proper result revisions with realistic lap times for the isolated
-- Demo Championship. This preserves the immutable result-version lifecycle.

begin;

update public.seasons
set fastest_lap_bonus_enabled = true,
    fastest_lap_bonus_points = 1,
    fastest_lap_bonus_max_finish_position = 10
where id = '22000000-2000-4000-8000-000000000001';

insert into public.result_versions (
  id, race_id, version_number, previous_version_id, status, change_reason
)
values
  ('22000000-5000-4000-8000-000000000011', '22000000-4000-4000-8000-000000000001', 2, '22000000-5000-4000-8000-000000000001', 'draft', 'Staging demo fastest-lap fixture'),
  ('22000000-5000-4000-8000-000000000012', '22000000-4000-4000-8000-000000000002', 2, '22000000-5000-4000-8000-000000000002', 'draft', 'Staging demo fastest-lap fixture'),
  ('22000000-5000-4000-8000-000000000014', '22000000-4000-4000-8000-000000000003', 3, '22000000-5000-4000-8000-000000000004', 'draft', 'Staging demo fastest-lap fixture')
on conflict (id) do nothing;

with version_map(old_version_id, new_version_id) as (
  values
    ('22000000-5000-4000-8000-000000000001'::uuid, '22000000-5000-4000-8000-000000000011'::uuid),
    ('22000000-5000-4000-8000-000000000002'::uuid, '22000000-5000-4000-8000-000000000012'::uuid),
    ('22000000-5000-4000-8000-000000000004'::uuid, '22000000-5000-4000-8000-000000000014'::uuid)
),
lap_times(old_version_id, driver_id, lap_time_ms, lap_time_text) as (
  values
    ('22000000-5000-4000-8000-000000000001'::uuid, '22000000-3000-4000-8000-000000000001'::uuid, 92110::bigint, '1:32.110'),
    ('22000000-5000-4000-8000-000000000001'::uuid, '22000000-3000-4000-8000-000000000003'::uuid, 92360::bigint, '1:32.360'),
    ('22000000-5000-4000-8000-000000000001'::uuid, '22000000-3000-4000-8000-000000000002'::uuid, 91850::bigint, '1:31.850'),
    ('22000000-5000-4000-8000-000000000001'::uuid, '22000000-3000-4000-8000-000000000004'::uuid, 93020::bigint, '1:33.020'),
    ('22000000-5000-4000-8000-000000000001'::uuid, '22000000-3000-4000-8000-000000000006'::uuid, 93400::bigint, '1:33.400'),
    ('22000000-5000-4000-8000-000000000002'::uuid, '22000000-3000-4000-8000-000000000002'::uuid, 105900::bigint, '1:45.900'),
    ('22000000-5000-4000-8000-000000000002'::uuid, '22000000-3000-4000-8000-000000000005'::uuid, 105420::bigint, '1:45.420'),
    ('22000000-5000-4000-8000-000000000002'::uuid, '22000000-3000-4000-8000-000000000003'::uuid, 106200::bigint, '1:46.200'),
    ('22000000-5000-4000-8000-000000000002'::uuid, '22000000-3000-4000-8000-000000000006'::uuid, 106890::bigint, '1:46.890'),
    ('22000000-5000-4000-8000-000000000004'::uuid, '22000000-3000-4000-8000-000000000002'::uuid, 81250::bigint, '1:21.250'),
    ('22000000-5000-4000-8000-000000000004'::uuid, '22000000-3000-4000-8000-000000000003'::uuid, 81820::bigint, '1:21.820'),
    ('22000000-5000-4000-8000-000000000004'::uuid, '22000000-3000-4000-8000-000000000004'::uuid, 82110::bigint, '1:22.110'),
    ('22000000-5000-4000-8000-000000000004'::uuid, '22000000-3000-4000-8000-000000000006'::uuid, 82440::bigint, '1:22.440')
),
fastest_drivers(old_version_id, driver_id) as (
  values
    ('22000000-5000-4000-8000-000000000001'::uuid, '22000000-3000-4000-8000-000000000002'::uuid),
    ('22000000-5000-4000-8000-000000000002'::uuid, '22000000-3000-4000-8000-000000000005'::uuid),
    ('22000000-5000-4000-8000-000000000004'::uuid, '22000000-3000-4000-8000-000000000002'::uuid)
)
insert into public.result_version_rows (
  result_version_id, row_order, driver_id, team_id, source_assignment_id,
  car_name_snapshot, ai_driver_reference_snapshot, grid_position, finish_position,
  race_time_ms, fastest_lap_time_ms, pit_stops, participation_status,
  base_points, penalty_time_delta_ms, awarded_points, notes,
  fastest_lap_time, race_time, points_owner_driver_id, points_team_name,
  points_car_name, points, fastest_lap_ms, classification_status
)
select
  map.new_version_id, row.row_order, row.driver_id, row.team_id,
  row.source_assignment_id, row.car_name_snapshot,
  row.ai_driver_reference_snapshot, row.grid_position, row.finish_position,
  row.race_time_ms, lap.lap_time_ms, row.pit_stops,
  row.participation_status, row.base_points, row.penalty_time_delta_ms,
  row.awarded_points + case when fastest.driver_id is not null then 1 else 0 end,
  row.notes, lap.lap_time_text, row.race_time, row.points_owner_driver_id,
  row.points_team_name, row.points_car_name,
  row.points + case when fastest.driver_id is not null then 1 else 0 end,
  lap.lap_time_ms, row.classification_status
from public.result_version_rows row
join version_map map on map.old_version_id = row.result_version_id
join public.result_versions target
  on target.id = map.new_version_id and target.status = 'draft'
left join lap_times lap
  on lap.old_version_id = row.result_version_id and lap.driver_id = row.driver_id
left join fastest_drivers fastest
  on fastest.old_version_id = row.result_version_id and fastest.driver_id = row.driver_id
on conflict (result_version_id, driver_id) do nothing;

select private.validate_result_version('22000000-5000-4000-8000-000000000011')
where exists (select 1 from public.result_versions where id = '22000000-5000-4000-8000-000000000011' and status = 'draft');
select private.activate_result_version('22000000-5000-4000-8000-000000000011')
where exists (select 1 from public.result_versions where id = '22000000-5000-4000-8000-000000000011' and status = 'validated');

select private.validate_result_version('22000000-5000-4000-8000-000000000012')
where exists (select 1 from public.result_versions where id = '22000000-5000-4000-8000-000000000012' and status = 'draft');
select private.activate_result_version('22000000-5000-4000-8000-000000000012')
where exists (select 1 from public.result_versions where id = '22000000-5000-4000-8000-000000000012' and status = 'validated');

select private.validate_result_version('22000000-5000-4000-8000-000000000014')
where exists (select 1 from public.result_versions where id = '22000000-5000-4000-8000-000000000014' and status = 'draft');
select private.activate_result_version('22000000-5000-4000-8000-000000000014')
where exists (select 1 from public.result_versions where id = '22000000-5000-4000-8000-000000000014' and status = 'validated');

update public.races race
set next_result_version_number = greatest(
  race.next_result_version_number,
  (select max(version_number) + 1 from public.result_versions where race_id = race.id)
)
where race.id in (
  '22000000-4000-4000-8000-000000000001',
  '22000000-4000-4000-8000-000000000002',
  '22000000-4000-4000-8000-000000000003'
);

commit;
