begin;

select plan(5);
select has_function('public', 'get_league_race_admin_workspace', array[]::text[], 'race admin workspace exists');
select function_returns('public', 'get_league_race_admin_workspace', array[]::text[], 'jsonb', 'race workspace returns JSON');
select function_privs_are('public', 'get_league_race_admin_workspace', array[]::text[], 'anon', array[]::text[], 'anonymous race admin access is denied');
select ok(has_function_privilege('authenticated', 'public.get_league_race_admin_workspace()', 'EXECUTE'), 'authenticated actor may reach guarded race workspace');
select isnt((select proconfig from pg_proc where oid = 'public.get_league_race_admin_workspace()'::regprocedure), null, 'race workspace fixes its search path');
select * from finish();
rollback;
