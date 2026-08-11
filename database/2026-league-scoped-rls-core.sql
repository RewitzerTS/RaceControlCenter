-- Race Control Center - league-scoped RLS core
-- Replaces global app-admin policies on core tenant data with per-league authorization.

begin;

create or replace function public.is_league_member(check_league_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.league_members lm
    where lm.league_id = check_league_id
      and lm.user_id = check_user_id
  );
$$;

create or replace function public.has_league_role(check_league_id uuid, allowed_roles text[], check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.league_members lm
    where lm.league_id = check_league_id
      and lm.user_id = check_user_id
      and lm.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_league_member(uuid, uuid) from public;
revoke all on function public.has_league_role(uuid, text[], uuid) from public;
grant execute on function public.is_league_member(uuid, uuid) to authenticated;
grant execute on function public.has_league_role(uuid, text[], uuid) to authenticated;

-- seasons
drop policy if exists "public read seasons" on public.seasons;
drop policy if exists "admins manage seasons" on public.seasons;
create policy "read league seasons" on public.seasons for select to anon, authenticated
using (exists (select 1 from public.leagues l where l.id = seasons.league_id and (l.is_public = true or public.is_league_member(l.id))));
create policy "league admins manage seasons" on public.seasons for all to authenticated
using (public.has_league_role(league_id, array['owner','admin']))
with check (public.has_league_role(league_id, array['owner','admin']));

-- drivers
drop policy if exists "public read drivers" on public.drivers;
drop policy if exists "admins manage drivers" on public.drivers;
create policy "read league drivers" on public.drivers for select to anon, authenticated
using (exists (select 1 from public.leagues l where l.id = drivers.league_id and (l.is_public = true or public.is_league_member(l.id))));
create policy "league admins manage drivers" on public.drivers for all to authenticated
using (public.has_league_role(league_id, array['owner','admin']))
with check (public.has_league_role(league_id, array['owner','admin']));

-- league content
drop policy if exists "public read league content" on public.league_content;
drop policy if exists "admins manage league content" on public.league_content;
create policy "read league content" on public.league_content for select to anon, authenticated
using (exists (select 1 from public.leagues l where l.id = league_content.league_id and (l.is_public = true or public.is_league_member(l.id))));
create policy "league admins manage league content" on public.league_content for all to authenticated
using (public.has_league_role(league_id, array['owner','admin']))
with check (public.has_league_role(league_id, array['owner','admin']));

-- races
drop policy if exists "public read races" on public.races;
drop policy if exists "admins manage races" on public.races;
create policy "read league races" on public.races for select to anon, authenticated
using (exists (select 1 from public.seasons s join public.leagues l on l.id=s.league_id where s.id=races.season_id and (l.is_public=true or public.is_league_member(l.id))));
create policy "league admins manage races" on public.races for all to authenticated
using (exists (select 1 from public.seasons s where s.id=races.season_id and public.has_league_role(s.league_id,array['owner','admin'])))
with check (exists (select 1 from public.seasons s where s.id=races.season_id and public.has_league_role(s.league_id,array['owner','admin'])));

-- race results
drop policy if exists "public read race results" on public.race_results;
drop policy if exists "admins manage race results" on public.race_results;
create policy "read league race results" on public.race_results for select to anon, authenticated
using (exists (select 1 from public.races r join public.seasons s on s.id=r.season_id join public.leagues l on l.id=s.league_id where r.id=race_results.race_id and (l.is_public=true or public.is_league_member(l.id))));
create policy "league admins manage race results" on public.race_results for all to authenticated
using (exists (select 1 from public.races r join public.seasons s on s.id=r.season_id where r.id=race_results.race_id and public.has_league_role(s.league_id,array['owner','admin'])))
with check (exists (select 1 from public.races r join public.seasons s on s.id=r.season_id where r.id=race_results.race_id and public.has_league_role(s.league_id,array['owner','admin'])));

-- championship history
drop policy if exists "public read championship history" on public.championship_history;
drop policy if exists "admins manage championship history" on public.championship_history;
create policy "read league championship history" on public.championship_history for select to anon, authenticated
using (exists (select 1 from public.seasons s join public.leagues l on l.id=s.league_id where s.id=championship_history.season_id and (l.is_public=true or public.is_league_member(l.id))));
create policy "league admins manage championship history" on public.championship_history for all to authenticated
using (exists (select 1 from public.seasons s where s.id=championship_history.season_id and public.has_league_role(s.league_id,array['owner','admin'])))
with check (exists (select 1 from public.seasons s where s.id=championship_history.season_id and public.has_league_role(s.league_id,array['owner','admin'])));

-- internal result imports
drop policy if exists "public read race result imports" on public.race_result_imports;
drop policy if exists "admins manage race result imports" on public.race_result_imports;
create policy "league admins read race result imports" on public.race_result_imports for select to authenticated
using (exists (select 1 from public.races r join public.seasons s on s.id=r.season_id where r.id=race_result_imports.race_id and public.has_league_role(s.league_id,array['owner','admin'])));
create policy "league admins manage race result imports" on public.race_result_imports for all to authenticated
using (exists (select 1 from public.races r join public.seasons s on s.id=r.season_id where r.id=race_result_imports.race_id and public.has_league_role(s.league_id,array['owner','admin'])))
with check (exists (select 1 from public.races r join public.seasons s on s.id=r.season_id where r.id=race_result_imports.race_id and public.has_league_role(s.league_id,array['owner','admin'])));

drop policy if exists "public read race result import rows" on public.race_result_import_rows;
drop policy if exists "admins manage race result import rows" on public.race_result_import_rows;
create policy "league admins read race result import rows" on public.race_result_import_rows for select to authenticated
using (exists (select 1 from public.race_result_imports i join public.races r on r.id=i.race_id join public.seasons s on s.id=r.season_id where i.id=race_result_import_rows.import_id and public.has_league_role(s.league_id,array['owner','admin'])));
create policy "league admins manage race result import rows" on public.race_result_import_rows for all to authenticated
using (exists (select 1 from public.race_result_imports i join public.races r on r.id=i.race_id join public.seasons s on s.id=r.season_id where i.id=race_result_import_rows.import_id and public.has_league_role(s.league_id,array['owner','admin'])))
with check (exists (select 1 from public.race_result_imports i join public.races r on r.id=i.race_id join public.seasons s on s.id=r.season_id where i.id=race_result_import_rows.import_id and public.has_league_role(s.league_id,array['owner','admin'])));

-- steward cases
drop policy if exists "public read steward cases" on public.steward_cases;
drop policy if exists "admins manage steward cases" on public.steward_cases;
create policy "read published steward cases" on public.steward_cases for select to anon, authenticated
using (status='closed' and exists (select 1 from public.races r join public.seasons s on s.id=r.season_id join public.leagues l on l.id=s.league_id where r.id=steward_cases.race_id and l.is_public=true));
create policy "league staff read steward cases" on public.steward_cases for select to authenticated
using (exists (select 1 from public.races r join public.seasons s on s.id=r.season_id where r.id=steward_cases.race_id and public.has_league_role(s.league_id,array['owner','admin','steward'])));
create policy "league staff manage steward cases" on public.steward_cases for all to authenticated
using (exists (select 1 from public.races r join public.seasons s on s.id=r.season_id where r.id=steward_cases.race_id and public.has_league_role(s.league_id,array['owner','admin','steward'])))
with check (exists (select 1 from public.races r join public.seasons s on s.id=r.season_id where r.id=steward_cases.race_id and public.has_league_role(s.league_id,array['owner','admin','steward'])));

-- penalties
drop policy if exists "public read penalties" on public.race_penalties;
drop policy if exists "admins manage penalties" on public.race_penalties;
create policy "read league penalties" on public.race_penalties for select to anon, authenticated
using (exists (select 1 from public.races r join public.seasons s on s.id=r.season_id join public.leagues l on l.id=s.league_id where r.id=race_penalties.race_id and (l.is_public=true or public.is_league_member(l.id))));
create policy "league staff manage penalties" on public.race_penalties for all to authenticated
using (exists (select 1 from public.races r join public.seasons s on s.id=r.season_id where r.id=race_penalties.race_id and public.has_league_role(s.league_id,array['owner','admin','steward'])))
with check (exists (select 1 from public.races r join public.seasons s on s.id=r.season_id where r.id=race_penalties.race_id and public.has_league_role(s.league_id,array['owner','admin','steward'])));

commit;
