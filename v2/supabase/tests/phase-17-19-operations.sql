-- Phases 17-19 tenant admin, owner separation, audit immutability and private notification regressions.
-- Synthetic fixtures are always rolled back.

begin;

do $$
begin
  if has_table_privilege('authenticated', 'public.platform_feature_flags', 'update')
     or has_table_privilege('authenticated', 'public.user_notifications', 'insert')
     or has_table_privilege('authenticated', 'public.v2_audit_events', 'delete') then
    raise exception 'browser roles can bypass controlled operations endpoints';
  end if;
  if has_function_privilege('anon', 'public.get_owner_control_snapshot()', 'execute')
     or has_function_privilege('authenticated', 'public.enqueue_race_summary_notification(uuid,uuid,uuid,jsonb,text)', 'execute') then
    raise exception 'privileged operations endpoint is exposed to the wrong role';
  end if;
end;
$$;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('f1700000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin-1719@example.invalid', '{}', '{}', now(), now()),
  ('f1800000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-1719@example.invalid', '{}', '{}', now(), now()),
  ('f1900000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'driver-1719@example.invalid', '{}', '{}', now(), now()),
  ('f1900000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'other-1719@example.invalid', '{}', '{}', now(), now());

insert into public.driver_identities (id, user_id) values
  ('f1710000-0000-0000-0000-000000000001', 'f1700000-0000-0000-0000-000000000001'),
  ('f1910000-0000-0000-0000-000000000001', 'f1900000-0000-0000-0000-000000000001'),
  ('f1910000-0000-0000-0000-000000000002', 'f1900000-0000-0000-0000-000000000002');

insert into public.leagues (id, name, slug) values
  ('f1720000-0000-0000-0000-000000000001', 'Operations Alpha', 'operations-alpha'),
  ('f1720000-0000-0000-0000-000000000002', 'Operations Beta', 'operations-beta');
insert into public.league_members (league_id, user_id, role) values
  ('f1720000-0000-0000-0000-000000000001', 'f1700000-0000-0000-0000-000000000001', 'league_admin'),
  ('f1720000-0000-0000-0000-000000000001', 'f1900000-0000-0000-0000-000000000001', 'driver');
insert into public.platform_owners (user_id) values ('f1800000-0000-0000-0000-000000000001');

select set_config('request.headers', '{"x-rcc-league-slug":"operations-alpha"}', true);
select set_config('request.jwt.claims', '{"sub":"f1700000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare snapshot jsonb;
begin
  snapshot := public.get_league_admin_workspace();
  if snapshot #>> '{league,slug}' <> 'operations-alpha' then raise exception 'admin snapshot escaped tenant context'; end if;
  begin
    perform public.get_owner_control_snapshot();
    raise exception 'league admin entered global Owner Control';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"f1800000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare snapshot jsonb;
begin
  snapshot := public.get_owner_control_snapshot();
  if jsonb_array_length(snapshot -> 'leagues') < 2 then raise exception 'Owner Control lacks global league visibility'; end if;
  perform public.set_platform_feature_flag('notifications_v2', false);
  if (select enabled from public.platform_feature_flags where flag_key = 'notifications_v2') then raise exception 'owner flag update failed'; end if;
end;
$$;

reset role;
set local role service_role;
select public.enqueue_race_summary_notification(
  'f1900000-0000-0000-0000-000000000001',
  'f1720000-0000-0000-0000-000000000001',
  null,
  '{"result":1,"xp":100,"vc":25,"level":2,"achievements":[],"challenges":[]}',
  'phase19-race-summary-driver-one'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"f1900000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare notification_id uuid;
begin
  select id into notification_id from public.user_notifications;
  if notification_id is null then raise exception 'recipient cannot read own notification'; end if;
  perform public.mark_notification_read(notification_id);
  if (select read_at from public.user_notifications where id = notification_id) is null then raise exception 'notification was not marked read'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"f1900000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.user_notifications) then raise exception 'notification leaked to another user'; end if;
end;
$$;

reset role;
do $$
begin
  begin
    update public.v2_audit_events set action = 'rewritten';
    raise exception 'audit history was mutable';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;

rollback;
