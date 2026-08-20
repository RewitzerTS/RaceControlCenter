-- RaceVora V2 Phase 22: owner-only Demo league and realistic Full E2E fixtures.
-- Additive staging migration. Never execute against V1 Production.

create table public.demo_driver_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  driver_id uuid not null unique references public.drivers(id) on delete cascade,
  is_substitute boolean not null default false,
  team_history jsonb not null default '[]'::jsonb,
  progression jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint demo_profile_team_history_array check (jsonb_typeof(team_history) = 'array'),
  constraint demo_profile_progression_object check (jsonb_typeof(progression) = 'object')
);

create index idx_demo_driver_profiles_league on public.demo_driver_profiles (league_id, driver_id);
alter table public.demo_driver_profiles enable row level security;
revoke all on table public.demo_driver_profiles from public, anon, authenticated;
grant select on table public.demo_driver_profiles to authenticated;
grant select, insert, update, delete on table public.demo_driver_profiles to service_role;

create policy "v2 owners read demo driver profiles"
on public.demo_driver_profiles for select to authenticated
using ((select public.is_platform_owner()));

create or replace function public.matches_requested_league(p_league_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.slug = public.requested_league_slug()
      and (
        coalesce(l.settings ->> 'owner_only', 'false') <> 'true'
        or (select public.is_platform_owner())
      )
  );
$$;

revoke all on function public.matches_requested_league(uuid) from public, anon, authenticated, service_role;
grant execute on function public.matches_requested_league(uuid) to anon, authenticated, service_role;

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('22000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'alex.apex@demo.invalid', now(), '{"provider":"demo","providers":["demo"]}', '{"demo":true,"name":"Alex Apex"}', now(), now(), false, false),
  ('22000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sam.slipstream@demo.invalid', now(), '{"provider":"demo","providers":["demo"]}', '{"demo":true,"name":"Sam Slipstream"}', now(), now(), false, false),
  ('22000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'jordan.grid@demo.invalid', now(), '{"provider":"demo","providers":["demo"]}', '{"demo":true,"name":"Jordan Grid"}', now(), now(), false, false),
  ('22000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'maya.chicane@demo.invalid', now(), '{"provider":"demo","providers":["demo"]}', '{"demo":true,"name":"Maya Chicane"}', now(), now(), false, false),
  ('22000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'luca.rain@demo.invalid', now(), '{"provider":"demo","providers":["demo"]}', '{"demo":true,"name":"Luca Rain"}', now(), now(), false, false),
  ('22000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'nina.sector@demo.invalid', now(), '{"provider":"demo","providers":["demo"]}', '{"demo":true,"name":"Nina Sector"}', now(), now(), false, false),
  ('22000000-0000-4000-8000-000000000099', 'authenticated', 'authenticated', 'steward@demo.invalid', now(), '{"provider":"demo","providers":["demo"]}', '{"demo":true,"name":"Demo Steward"}', now(), now(), false, false)
on conflict (id) do nothing;

insert into public.leagues (id, name, slug, status, is_public, settings)
values (
  '22000000-1000-4000-8000-000000000001', 'RaceVora Demo Championship', 'demo', 'active', false,
  '{"owner_only":true,"demo":true,"published":false,"progression_scope":"demo_only","purpose":["e2e","landing","screenshots","product_demo"]}'
)
on conflict (id) do nothing;

insert into public.seasons (id, league_id, slug, name, championship_code, start_date, end_date, is_active, game_key, game_label)
values ('22000000-2000-4000-8000-000000000001', '22000000-1000-4000-8000-000000000001', 'demo-2026', 'RaceVora Demo Season 2026', 'RV-DEMO-26', '2026-08-01', '2026-10-31', true, 'f1_25', 'F1 25')
on conflict (id) do nothing;

insert into public.drivers (id, league_id, display_name, gamertag, nationality_code, number, car_name, league_team, is_active)
values
  ('22000000-3000-4000-8000-000000000001', '22000000-1000-4000-8000-000000000001', 'Alex Apex', 'AlexApex', 'DE', 7, 'Orion R1', 'Orion Racing', true),
  ('22000000-3000-4000-8000-000000000002', '22000000-1000-4000-8000-000000000001', 'Sam Slipstream', 'SamSlipstream', 'GB', 11, 'Orion R1', 'Orion Racing', true),
  ('22000000-3000-4000-8000-000000000003', '22000000-1000-4000-8000-000000000001', 'Jordan Grid', 'JordanGrid', 'ES', 22, 'Vector V2', 'Vector Motorsport', true),
  ('22000000-3000-4000-8000-000000000004', '22000000-1000-4000-8000-000000000001', 'Maya Chicane', 'MayaChicane', 'FR', 44, 'Vector V2', 'Vector Motorsport', true),
  ('22000000-3000-4000-8000-000000000005', '22000000-1000-4000-8000-000000000001', 'Luca Rain', 'LucaRain', 'IT', 55, 'Orion R1', 'Orion Racing', true),
  ('22000000-3000-4000-8000-000000000006', '22000000-1000-4000-8000-000000000001', 'Nina Sector', 'NinaSector', 'NL', 63, 'Nova N1', 'Nova GP', true)
on conflict (id) do nothing;

insert into public.demo_driver_profiles (user_id, league_id, driver_id, is_substitute, team_history, progression)
values
  ('22000000-0000-4000-8000-000000000001', '22000000-1000-4000-8000-000000000001', '22000000-3000-4000-8000-000000000001', false, '[{"team":"Orion Racing","rounds":"1-2"},{"team":"Nova GP","rounds":"3+"}]', '{"xp":2840,"level":18,"rank":"Challenger","credits":760,"achievements":["starts_1","wins_1","podiums_1"],"challenges":["clean_finish","gain_positions"],"cosmetics":["helmet_violet","banner_apex"]}'),
  ('22000000-0000-4000-8000-000000000002', '22000000-1000-4000-8000-000000000001', '22000000-3000-4000-8000-000000000002', false, '[{"team":"Orion Racing","rounds":"1+"}]', '{"xp":2590,"level":17,"rank":"Challenger","credits":620,"achievements":["starts_1","wins_1","podiums_1"],"challenges":["podium_push"],"cosmetics":["helmet_teal"]}'),
  ('22000000-0000-4000-8000-000000000003', '22000000-1000-4000-8000-000000000001', '22000000-3000-4000-8000-000000000003', false, '[{"team":"Vector Motorsport","rounds":"1+"}]', '{"xp":2110,"level":15,"rank":"Contender","credits":540,"achievements":["starts_1","podiums_1"],"challenges":["consistent_points"],"cosmetics":["banner_vector"]}'),
  ('22000000-0000-4000-8000-000000000004', '22000000-1000-4000-8000-000000000001', '22000000-3000-4000-8000-000000000004', false, '[{"team":"Vector Motorsport","rounds":"1+"}]', '{"xp":1740,"level":13,"rank":"Contender","credits":410,"achievements":["starts_1"],"challenges":["clean_finish"],"cosmetics":[]}'),
  ('22000000-0000-4000-8000-000000000005', '22000000-1000-4000-8000-000000000001', '22000000-3000-4000-8000-000000000005', true, '[{"team":"Orion Racing","rounds":"2","role":"substitute"}]', '{"xp":680,"level":7,"rank":"Rookie","credits":510,"achievements":["starts_1"],"challenges":[],"cosmetics":["helmet_rain"]}'),
  ('22000000-0000-4000-8000-000000000006', '22000000-1000-4000-8000-000000000001', '22000000-3000-4000-8000-000000000006', false, '[{"team":"Nova GP","rounds":"1+"}]', '{"xp":1320,"level":11,"rank":"Prospect","credits":350,"achievements":["starts_1"],"challenges":["gain_positions"],"cosmetics":[]}')
on conflict (user_id) do nothing;

insert into public.races (id, season_id, round_number, grand_prix_name, circuit_name, country_code, race_date, status, race_order)
values
  ('22000000-4000-4000-8000-000000000001', '22000000-2000-4000-8000-000000000001', 1, 'Bahrain Grand Prix', 'Bahrain International Circuit', 'BH', '2026-08-08', 'completed', 1),
  ('22000000-4000-4000-8000-000000000002', '22000000-2000-4000-8000-000000000001', 2, 'Belgian Grand Prix', 'Spa-Francorchamps', 'BE', '2026-08-15', 'completed', 2),
  ('22000000-4000-4000-8000-000000000003', '22000000-2000-4000-8000-000000000001', 3, 'Italian Grand Prix', 'Monza', 'IT', '2026-08-22', 'completed', 3),
  ('22000000-4000-4000-8000-000000000004', '22000000-2000-4000-8000-000000000001', 4, 'Japanese Grand Prix', 'Suzuka', 'JP', '2026-08-29', 'upcoming', 4)
on conflict (id) do nothing;

insert into public.result_versions (id, race_id, version_number, previous_version_id, status, change_reason)
values
  ('22000000-5000-4000-8000-000000000001', '22000000-4000-4000-8000-000000000001', 1, null, 'draft', 'Demo official result'),
  ('22000000-5000-4000-8000-000000000002', '22000000-4000-4000-8000-000000000002', 1, null, 'draft', 'Demo official result with substitute'),
  ('22000000-5000-4000-8000-000000000003', '22000000-4000-4000-8000-000000000003', 1, null, 'draft', 'Original result before steward decision'),
  ('22000000-5000-4000-8000-000000000004', '22000000-4000-4000-8000-000000000003', 2, '22000000-5000-4000-8000-000000000003', 'draft', 'Revised after post-race disqualification')
on conflict (id) do nothing;

insert into public.result_version_rows (result_version_id, row_order, driver_id, finish_position, grid_position, classification_status, points_team_name, car_name_snapshot, awarded_points, points)
values
  ('22000000-5000-4000-8000-000000000001',1,'22000000-3000-4000-8000-000000000001',1,2,'classified','Orion Racing','Orion R1',25,25),
  ('22000000-5000-4000-8000-000000000001',2,'22000000-3000-4000-8000-000000000003',2,1,'classified','Vector Motorsport','Vector V2',18,18),
  ('22000000-5000-4000-8000-000000000001',3,'22000000-3000-4000-8000-000000000002',3,4,'classified','Orion Racing','Orion R1',15,15),
  ('22000000-5000-4000-8000-000000000001',4,'22000000-3000-4000-8000-000000000004',4,3,'classified','Vector Motorsport','Vector V2',12,12),
  ('22000000-5000-4000-8000-000000000001',5,'22000000-3000-4000-8000-000000000006',5,5,'classified','Nova GP','Nova N1',10,10),
  ('22000000-5000-4000-8000-000000000001',6,'22000000-3000-4000-8000-000000000005',null,6,'dns','Orion Racing','Orion R1',0,0),
  ('22000000-5000-4000-8000-000000000002',1,'22000000-3000-4000-8000-000000000002',1,2,'classified','Orion Racing','Orion R1',25,25),
  ('22000000-5000-4000-8000-000000000002',2,'22000000-3000-4000-8000-000000000005',2,5,'classified','Orion Racing','Orion R1',18,18),
  ('22000000-5000-4000-8000-000000000002',3,'22000000-3000-4000-8000-000000000003',3,1,'classified','Vector Motorsport','Vector V2',15,15),
  ('22000000-5000-4000-8000-000000000002',4,'22000000-3000-4000-8000-000000000006',4,4,'classified','Nova GP','Nova N1',12,12),
  ('22000000-5000-4000-8000-000000000002',5,'22000000-3000-4000-8000-000000000001',null,3,'dnf','Orion Racing','Orion R1',0,0),
  ('22000000-5000-4000-8000-000000000002',6,'22000000-3000-4000-8000-000000000004',null,6,'dns','Vector Motorsport','Vector V2',0,0),
  ('22000000-5000-4000-8000-000000000003',1,'22000000-3000-4000-8000-000000000001',1,1,'classified','Nova GP','Nova N1',25,25),
  ('22000000-5000-4000-8000-000000000003',2,'22000000-3000-4000-8000-000000000002',2,2,'classified','Orion Racing','Orion R1',18,18),
  ('22000000-5000-4000-8000-000000000003',3,'22000000-3000-4000-8000-000000000003',3,3,'classified','Vector Motorsport','Vector V2',15,15),
  ('22000000-5000-4000-8000-000000000003',4,'22000000-3000-4000-8000-000000000004',4,5,'classified','Vector Motorsport','Vector V2',12,12),
  ('22000000-5000-4000-8000-000000000003',5,'22000000-3000-4000-8000-000000000006',5,4,'classified','Nova GP','Nova N1',10,10),
  ('22000000-5000-4000-8000-000000000004',1,'22000000-3000-4000-8000-000000000002',1,2,'classified','Orion Racing','Orion R1',25,25),
  ('22000000-5000-4000-8000-000000000004',2,'22000000-3000-4000-8000-000000000003',2,3,'classified','Vector Motorsport','Vector V2',18,18),
  ('22000000-5000-4000-8000-000000000004',3,'22000000-3000-4000-8000-000000000004',3,5,'classified','Vector Motorsport','Vector V2',15,15),
  ('22000000-5000-4000-8000-000000000004',4,'22000000-3000-4000-8000-000000000006',4,4,'classified','Nova GP','Nova N1',12,12),
  ('22000000-5000-4000-8000-000000000004',5,'22000000-3000-4000-8000-000000000001',null,1,'dsq','Nova GP','Nova N1',0,0)
on conflict (result_version_id, driver_id) do nothing;

-- Exercise the same immutable result lifecycle as a real event. Rows must be
-- complete before validation; the previous Monza result must be superseded
-- before its revised version can become active.
update public.result_versions set status = 'validated', validated_at = '2026-08-08 20:00+00' where id = '22000000-5000-4000-8000-000000000001';
update public.result_versions set status = 'active', activated_at = '2026-08-08 20:05+00' where id = '22000000-5000-4000-8000-000000000001';
update public.result_versions set status = 'validated', validated_at = '2026-08-15 20:00+00' where id = '22000000-5000-4000-8000-000000000002';
update public.result_versions set status = 'active', activated_at = '2026-08-15 20:05+00' where id = '22000000-5000-4000-8000-000000000002';
update public.result_versions set status = 'validated', validated_at = '2026-08-22 20:00+00' where id = '22000000-5000-4000-8000-000000000003';
update public.result_versions set status = 'active', activated_at = '2026-08-22 20:05+00' where id = '22000000-5000-4000-8000-000000000003';
update public.result_versions set status = 'superseded', superseded_at = '2026-08-22 22:00+00' where id = '22000000-5000-4000-8000-000000000003';
update public.result_versions set status = 'validated', validated_at = '2026-08-22 21:55+00' where id = '22000000-5000-4000-8000-000000000004';
update public.result_versions set status = 'active', activated_at = '2026-08-22 22:00+00' where id = '22000000-5000-4000-8000-000000000004';

update public.races set current_result_version_id = case id
  when '22000000-4000-4000-8000-000000000001' then '22000000-5000-4000-8000-000000000001'::uuid
  when '22000000-4000-4000-8000-000000000002' then '22000000-5000-4000-8000-000000000002'::uuid
  when '22000000-4000-4000-8000-000000000003' then '22000000-5000-4000-8000-000000000004'::uuid
end
where id in ('22000000-4000-4000-8000-000000000001','22000000-4000-4000-8000-000000000002','22000000-4000-4000-8000-000000000003');

insert into public.race_results (race_id, result_version_id, driver_id, team_id, grid_position, finish_position, classification_status, awarded_points, points_team_name, points_car_name, points)
select rv.race_id, rvr.result_version_id, rvr.driver_id, rvr.team_id, rvr.grid_position, rvr.finish_position, rvr.classification_status, rvr.awarded_points, rvr.points_team_name, rvr.points_car_name, rvr.points
from public.result_version_rows rvr
join public.result_versions rv on rv.id = rvr.result_version_id
join public.races r on r.current_result_version_id = rv.id
where rv.id in ('22000000-5000-4000-8000-000000000001','22000000-5000-4000-8000-000000000002','22000000-5000-4000-8000-000000000004')
on conflict (race_id, driver_id) do nothing;

insert into public.steward_cases (id, league_id, race_id, case_number, status, title, description, reported_driver_id, accused_driver_id, rule_code, rule_version, created_by, created_at, closed_at, current_decision_version, idempotency_key)
values ('22000000-6000-4000-8000-000000000001','22000000-1000-4000-8000-000000000001','22000000-4000-4000-8000-000000000003','RV-2026-0001','closed','Unsafe rejoin after Variante della Roggia','The leading car rejoined across the racing line and caused an avoidable collision.','22000000-3000-4000-8000-000000000003','22000000-3000-4000-8000-000000000001','SPORTING-12.4','2026.1','22000000-0000-4000-8000-000000000099','2026-08-22 20:20+00','2026-08-22 22:00+00',1,'demo-case-2026-0001')
on conflict (id) do nothing;

insert into public.steward_decision_versions (id, case_id, version_number, outcome, reasoning, rule_code, rule_version, finalized_by, finalized_at, result_version_id, idempotency_key)
values ('22000000-6100-4000-8000-000000000001','22000000-6000-4000-8000-000000000001',1,'penalty','Telemetry and both statements confirm an unsafe rejoin with decisive race impact.','SPORTING-12.4','2026.1','22000000-0000-4000-8000-000000000099','2026-08-22 22:00+00','22000000-5000-4000-8000-000000000004','demo-decision-2026-0001')
on conflict (id) do nothing;

insert into public.steward_penalties (id, decision_version_id, driver_id, penalty_type, reason)
values ('22000000-6200-4000-8000-000000000001','22000000-6100-4000-8000-000000000001','22000000-3000-4000-8000-000000000001','disqualification','Unsafe rejoin with decisive collision impact.')
on conflict (id) do nothing;

create or replace function public.get_demo_full_e2e_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  demo_league_id constant uuid := '22000000-1000-4000-8000-000000000001';
begin
  if not public.is_platform_owner() then
    raise exception using errcode = '42501', message = 'Platform owner access required.';
  end if;

  return jsonb_build_object(
    'league', (select jsonb_build_object('id', l.id, 'name', l.name, 'slug', l.slug, 'owner_only', l.settings -> 'owner_only', 'progression_scope', l.settings -> 'progression_scope') from public.leagues l where l.id = demo_league_id),
    'counts', jsonb_build_object(
      'registered_drivers', (select count(*) from public.demo_driver_profiles where league_id = demo_league_id),
      'teams', (select count(distinct value ->> 'team') from public.demo_driver_profiles dp cross join lateral jsonb_array_elements(dp.team_history) value where dp.league_id = demo_league_id),
      'races', (select count(*) from public.races r join public.seasons s on s.id = r.season_id where s.league_id = demo_league_id),
      'result_versions', (select count(*) from public.result_versions rv join public.races r on r.id = rv.race_id join public.seasons s on s.id = r.season_id where s.league_id = demo_league_id),
      'steward_cases', (select count(*) from public.steward_cases where league_id = demo_league_id)
    ),
    'coverage', jsonb_build_object(
      'dns', exists(select 1 from public.race_results rr join public.drivers d on d.id = rr.driver_id where d.league_id = demo_league_id and rr.classification_status = 'dns'),
      'dnf', exists(select 1 from public.race_results rr join public.drivers d on d.id = rr.driver_id where d.league_id = demo_league_id and rr.classification_status = 'dnf'),
      'dsq', exists(select 1 from public.race_results rr join public.drivers d on d.id = rr.driver_id where d.league_id = demo_league_id and rr.classification_status = 'dsq'),
      'substitute', exists(select 1 from public.demo_driver_profiles where league_id = demo_league_id and is_substitute),
      'team_change', exists(select 1 from public.demo_driver_profiles where league_id = demo_league_id and jsonb_array_length(team_history) > 1),
      'steward_case', exists(select 1 from public.steward_cases where league_id = demo_league_id),
      'penalty', exists(select 1 from public.steward_penalties sp join public.drivers d on d.id = sp.driver_id where d.league_id = demo_league_id),
      'revised_result', exists(select 1 from public.result_versions rv join public.races r on r.id = rv.race_id join public.seasons s on s.id = r.season_id where s.league_id = demo_league_id and rv.previous_version_id is not null),
      'achievements', exists(select 1 from public.demo_driver_profiles where league_id = demo_league_id and jsonb_array_length(progression -> 'achievements') > 0),
      'challenges', exists(select 1 from public.demo_driver_profiles where league_id = demo_league_id and jsonb_array_length(progression -> 'challenges') > 0),
      'xp', exists(select 1 from public.demo_driver_profiles where league_id = demo_league_id and (progression ->> 'xp')::integer > 0),
      'credits', exists(select 1 from public.demo_driver_profiles where league_id = demo_league_id and (progression ->> 'credits')::integer > 0),
      'cosmetics', exists(select 1 from public.demo_driver_profiles where league_id = demo_league_id and jsonb_array_length(progression -> 'cosmetics') > 0)
    ),
    'drivers', coalesce((select jsonb_agg(jsonb_build_object('name', d.display_name, 'gamertag', d.gamertag, 'number', d.number, 'substitute', dp.is_substitute, 'team_history', dp.team_history, 'progression', dp.progression) order by d.number) from public.demo_driver_profiles dp join public.drivers d on d.id = dp.driver_id where dp.league_id = demo_league_id), '[]'::jsonb),
    'calendar', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'round', r.round_number, 'name', r.grand_prix_name, 'circuit', r.circuit_name, 'date', r.race_date, 'status', r.status, 'result_version', rv.version_number) order by r.round_number) from public.races r join public.seasons s on s.id = r.season_id left join public.result_versions rv on rv.id = r.current_result_version_id where s.league_id = demo_league_id), '[]'::jsonb),
    'steward', (select jsonb_build_object('case_number', sc.case_number, 'title', sc.title, 'status', sc.status, 'penalty', sp.penalty_type, 'result_version', rv.version_number) from public.steward_cases sc join public.steward_decision_versions sdv on sdv.case_id = sc.id and sdv.version_number = sc.current_decision_version join public.steward_penalties sp on sp.decision_version_id = sdv.id join public.result_versions rv on rv.id = sdv.result_version_id where sc.league_id = demo_league_id limit 1)
  );
end;
$$;

revoke all on function public.get_demo_full_e2e_snapshot() from public, anon, authenticated, service_role;
grant execute on function public.get_demo_full_e2e_snapshot() to authenticated;

comment on table public.demo_driver_profiles is 'Owner-only demo projections; never contribute to global Driver progression.';
comment on function public.get_demo_full_e2e_snapshot() is 'Actor-bound owner snapshot for the isolated Demo Full E2E league.';
