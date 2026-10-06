begin;
-- Keep consumed validated imports as immutable evidence, not as open work.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.get_league_configuration_workspace()'::regprocedure) into definition;
  if strpos(definition,'rv.status in (''draft'',''validated'')')=0 then
    raise exception 'Configuration draft query changed; review before migrating.';
  end if;
  execute replace(definition,'rv.status in (''draft'',''validated'')',
    'rv.status in (''draft'',''validated'') and not exists(select 1 from private.steward_publication_receipts receipt where receipt.source_version_id=rv.id)');
end $$;
commit;
