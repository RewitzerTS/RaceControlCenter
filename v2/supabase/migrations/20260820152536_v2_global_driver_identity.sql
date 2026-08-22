-- RaceVora V2 Phase 4: global registered-driver identity and verified legacy claims.
-- This migration is additive and must never be applied to the Production project.

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  gamertag text,
  real_name text,
  nationality_code text,
  number integer,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ai_driver_reference text,
  car_name text,
  league_team text,
  nationality text,
  avatar_url text,
  league_id uuid not null references public.leagues(id) on delete restrict,
  constraint drivers_league_display_name_unique unique (league_id, display_name),
  constraint drivers_nationality_code_format
    check (nationality_code is null or nationality_code ~ '^[A-Z]{2}$')
);

create unique index drivers_league_gamertag_unique_idx
  on public.drivers (league_id, gamertag)
  where gamertag is not null;
create index idx_drivers_league_id on public.drivers (league_id);

create table public.driver_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_identities_user_id_unique unique (user_id),
  constraint driver_identities_status_check
    check (status in ('active', 'suspended'))
);

create table public.driver_claims (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  verification_method text not null,
  status text not null default 'pending',
  proof_token_hash text,
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  constraint driver_claims_verification_method_check
    check (verification_method in ('league_invitation', 'unique_claim_link', 'admin_verified')),
  constraint driver_claims_status_check
    check (status in ('pending', 'verified', 'rejected', 'expired', 'cancelled')),
  constraint driver_claims_token_proof_check
    check (
      (verification_method = 'unique_claim_link' and proof_token_hash ~ '^[0-9a-f]{64}$')
      or (verification_method <> 'unique_claim_link' and proof_token_hash is null)
    ),
  constraint driver_claims_expiry_check
    check (expires_at is null or expires_at > requested_at),
  constraint driver_claims_resolution_check
    check (
      (status = 'pending' and resolved_at is null and resolved_by is null)
      or (status <> 'pending' and resolved_at is not null)
    ),
  constraint driver_claims_admin_verifier_check
    check (
      verification_method <> 'admin_verified'
      or status <> 'verified'
      or resolved_by is not null
    )
);

create index idx_driver_claims_driver_id on public.driver_claims (driver_id);
create index idx_driver_claims_claimant_user_id on public.driver_claims (claimant_user_id);
create index idx_driver_claims_resolved_by on public.driver_claims (resolved_by);
create unique index driver_claims_one_pending_per_driver_user
  on public.driver_claims (driver_id, claimant_user_id)
  where status = 'pending';

create table public.driver_identity_links (
  id uuid primary key default gen_random_uuid(),
  driver_identity_id uuid not null references public.driver_identities(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  claim_id uuid not null references public.driver_claims(id) on delete cascade,
  linked_at timestamptz not null default now(),
  constraint driver_identity_links_driver_id_unique unique (driver_id),
  constraint driver_identity_links_claim_id_unique unique (claim_id),
  constraint driver_identity_links_identity_driver_unique
    unique (driver_identity_id, driver_id)
);

create index idx_driver_identity_links_identity_id
  on public.driver_identity_links (driver_identity_id);

create table public.driver_aliases (
  id uuid primary key default gen_random_uuid(),
  driver_identity_id uuid references public.driver_identities(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete cascade,
  alias text not null,
  alias_type text not null,
  normalized_alias text generated always as (lower(btrim(alias))) stored,
  created_at timestamptz not null default now(),
  constraint driver_aliases_exactly_one_subject_check
    check (num_nonnulls(driver_identity_id, driver_id) = 1),
  constraint driver_aliases_alias_length_check
    check (char_length(btrim(alias)) between 2 and 80),
  constraint driver_aliases_alias_no_markup_check
    check (alias !~ '[<>]'),
  constraint driver_aliases_type_check
    check (alias_type in ('gamertag', 'display_name', 'spelling_variant', 'legacy_import'))
);

create unique index driver_aliases_identity_normalized_unique
  on public.driver_aliases (driver_identity_id, normalized_alias)
  where driver_identity_id is not null;
create unique index driver_aliases_driver_normalized_unique
  on public.driver_aliases (driver_id, normalized_alias)
  where driver_id is not null;
create index idx_driver_aliases_normalized_alias
  on public.driver_aliases (normalized_alias);
create index idx_driver_aliases_driver_identity_id
  on public.driver_aliases (driver_identity_id)
  where driver_identity_id is not null;
create index idx_driver_aliases_driver_id
  on public.driver_aliases (driver_id)
  where driver_id is not null;

alter table public.drivers enable row level security;
alter table public.driver_identities enable row level security;
alter table public.driver_claims enable row level security;
alter table public.driver_identity_links enable row level security;
alter table public.driver_aliases enable row level security;

revoke all on table public.drivers from public, anon, authenticated;
revoke all on table public.driver_identities from public, anon, authenticated;
revoke all on table public.driver_claims from public, anon, authenticated;
revoke all on table public.driver_identity_links from public, anon, authenticated;
revoke all on table public.driver_aliases from public, anon, authenticated;

grant select on table public.drivers to anon, authenticated;
grant select on table public.driver_identities to authenticated;
grant select on table public.driver_identity_links to authenticated;
grant select on table public.driver_aliases to authenticated;

grant select, insert, update, delete on table public.drivers to service_role;
grant select, insert, update, delete on table public.driver_identities to service_role;
grant select, insert, update, delete on table public.driver_claims to service_role;
grant select, insert, update, delete on table public.driver_identity_links to service_role;
grant select, insert, update, delete on table public.driver_aliases to service_role;

create trigger drivers_set_updated_at
before update on public.drivers
for each row execute function private.set_updated_at();

create trigger driver_identities_set_updated_at
before update on public.driver_identities
for each row execute function private.set_updated_at();

create or replace function private.validate_driver_identity_link()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  claim_driver_id uuid;
  claim_user_id uuid;
  claim_status text;
  identity_user_id uuid;
begin
  select c.driver_id, c.claimant_user_id, c.status
    into claim_driver_id, claim_user_id, claim_status
  from public.driver_claims c
  where c.id = new.claim_id;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'A driver identity link requires an existing identity and claim.';
  end if;

  select di.user_id
    into identity_user_id
  from public.driver_identities di
  where di.id = new.driver_identity_id;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'A driver identity link requires an existing identity and claim.';
  end if;

  if claim_status <> 'verified'
     or claim_driver_id <> new.driver_id
     or claim_user_id <> identity_user_id then
    raise exception using
      errcode = '23514',
      message = 'A driver identity link requires a matching verified claim.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_driver_identity_link()
  from public, anon, authenticated, service_role;

create trigger driver_identity_links_validate_claim
before insert or update on public.driver_identity_links
for each row execute function private.validate_driver_identity_link();

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
  ) and (
    new.status <> 'verified'
    or new.driver_id <> old.driver_id
    or new.claimant_user_id <> old.claimant_user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Claim evidence used by a driver identity link is immutable.';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_linked_driver_claim()
  from public, anon, authenticated, service_role;

create trigger driver_claims_protect_linked_evidence
before update on public.driver_claims
for each row execute function private.protect_linked_driver_claim();

create policy "v2 public read requested league drivers"
on public.drivers
for select
to anon
using ((select public.matches_requested_league(league_id)));

create policy "v2 authenticated read requested league drivers"
on public.drivers
for select
to authenticated
using ((select public.matches_requested_league(league_id)));

create policy "v2 users read own driver identity"
on public.driver_identities
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "v2 users read own driver links"
on public.driver_identity_links
for select
to authenticated
using (
  exists (
    select 1
    from public.driver_identities di
    where di.id = driver_identity_id
      and di.user_id = (select auth.uid())
  )
);

create policy "v2 users read own global aliases"
on public.driver_aliases
for select
to authenticated
using (
  driver_identity_id is not null
  and exists (
    select 1
    from public.driver_identities di
    where di.id = driver_identity_id
      and di.user_id = (select auth.uid())
  )
);

comment on table public.drivers is
  'League-scoped driver records retained for V1 compatibility and historical results.';
comment on table public.driver_identities is
  'Global active-driver identity. Exactly one row may reference each registered auth user.';
comment on table public.driver_claims is
  'Server-only evidence for verified historical driver claims. Raw claim tokens must never be stored.';
comment on table public.driver_identity_links is
  'Verified mapping from one global identity to one or more league-scoped driver records.';
comment on table public.driver_aliases is
  'Matching hints only. Alias equality is never identity proof and never creates an identity link.';
comment on column public.driver_claims.proof_token_hash is
  'SHA-256 hex digest for a one-time claim token; raw tokens are forbidden.';
