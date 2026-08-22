-- Phase 23 cross-workspace Platform Owner journey and negative access regressions.
-- Synthetic authorization state is always rolled back.

begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('23000000-0000-4000-8000-000000000001','authenticated','authenticated','owner-phase23@example.invalid','{}','{}',now(),now());
insert into public.platform_owners (user_id)
values ('23000000-0000-4000-8000-000000000001');

select set_config('request.headers', '{"x-rcc-league-slug":"demo"}', true);
select set_config('request.jwt.claims', '{"sub":"23000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  owner_snapshot jsonb;
  demo_snapshot jsonb;
  admin_snapshot jsonb;
  graphics_snapshot jsonb;
begin
  if public.current_app_role() <> 'platform_owner' then
    raise exception 'Owner journey did not resolve the exact global role';
  end if;

  owner_snapshot := public.get_owner_control_snapshot();
  demo_snapshot := public.get_demo_full_e2e_snapshot();
  admin_snapshot := public.get_league_admin_workspace();
  graphics_snapshot := public.get_social_graphics_workspace();

  if not (owner_snapshot -> 'leagues') @> '[{"slug":"demo"}]'::jsonb then
    raise exception 'Owner Control does not expose the private Demo entry';
  end if;
  if demo_snapshot #>> '{league,progression_scope}' <> 'demo_only' then
    raise exception 'Demo journey escaped isolated progression';
  end if;
  if exists (select 1 from jsonb_each(demo_snapshot -> 'coverage') where value <> 'true'::jsonb) then
    raise exception 'Demo journey coverage is incomplete';
  end if;
  if admin_snapshot #>> '{league,slug}' <> 'demo' or graphics_snapshot #>> '{league,slug}' <> 'demo' then
    raise exception 'Owner journey lost Demo tenant context between workspaces';
  end if;
  if (select count(*) from public.steward_cases) <> 1 then
    raise exception 'Owner journey cannot read the Demo Steward decision';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"22000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.get_owner_control_snapshot();
    raise exception 'Non-owner entered owner journey';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_demo_full_e2e_snapshot();
    raise exception 'Non-owner entered owner journey';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.demo_driver_profiles) then
    raise exception 'Demo progression leaked into a normal driver journey';
  end if;
end;
$$;

rollback;
