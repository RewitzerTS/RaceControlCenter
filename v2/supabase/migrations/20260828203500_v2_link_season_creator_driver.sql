-- Link a league creator's own player seat to the existing global driver identity.
-- Other player seats continue to use the explicit invitation/claim workflow.

create or replace function private.link_season_creator_driver_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league_id uuid;
  target_gamertag text;
  target_identity_id uuid;
  saved_claim_id uuid;
begin
  if new.participant_type <> 'PLAYER' or actor_id is null then
    return new;
  end if;

  select s.league_id, d.gamertag
    into target_league_id, target_gamertag
  from public.seasons s
  join public.drivers d on d.id = new.driver_id
  where s.id = new.season_id;

  if target_league_id is null
     or nullif(btrim(target_gamertag), '') is null
     or not private.has_league_capability(target_league_id, 'league_admin') then
    return new;
  end if;

  select di.id into target_identity_id
  from public.driver_identities di
  where di.user_id = actor_id
    and di.status = 'active'
    and lower(di.gamertag) = lower(target_gamertag)
  limit 1;

  if target_identity_id is null
     or exists (
       select 1 from public.driver_identity_links dil
       where dil.driver_id = new.driver_id
     ) then
    return new;
  end if;

  insert into public.driver_claims (
    driver_id, claimant_user_id, verification_method, status,
    resolved_at, resolved_by
  ) values (
    new.driver_id, actor_id, 'admin_verified', 'verified', now(), actor_id
  ) returning id into saved_claim_id;

  insert into public.driver_identity_links (driver_identity_id, driver_id, claim_id)
  values (target_identity_id, new.driver_id, saved_claim_id);

  return new;
end;
$$;

revoke all on function private.link_season_creator_driver_identity()
  from public, anon, authenticated, service_role;

drop trigger if exists season_assignments_link_creator_identity
  on public.season_driver_assignments;
create trigger season_assignments_link_creator_identity
after insert on public.season_driver_assignments
for each row execute function private.link_season_creator_driver_identity();

comment on function private.link_season_creator_driver_identity() is
  'Links the authenticated league admin to their own matching player seat while preserving the claim audit trail.';
