begin;

select plan(4);

select has_function('private', 'attach_v2_audit_league_scope', array[]::text[], 'league audit scope trigger function exists');
select function_privs_are('private', 'attach_v2_audit_league_scope', array[]::text[], 'authenticated', array[]::text[], 'browser cannot invoke audit scope trigger directly');
select is(
  (select count(*) from information_schema.triggers where event_object_schema = 'public' and event_object_table = 'v2_audit_events' and trigger_name = 'v2_audit_events_attach_league_scope'),
  1::bigint,
  'audit scope trigger is installed exactly once'
);
select like(
  pg_get_functiondef('private.attach_v2_audit_league_scope()'::regprocedure),
  '%new.metadata%league_id%',
  'league id is derived from immutable audit metadata'
);

select * from finish();
rollback;
