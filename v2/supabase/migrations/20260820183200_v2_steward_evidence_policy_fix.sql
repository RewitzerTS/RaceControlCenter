-- Phase 16 staging correction: keep private-evidence staff checks behind a safe actor-bound helper.

create or replace function private.can_read_private_steward_case(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.steward_cases sc
      where sc.id = p_case_id
        and public.matches_requested_league(sc.league_id)
        and private.has_league_capability(sc.league_id, 'steward')
    );
$$;

revoke all on function private.can_read_private_steward_case(uuid) from public, anon, authenticated, service_role;
grant execute on function private.can_read_private_steward_case(uuid) to anon, authenticated;

drop policy "v2 readable public steward evidence" on public.steward_evidence;
create policy "v2 readable public steward evidence"
on public.steward_evidence for select to anon, authenticated
using (
  (select private.can_read_steward_case(case_id))
  and (is_public or (select private.can_read_private_steward_case(case_id)))
);
