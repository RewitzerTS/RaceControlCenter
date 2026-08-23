-- Phase 22 owner-only Demo league, complete scenario coverage and global-progression isolation.
-- Assertions are read-only and wrapped in a rollback transaction.

begin;

do $$
declare
  demo_league_id constant uuid := '22000000-1000-4000-8000-000000000001';
begin
  if not exists (
    select 1 from public.leagues
    where id = demo_league_id and slug = 'demo' and not is_public
      and settings @> '{"owner_only":true,"published":false,"progression_scope":"demo_only"}'::jsonb
  ) then raise exception 'Demo league is not private and isolated'; end if;

  if (select count(*) from public.demo_driver_profiles where league_id = demo_league_id) <> 6 then
    raise exception 'Demo league does not contain exactly six registered drivers';
  end if;

  if exists (
    select 1 from public.driver_identity_links dil
    join public.drivers d on d.id = dil.driver_id
    where d.league_id = demo_league_id
  ) then raise exception 'Demo driver leaked into global Driver Identity progression'; end if;

  if not exists (select 1 from public.race_results rr join public.drivers d on d.id = rr.driver_id where d.league_id = demo_league_id and rr.classification_status = 'dns')
     or not exists (select 1 from public.race_results rr join public.drivers d on d.id = rr.driver_id where d.league_id = demo_league_id and rr.classification_status = 'dnf')
     or not exists (select 1 from public.race_results rr join public.drivers d on d.id = rr.driver_id where d.league_id = demo_league_id and rr.classification_status = 'dsq') then
    raise exception 'Demo classification coverage is incomplete';
  end if;

  if not exists (
    select 1 from public.result_versions rv
    join public.races r on r.id = rv.race_id
    join public.seasons s on s.id = r.season_id
    where s.league_id = demo_league_id and rv.status = 'superseded'
  ) or not exists (
    select 1 from public.result_versions rv
    join public.races r on r.id = rv.race_id
    join public.seasons s on s.id = r.season_id
    where s.league_id = demo_league_id and rv.status = 'active' and rv.previous_version_id is not null
  ) then raise exception 'Demo result revision lifecycle is incomplete'; end if;
end;
$$;

-- A normal signed-in user cannot enter the owner snapshot.
select set_config('request.jwt.claims', '{"sub":"22000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.get_demo_full_e2e_snapshot();
    raise exception 'Non-owner entered Demo Full E2E snapshot';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
