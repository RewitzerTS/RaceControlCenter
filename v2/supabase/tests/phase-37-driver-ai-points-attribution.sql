-- AI participants keep their own result identity while championship points
-- follow the effective-dated human owner. Synthetic fixtures are rolled back.

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'f3700000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
  'phase37-admin@example.invalid', '{}', '{}', now(), now()
);

insert into public.leagues (id, name, slug, is_public, settings)
values (
  'f3710000-0000-0000-0000-000000000001', 'AI Attribution League',
  'ai-attribution-league', true, '{"published":true,"theme_id":"1"}'
);

insert into public.driver_identities (id, user_id)
values (
  'f3700000-0000-0000-0000-000000000002',
  'f3700000-0000-0000-0000-000000000001'
);

insert into public.league_members (league_id, user_id, role)
values (
  'f3710000-0000-0000-0000-000000000001',
  'f3700000-0000-0000-0000-000000000001',
  'league_admin'
);

insert into public.seasons (
  id, league_id, slug, name, is_active, game_key, game_label
) values (
  'f3720000-0000-0000-0000-000000000001',
  'f3710000-0000-0000-0000-000000000001',
  'season-2026', 'Season 2026', true, 'f1_25', 'F1 25'
);

insert into public.drivers (
  id, league_id, display_name, gamertag, league_team, car_name, ai_driver_reference, is_active
) values
  ('f3740000-0000-0000-0000-000000000001', 'f3710000-0000-0000-0000-000000000001', 'Human Driver', 'HumanTag', 'Mercedes', 'Mercedes W16', null, true),
  ('f3740000-0000-0000-0000-000000000002', 'f3710000-0000-0000-0000-000000000001', 'AI Driver One', null, 'Mercedes', 'Mercedes W16', 'f1_25:mercedes-one', false),
  ('f3740000-0000-0000-0000-000000000003', 'f3710000-0000-0000-0000-000000000001', 'AI Driver Two', null, 'Ferrari', 'Ferrari SF-25', 'f1_25:ferrari-two', true);

insert into public.season_driver_assignments (
  id, season_id, driver_id, seat_code, ai_driver_name, team_name,
  car_name, number, nationality_code, participant_type, gamertag_snapshot
) values (
  'f3750000-0000-0000-0000-000000000001',
  'f3720000-0000-0000-0000-000000000001',
  'f3740000-0000-0000-0000-000000000001',
  'mercedes-one', 'AI Driver One', 'Mercedes', 'Mercedes W16', 12, 'IT', 'PLAYER', 'HumanTag'
);

insert into public.result_versions (
  id, race_id, version_number, status, change_reason
) select
  'f3760000-0000-0000-0000-000000000001',
  r.id,
  1, 'draft', 'Phase 37 attribution regression'
from public.races r
where r.season_id = 'f3720000-0000-0000-0000-000000000001'
  and r.round_number = 1;

insert into public.result_version_rows (
  id, result_version_id, row_order, driver_id, finish_position,
  base_points, awarded_points, points
) values (
  'f3770000-0000-0000-0000-000000000001',
  'f3760000-0000-0000-0000-000000000001',
  1, 'f3740000-0000-0000-0000-000000000002', 1, 25, 25, 25
);

do $$
declare
  points_owner uuid;
  participant_status text;
begin
  select rvr.points_owner_driver_id, rvr.participation_status
    into points_owner, participant_status
  from public.result_version_rows rvr
  where rvr.id = 'f3770000-0000-0000-0000-000000000001';

  if points_owner <> 'f3740000-0000-0000-0000-000000000001'::uuid
     or participant_status <> 'BOT' then
    raise exception 'AI result did not retain BOT identity with human points ownership';
  end if;
end;
$$;

select set_config('request.headers', '{"x-rcc-league-slug":"ai-attribution-league"}', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"f3700000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select public.assign_season_driver_ai(
  'f3740000-0000-0000-0000-000000000001',
  'f3740000-0000-0000-0000-000000000003',
  2
);

do $$
declare
  resolved_owner uuid;
begin
  select a.points_owner_driver_id into resolved_owner
  from private.resolve_season_driver_attribution(
    'f3720000-0000-0000-0000-000000000001', 1,
    'f3740000-0000-0000-0000-000000000002'
  ) a;
  if resolved_owner <> 'f3740000-0000-0000-0000-000000000001'::uuid then
    raise exception 'mid-season change rewrote the previous AI points owner';
  end if;

  select a.points_owner_driver_id into resolved_owner
  from private.resolve_season_driver_attribution(
    'f3720000-0000-0000-0000-000000000001', 2,
    'f3740000-0000-0000-0000-000000000003'
  ) a;
  if resolved_owner <> 'f3740000-0000-0000-0000-000000000001'::uuid then
    raise exception 'new AI driver points were not assigned to the human driver';
  end if;

  select a.points_owner_driver_id into resolved_owner
  from private.resolve_season_driver_attribution(
    'f3720000-0000-0000-0000-000000000001', 2,
    'f3740000-0000-0000-0000-000000000001'
  ) a;
  if resolved_owner <> 'f3740000-0000-0000-0000-000000000001'::uuid then
    raise exception 'human race result did not keep human points ownership';
  end if;

  select a.points_owner_driver_id into resolved_owner
  from private.resolve_season_driver_attribution(
    'f3720000-0000-0000-0000-000000000001', 2,
    'f3740000-0000-0000-0000-000000000002'
  ) a;
  if resolved_owner <> 'f3740000-0000-0000-0000-000000000002'::uuid then
    raise exception 'former AI driver still routed points after the assignment ended';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'private'
      and table_name = 'season_driver_ai_assignments'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception 'browser role received direct AI assignment history access';
  end if;
end;
$$;

-- Legacy human profiles also carry an AI name: it identifies their seat, not
-- whether they or a substitute bot drove this particular race.
insert into public.drivers (id, league_id, display_name, gamertag, ai_driver_reference)
values
  ('f3740000-0000-0000-0000-000000000004', 'f3710000-0000-0000-0000-000000000001', 'Legacy Player', 'LegacyTag', 'Nico Hulkenberg'),
  ('f3740000-0000-0000-0000-000000000005', 'f3710000-0000-0000-0000-000000000001', 'Legacy Substitute', 'SubTag', 'Liam Lawson');

insert into public.result_version_rows (
  result_version_id, row_order, driver_id, finish_position, participation_status,
  base_points, awarded_points, points
) values
  ('f3760000-0000-0000-0000-000000000001', 2, 'f3740000-0000-0000-0000-000000000004', 2, 'PLAYER', 18, 18, 18),
  ('f3760000-0000-0000-0000-000000000001', 3, 'f3740000-0000-0000-0000-000000000005', 3, 'BOT', 15, 15, 15);

insert into public.race_results (
  race_id, result_version_id, driver_id, finish_position, participation_status,
  base_points, awarded_points, points
)
select rv.race_id, rvr.result_version_id, rvr.driver_id, rvr.finish_position,
  rvr.participation_status, rvr.base_points, rvr.awarded_points, rvr.points
from public.result_version_rows rvr
join public.result_versions rv on rv.id = rvr.result_version_id
where rv.id = 'f3760000-0000-0000-0000-000000000001';

-- Exercise UPDATE as well as INSERT; changing attribution must not turn a
-- legacy player's published result into a BOT result again.
update public.race_results
set points_owner_driver_id = points_owner_driver_id
where result_version_id = 'f3760000-0000-0000-0000-000000000001';
update public.result_version_rows
set points_owner_driver_id = points_owner_driver_id
where result_version_id = 'f3760000-0000-0000-0000-000000000001';

do $$
begin
  if private.result_participation_status('Nico Hulkenberg', 'PLAYER') <> 'PLAYER'
     or private.result_participation_status('Nico Hulkenberg', 'BOT') <> 'BOT'
     or private.result_participation_status(null, 'BOT') <> 'BOT'
     or private.result_participation_status('', null) <> 'PLAYER'
     or private.result_participation_status('f1_25:mercedes-one', 'PLAYER') <> 'BOT'
     or private.result_participation_status('f1_26:mercedes-one', null) <> 'BOT' then
    raise exception 'legacy participation or canonical AI classification regressed';
  end if;

  if exists (
    select 1 from (
      select driver_id, participation_status, awarded_points
      from public.result_version_rows
      where result_version_id = 'f3760000-0000-0000-0000-000000000001'
      union all
      select driver_id, participation_status, awarded_points
      from public.race_results
      where result_version_id = 'f3760000-0000-0000-0000-000000000001'
    ) facts
    where (driver_id = 'f3740000-0000-0000-0000-000000000004' and (participation_status <> 'PLAYER' or awarded_points <> 18))
       or (driver_id = 'f3740000-0000-0000-0000-000000000005' and (participation_status <> 'BOT' or awarded_points <> 15))
       or (driver_id = 'f3740000-0000-0000-0000-000000000002' and (participation_status <> 'BOT' or awarded_points <> 25))
  ) then
    raise exception 'legacy PLAYER/BOT status or points changed during attribution';
  end if;

  if has_function_privilege('anon', 'private.result_participation_status(text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.result_participation_status(text,text)', 'EXECUTE') then
    raise exception 'internal participation helper was exposed to browser roles';
  end if;
end;
$$;

rollback;
