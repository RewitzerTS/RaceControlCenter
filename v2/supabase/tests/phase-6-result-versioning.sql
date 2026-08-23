-- RaceVora V2 Phase 6 versioning, projection, immutability, void, and RLS regressions.
-- Synthetic fixtures are always rolled back.

begin;

do $$
begin
  if has_table_privilege('authenticated', 'public.result_versions', 'insert')
     or has_table_privilege('authenticated', 'public.result_version_rows', 'update')
     or has_table_privilege('authenticated', 'public.race_results', 'delete') then
    raise exception 'result workflow mutations are exposed to authenticated browser clients';
  end if;

  if has_function_privilege('authenticated', 'private.activate_result_version(uuid)', 'execute')
     or has_function_privilege('anon', 'private.void_current_result_version(uuid,text)', 'execute') then
    raise exception 'server-only result lifecycle functions are exposed to browser roles';
  end if;
end;
$$;

insert into public.leagues (id, name, slug, is_public, settings)
values
  ('61000000-0000-0000-0000-000000000001', 'Phase Six Alpha', 'phase-six-alpha', true, '{"published": true}'),
  ('62000000-0000-0000-0000-000000000002', 'Phase Six Beta', 'phase-six-beta', true, '{"published": true}');

insert into public.seasons (id, league_id, slug, name)
values
  ('61100000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'season-one', 'Season One'),
  ('62100000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000002', 'season-one', 'Season One');

insert into public.races (id, season_id, round_number, grand_prix_name)
values
  ('61200000-0000-0000-0000-000000000001', '61100000-0000-0000-0000-000000000001', 1, 'Alpha Grand Prix'),
  ('62200000-0000-0000-0000-000000000002', '62100000-0000-0000-0000-000000000002', 1, 'Beta Grand Prix');

insert into public.drivers (id, league_id, display_name)
values
  ('61300000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'Alpha Driver One'),
  ('61300000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001', 'Alpha Driver Two'),
  ('62300000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000002', 'Beta Driver One');

do $$
declare
  alpha_v1 uuid;
  alpha_v2 uuid;
  alpha_draft uuid;
  beta_v1 uuid;
  pointer_id uuid;
  projection_count integer;
  history_count integer;
begin
  alpha_v1 := private.create_result_version(
    '61200000-0000-0000-0000-000000000001',
    'Initial reviewed publication'
  );

  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, finish_position, awarded_points, points
  ) values
    (alpha_v1, 1, '61300000-0000-0000-0000-000000000001', 1, 25, 25),
    (alpha_v1, 2, '61300000-0000-0000-0000-000000000002', 2, 18, 18);

  perform private.validate_result_version(alpha_v1);
  perform private.activate_result_version(alpha_v1);

  select current_result_version_id into pointer_id
  from public.races where id = '61200000-0000-0000-0000-000000000001';
  if pointer_id is distinct from alpha_v1 then
    raise exception 'first activation did not set the explicit current pointer';
  end if;

  select count(*) into projection_count
  from public.race_results
  where race_id = '61200000-0000-0000-0000-000000000001'
    and result_version_id = alpha_v1;
  if projection_count <> 2 then
    raise exception 'first activation did not build the current projection';
  end if;

  alpha_v2 := private.create_result_version(
    '61200000-0000-0000-0000-000000000001',
    'Steward correction after review',
    alpha_v1
  );

  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, finish_position,
    penalty_time_delta_ms, awarded_points, points
  ) values
    (alpha_v2, 1, '61300000-0000-0000-0000-000000000002', 1, 0, 25, 25),
    (alpha_v2, 2, '61300000-0000-0000-0000-000000000001', 2, 5000, 18, 18);

  perform private.validate_result_version(alpha_v2);
  perform private.activate_result_version(alpha_v2);

  if (select status from public.result_versions where id = alpha_v1) <> 'superseded'
     or (select status from public.result_versions where id = alpha_v2) <> 'active' then
    raise exception 'revision did not preserve and supersede the previous official version';
  end if;

  select current_result_version_id into pointer_id
  from public.races where id = '61200000-0000-0000-0000-000000000001';
  if pointer_id is distinct from alpha_v2 then
    raise exception 'revision did not move the explicit current pointer';
  end if;

  if (select count(*) from public.result_version_rows where result_version_id = alpha_v1) <> 2 then
    raise exception 'revision overwrote historical version rows';
  end if;

  if exists (
    select 1 from public.race_results
    where race_id = '61200000-0000-0000-0000-000000000001'
      and result_version_id <> alpha_v2
  ) or (select count(*) from public.race_results where race_id = '61200000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'revision projection does not exclusively represent the explicit current version';
  end if;

  begin
    update public.result_version_rows set awarded_points = 0
    where result_version_id = alpha_v1;
    raise exception 'superseded official result rows were mutable';
  exception when check_violation then null;
  end;

  begin
    update public.result_versions set change_reason = 'Rewritten evidence'
    where id = alpha_v1;
    raise exception 'superseded official version metadata was mutable';
  exception when check_violation then null;
  end;

  begin
    update public.result_versions set activated_at = activated_at + interval '1 minute'
    where id = alpha_v1;
    raise exception 'official lifecycle audit evidence was mutable';
  exception when check_violation then null;
  end;

  alpha_draft := private.create_result_version(
    '61200000-0000-0000-0000-000000000001',
    'Unpublished follow-up draft',
    alpha_v2
  );

  begin
    insert into public.result_version_rows (
      result_version_id, row_order, driver_id, finish_position
    ) values (
      alpha_draft, 1, '62300000-0000-0000-0000-000000000001', 1
    );
    raise exception 'cross-tenant driver was accepted into result version';
  exception when check_violation then null;
  end;

  beta_v1 := private.create_result_version(
    '62200000-0000-0000-0000-000000000002',
    'Beta initial reviewed publication'
  );
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, finish_position, awarded_points, points
  ) values (
    beta_v1, 1, '62300000-0000-0000-0000-000000000001', 1, 25, 25
  );
  perform private.validate_result_version(beta_v1);
  perform private.activate_result_version(beta_v1);

  begin
    update public.races
    set current_result_version_id = beta_v1
    where id = '61200000-0000-0000-0000-000000000001';
    raise exception 'a race accepted another race current result pointer';
  exception when check_violation then null;
  end;

  select count(*) into history_count
  from public.result_versions
  where race_id = '61200000-0000-0000-0000-000000000001';
  if history_count <> 3 then
    raise exception 'expected two official versions and one draft, found %', history_count;
  end if;

  perform set_config('phase6.alpha_v1', alpha_v1::text, true);
  perform set_config('phase6.alpha_v2', alpha_v2::text, true);
  perform set_config('phase6.alpha_draft', alpha_draft::text, true);
end;
$$;

select set_config('request.headers', '{"x-rcc-league-slug":"phase-six-alpha"}', true);
set local role anon;

do $$
begin
  if (select count(*) from public.seasons) <> 1 then
    raise exception 'anonymous season read crossed tenant context';
  end if;
  if (select count(*) from public.races) <> 1 then
    raise exception 'anonymous race read crossed tenant context';
  end if;
  if (select count(*) from public.result_versions) <> 2 then
    raise exception 'official history read leaked a draft or another tenant';
  end if;
  if (select count(*) from public.result_version_rows) <> 4 then
    raise exception 'official version rows crossed publication or tenant boundaries';
  end if;
  if (select count(*) from public.race_results) <> 2 then
    raise exception 'current projection read crossed tenant context';
  end if;
end;
$$;

reset role;

do $$
declare
  alpha_v2 uuid := current_setting('phase6.alpha_v2')::uuid;
begin
  perform private.void_current_result_version(
    '61200000-0000-0000-0000-000000000001',
    'Official result withdrawn for renewed review'
  );

  if (select current_result_version_id from public.races where id = '61200000-0000-0000-0000-000000000001') is not null then
    raise exception 'void did not clear the explicit current pointer';
  end if;
  if exists (select 1 from public.race_results where race_id = '61200000-0000-0000-0000-000000000001') then
    raise exception 'void did not clear the current projection';
  end if;
  if (select status from public.result_versions where id = alpha_v2) <> 'void' then
    raise exception 'void did not preserve the withdrawn version in history';
  end if;

  begin
    delete from public.result_versions where id = alpha_v2;
    raise exception 'void official version was hard-deleted';
  exception when check_violation then null;
  end;
end;
$$;

rollback;
