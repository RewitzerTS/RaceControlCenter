-- RaceVora V2 Phase 4 hardening: linked claim evidence is fully immutable.
-- This migration is additive and must never be applied to the Production project.

create or replace function private.protect_linked_driver_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.driver_identity_links dil
    where dil.claim_id = old.id
  ) and new is distinct from old then
    raise exception using
      errcode = '23514',
      message = 'Claim evidence used by a driver identity link is immutable.';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_linked_driver_claim()
  from public, anon, authenticated, service_role;
