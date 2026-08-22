begin;

select plan(13);

select has_function('public', 'create_league', array['text', 'text', 'boolean'], 'league creation RPC exists');
select has_function('public', 'update_league_branding', array['text', 'text', 'text', 'text', 'text', 'text', 'text'], 'branding RPC exists');
select function_returns('public', 'create_league', array['text', 'text', 'boolean'], 'jsonb', 'league creation returns JSON');
select function_returns('public', 'update_league_branding', array['text', 'text', 'text', 'text', 'text', 'text', 'text'], 'jsonb', 'branding update returns JSON');
select function_privs_are('public', 'create_league', array['text', 'text', 'boolean'], 'anon', array[]::text[], 'anonymous league creation is denied');
select function_privs_are('public', 'update_league_branding', array['text', 'text', 'text', 'text', 'text', 'text', 'text'], 'anon', array[]::text[], 'anonymous branding writes are denied');
select ok(has_function_privilege('authenticated', 'public.create_league(text,text,boolean)', 'EXECUTE'), 'authenticated actors may reach guarded creation RPC');
select ok(has_function_privilege('authenticated', 'public.update_league_branding(text,text,text,text,text,text,text)', 'EXECUTE'), 'authenticated actors may reach guarded branding RPC');
select ok((select public from storage.buckets where id = 'league-brand-assets'), 'league brand bucket is public for logo delivery');
select is((select file_size_limit from storage.buckets where id = 'league-brand-assets'), 2097152::bigint, 'brand logo size is capped at 2 MB');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'v2 % league brand assets'), 3::bigint, 'brand storage has exact read/upload/update policies');
select isnt((select proconfig from pg_proc where oid = 'public.create_league(text,text,boolean)'::regprocedure), null, 'league creation fixes its search path');
select isnt((select proconfig from pg_proc where oid = 'public.update_league_branding(text,text,text,text,text,text,text)'::regprocedure), null, 'branding update fixes its search path');

select * from finish();
rollback;
