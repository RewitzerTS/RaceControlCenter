-- RaceVora V2 Phase 5: exact visible roles and separate global platform ownership.
-- This migration is additive to the V2 staging model and must never run on V1 Production.

alter table public.league_members
  drop constraint league_members_role_check;

update public.league_members
set role = case role
  when 'admin' then 'league_admin'
  when 'owner' then 'league_admin'
  when 'steward' then 'steward'
  when 'member' then 'driver'
  else role
end;

alter table public.league_members
  add constraint league_members_role_check
  check (role in ('driver', 'steward', 'league_admin'));

create or replace function private.require_active_driver_identity_for_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.driver_identities di
    where di.user_id = new.user_id
      and di.status = 'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'A league role requires an active registered driver identity.';
  end if;

  return new;
end;
$$;

revoke all on function private.require_active_driver_identity_for_membership()
  from public, anon, authenticated, service_role;

create trigger league_members_require_active_driver_identity
before insert or update of user_id, role on public.league_members
for each row execute function private.require_active_driver_identity_for_membership();

create or replace function private.has_league_capability(
  p_league_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when p_capability not in ('driver', 'steward', 'league_admin') then false
    when public.is_platform_owner() then true
    else exists (
      select 1
      from public.league_members lm
      join public.leagues l on l.id = lm.league_id
      where lm.league_id = p_league_id
        and lm.user_id = (select auth.uid())
        and l.slug = public.requested_league_slug()
        and (
          lm.role = 'league_admin'
          or (lm.role = 'steward' and p_capability in ('driver', 'steward'))
          or (lm.role = 'driver' and p_capability = 'driver')
        )
    )
  end;
$$;

revoke all on function private.has_league_capability(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.has_league_capability(uuid, text)
  to authenticated;

create or replace function public.current_app_role()
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  resolved_role text;
begin
  if (select auth.uid()) is null then
    return null;
  end if;

  if public.is_platform_owner() then
    return 'platform_owner';
  end if;

  select lm.role
    into resolved_role
  from public.league_members lm
  join public.leagues l on l.id = lm.league_id
  where lm.user_id = (select auth.uid())
    and l.slug = public.requested_league_slug()
  limit 1;

  if resolved_role is not null then
    return resolved_role;
  end if;

  if exists (
    select 1
    from public.driver_identities di
    where di.user_id = (select auth.uid())
      and di.status = 'active'
  ) then
    return 'driver';
  end if;

  return null;
end;
$$;

revoke all on function public.current_app_role()
  from public, anon, authenticated, service_role;
grant execute on function public.current_app_role()
  to authenticated, service_role;

drop policy "v2 users read own membership" on public.league_members;

create policy "v2 permitted users read league memberships"
on public.league_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_platform_owner())
  or (select private.has_league_capability(league_id, 'league_admin'))
);

comment on column public.league_members.role is
  'Exact V2 league role: driver, steward, or league_admin. Platform ownership is never stored here.';
comment on function public.current_app_role() is
  'Actor-bound role resolver. Platform owner wins globally; league role is tenant-bound; active identities fall back to driver.';
comment on function private.has_league_capability(uuid, text) is
  'Internal actor-bound hierarchy check. Non-owner access is bound to the canonical requested league.';
