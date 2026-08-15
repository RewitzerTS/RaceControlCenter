-- Allow half-points for configurable assigned-AI replacement scoring.
-- The standings/ledger views and compatibility trigger depend on these columns,
-- so they are recreated atomically with the same security-invoker behavior.

drop view if exists public.v_driver_standings;
drop view if exists public.v_team_standings;
drop view if exists public.v_season_points_ledger;
drop trigger if exists trg_sync_race_result_points_compat on public.race_results;

alter table public.race_results
  alter column base_points type numeric(7,2) using base_points::numeric,
  alter column awarded_points type numeric(7,2) using awarded_points::numeric;

alter table public.race_result_import_rows
  alter column awarded_points type numeric(7,2) using awarded_points::numeric;

comment on column public.race_results.awarded_points is
  'Final race points including bonuses and AI replacement scoring; fractional values are supported.';

create trigger trg_sync_race_result_points_compat
before insert or update of awarded_points, points on public.race_results
for each row execute function public.sync_race_result_points_compat();

create view public.v_driver_standings
with (security_invoker = true)
as
select s.id as season_id,
       s.name as season_name,
       d.id as driver_id,
       d.display_name,
       d.gamertag,
       sum(rr.awarded_points) as points,
       count(*) filter (where rr.participation_status = 'finished'::text) as finished_races,
       count(*) filter (where rr.finish_position = 1) as wins,
       count(*) filter (where rr.finish_position <= 3) as podiums,
       min(rr.finish_position) as best_finish
from public.race_results rr
join public.races r on r.id = rr.race_id
join public.seasons s on s.id = r.season_id
join public.drivers d on d.id = rr.driver_id
group by s.id, s.name, d.id, d.display_name, d.gamertag;

create view public.v_team_standings
with (security_invoker = true)
as
select s.id as season_id,
       s.name as season_name,
       t.id as team_id,
       t.display_name as team_name,
       sum(rr.awarded_points) as points,
       count(*) filter (where rr.finish_position = 1) as wins,
       count(*) filter (where rr.finish_position <= 3) as podiums
from public.race_results rr
join public.races r on r.id = rr.race_id
join public.seasons s on s.id = r.season_id
left join public.teams t on t.id = rr.team_id
group by s.id, s.name, t.id, t.display_name;

create view public.v_season_points_ledger
with (security_invoker = true)
as
select rr.race_id,
       r.season_id,
       rr.driver_id as source_driver_id,
       coalesce(rr.points_owner_driver_id, rr.driver_id) as points_owner_driver_id,
       coalesce(rr.points_team_name, d.league_team, 'Ohne Team'::text) as points_team_name,
       coalesce(rr.points_car_name, d.car_name, '—'::text) as points_car_name,
       rr.awarded_points,
       rr.finish_position,
       rr.fastest_lap_time,
       rr.created_at,
       rr.source_assignment_id
from public.race_results rr
join public.races r on r.id = rr.race_id
left join public.drivers d on d.id = rr.driver_id;

grant all privileges on public.v_driver_standings to anon, authenticated, service_role;
grant all privileges on public.v_team_standings to anon, authenticated, service_role;
grant all privileges on public.v_season_points_ledger to anon, authenticated, service_role;
