begin;

select plan(22);

select has_function('public', 'get_league_member_admin_workspace', array[]::text[], 'member admin workspace RPC exists');
select has_function('public', 'add_existing_league_member_by_email', array['text', 'text'], 'member add RPC exists');
select has_function('public', 'set_league_member_role', array['uuid', 'text'], 'member role RPC exists');
select has_function('public', 'remove_league_member', array['uuid'], 'member removal RPC exists');
select has_function('public', 'get_league_driver_admin_workspace', array[]::text[], 'driver admin workspace RPC exists');
select has_function('public', 'upsert_league_driver', array['text', 'uuid', 'text', 'integer', 'text', 'text', 'text', 'boolean'], 'driver upsert RPC exists');

select function_returns('public', 'get_league_member_admin_workspace', array[]::text[], 'jsonb', 'member workspace returns JSON');
select function_returns('public', 'get_league_driver_admin_workspace', array[]::text[], 'jsonb', 'driver workspace returns JSON');
select function_returns('public', 'upsert_league_driver', array['text', 'uuid', 'text', 'integer', 'text', 'text', 'text', 'boolean'], 'jsonb', 'driver upsert returns JSON');

select function_privs_are('public', 'get_league_member_admin_workspace', array[]::text[], 'anon', array[]::text[], 'anonymous member workspace access is denied');
select function_privs_are('public', 'add_existing_league_member_by_email', array['text', 'text'], 'anon', array[]::text[], 'anonymous member adds are denied');
select function_privs_are('public', 'set_league_member_role', array['uuid', 'text'], 'anon', array[]::text[], 'anonymous role writes are denied');
select function_privs_are('public', 'remove_league_member', array['uuid'], 'anon', array[]::text[], 'anonymous member removals are denied');
select function_privs_are('public', 'get_league_driver_admin_workspace', array[]::text[], 'anon', array[]::text[], 'anonymous driver workspace access is denied');
select function_privs_are('public', 'upsert_league_driver', array['text', 'uuid', 'text', 'integer', 'text', 'text', 'text', 'boolean'], 'anon', array[]::text[], 'anonymous driver writes are denied');

select ok(has_function_privilege('authenticated', 'public.get_league_member_admin_workspace()', 'EXECUTE'), 'authenticated actors may reach guarded member workspace');
select ok(has_function_privilege('authenticated', 'public.add_existing_league_member_by_email(text,text)', 'EXECUTE'), 'authenticated actors may reach guarded member add');
select ok(has_function_privilege('authenticated', 'public.set_league_member_role(uuid,text)', 'EXECUTE'), 'authenticated actors may reach guarded role update');
select ok(has_function_privilege('authenticated', 'public.remove_league_member(uuid)', 'EXECUTE'), 'authenticated actors may reach guarded member removal');
select ok(has_function_privilege('authenticated', 'public.get_league_driver_admin_workspace()', 'EXECUTE'), 'authenticated actors may reach guarded driver workspace');
select ok(has_function_privilege('authenticated', 'public.upsert_league_driver(text,uuid,text,integer,text,text,text,boolean)', 'EXECUTE'), 'authenticated actors may reach guarded driver upsert');

select is(
  (select count(*) from information_schema.role_table_grants
   where grantee = 'authenticated'
     and table_schema = 'public'
     and table_name in ('league_members', 'drivers')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0::bigint,
  'browser role has no direct member or driver write grants'
);

select * from finish();
rollback;
