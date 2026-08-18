-- Remove verified RaceVora production test tenants.
-- Safety rules:
--   * only the four exact, currently verified test slugs are eligible
--   * productive RCC is explicitly protected
--   * abort if any test tenant has seasons, drivers, teams, AI usage or track notes
--   * remove test contract confirmations before deleting leagues
-- League content/memberships are test bootstrap artefacts and cascade with the league.
-- trg_sync_league_registration_keys removes the deterministic registration keys.

do $$
declare
  v_target_ids uuid[];
  v_count integer;
begin
  select array_agg(id order by slug), count(*)
    into v_target_ids, v_count
  from public.leagues
  where slug in ('abc-test', 'ts-test', 'beta-contract-test', 'beta-contract-test-2');

  if v_count <> 4 then
    raise exception 'Expected exactly four verified test leagues, found %', v_count;
  end if;

  if exists (select 1 from public.leagues where id = any(v_target_ids) and slug = 'rcc') then
    raise exception 'Protected RCC tenant entered cleanup scope';
  end if;

  if exists (select 1 from public.seasons where league_id = any(v_target_ids)) then
    raise exception 'Test-league cleanup aborted: season data exists';
  end if;
  if exists (select 1 from public.drivers where league_id = any(v_target_ids)) then
    raise exception 'Test-league cleanup aborted: driver data exists';
  end if;
  if exists (select 1 from public.teams where league_id = any(v_target_ids)) then
    raise exception 'Test-league cleanup aborted: team data exists';
  end if;
  if exists (select 1 from public.ai_analysis_usage where league_id = any(v_target_ids)) then
    raise exception 'Test-league cleanup aborted: AI usage exists';
  end if;
  if exists (select 1 from public.driver_track_notes where league_id = any(v_target_ids)) then
    raise exception 'Test-league cleanup aborted: track notes exist';
  end if;

  delete from public.contract_confirmations
  where league_id = any(v_target_ids);

  delete from public.leagues
  where id = any(v_target_ids);
end
$$;
