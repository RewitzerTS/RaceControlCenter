-- RaceVora V2: first-run driver profile and admin-approved league joining.

alter table public.driver_identities
  add column if not exists display_name text,
  add column if not exists gamertag text,
  add column if not exists real_name text,
  add column if not exists nationality_code text;

alter table public.driver_identities
  add constraint driver_identities_display_name_safe_check
    check (display_name is null or (char_length(btrim(display_name)) between 2 and 60 and display_name !~ '[<>]')),
  add constraint driver_identities_gamertag_safe_check
    check (gamertag is null or (char_length(btrim(gamertag)) between 2 and 60 and gamertag !~ '[<>]')),
  add constraint driver_identities_real_name_safe_check
    check (real_name is null or (char_length(btrim(real_name)) between 2 and 100 and real_name !~ '[<>]')),
  add constraint driver_identities_nationality_code_check
    check (nationality_code is null or nationality_code ~ '^[A-Z]{2}$');

create table public.league_join_requests (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  driver_identity_id uuid not null references public.driver_identities(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  admin_note text,
  constraint league_join_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint league_join_requests_review_check
    check (
      (status = 'pending' and reviewed_at is null and reviewed_by is null)
      or (status <> 'pending' and reviewed_at is not null)
    ),
  constraint league_join_requests_admin_note_safe_check
    check (admin_note is null or (char_length(admin_note) <= 500 and admin_note !~ '[<>]'))
);

create unique index league_join_requests_one_pending_per_user_league
  on public.league_join_requests (league_id, user_id)
  where status = 'pending';
create index idx_league_join_requests_league_status
  on public.league_join_requests (league_id, status, requested_at);
create index idx_league_join_requests_user
  on public.league_join_requests (user_id, requested_at desc);

alter table public.league_join_requests enable row level security;
revoke all on table public.league_join_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.league_join_requests to service_role;

create or replace function public.complete_driver_onboarding(
  p_display_name text,
  p_gamertag text,
  p_real_name text default null,
  p_nationality_code text default null,
  p_league_identifier text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  clean_display_name text := btrim(coalesce(p_display_name, ''));
  clean_gamertag text := btrim(coalesce(p_gamertag, ''));
  clean_real_name text := nullif(btrim(coalesce(p_real_name, '')), '');
  clean_nationality text := nullif(upper(btrim(coalesce(p_nationality_code, ''))), '');
  clean_identifier text := nullif(lower(btrim(coalesce(p_league_identifier, ''))), '');
  saved_identity public.driver_identities%rowtype;
  target_league public.leagues%rowtype;
  saved_request public.league_join_requests%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if char_length(clean_display_name) not between 2 and 60 or clean_display_name ~ '[<>]' then
    raise exception using errcode = '22023', message = 'Display name must contain 2 to 60 safe characters.';
  end if;
  if char_length(clean_gamertag) not between 2 and 60 or clean_gamertag ~ '[<>]' then
    raise exception using errcode = '22023', message = 'Gamertag must contain 2 to 60 safe characters.';
  end if;
  if clean_real_name is not null
     and (char_length(clean_real_name) not between 2 and 100 or clean_real_name ~ '[<>]') then
    raise exception using errcode = '22023', message = 'Name must contain 2 to 100 safe characters.';
  end if;
  if clean_nationality is not null and clean_nationality !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'Country must use a two-letter code.';
  end if;

  insert into public.driver_identities (
    user_id, status, display_name, gamertag, real_name, nationality_code
  ) values (
    actor_id, 'active', clean_display_name, clean_gamertag, clean_real_name, clean_nationality
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    gamertag = excluded.gamertag,
    real_name = excluded.real_name,
    nationality_code = excluded.nationality_code,
    updated_at = now()
  returning * into saved_identity;

  insert into public.driver_aliases (driver_identity_id, alias, alias_type)
  select saved_identity.id, clean_display_name, 'display_name'
  where not exists (
    select 1 from public.driver_aliases da
    where da.driver_identity_id = saved_identity.id
      and da.normalized_alias = lower(clean_display_name)
  );
  insert into public.driver_aliases (driver_identity_id, alias, alias_type)
  select saved_identity.id, clean_gamertag, 'gamertag'
  where not exists (
    select 1 from public.driver_aliases da
    where da.driver_identity_id = saved_identity.id
      and da.normalized_alias = lower(clean_gamertag)
  );

  if clean_identifier is not null then
    select l.* into target_league
    from public.leagues l
    where l.status = 'active'
      and (l.slug = clean_identifier or l.id::text = clean_identifier)
    limit 1;
    if target_league.id is null then
      raise exception using errcode = 'P0002', message = 'League ID was not found.';
    end if;
    if exists (
      select 1 from public.league_members lm
      where lm.league_id = target_league.id and lm.user_id = actor_id
    ) then
      return jsonb_build_object(
        'identity_id', saved_identity.id,
        'league_id', target_league.id,
        'league_name', target_league.name,
        'request_status', 'already_member'
      );
    end if;

    insert into public.league_join_requests (league_id, user_id, driver_identity_id)
    values (target_league.id, actor_id, saved_identity.id)
    on conflict (league_id, user_id) where status = 'pending'
    do update set driver_identity_id = excluded.driver_identity_id, requested_at = now()
    returning * into saved_request;

    return jsonb_build_object(
      'identity_id', saved_identity.id,
      'league_id', target_league.id,
      'league_name', target_league.name,
      'request_id', saved_request.id,
      'request_status', saved_request.status
    );
  end if;

  return jsonb_build_object(
    'identity_id', saved_identity.id,
    'request_status', 'not_requested'
  );
end;
$$;

revoke all on function public.complete_driver_onboarding(text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_driver_onboarding(text, text, text, text, text)
  to authenticated, service_role;

create or replace function public.review_league_join_request(
  p_request_id uuid,
  p_decision text,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_decision text := lower(btrim(coalesce(p_decision, '')));
  clean_note text := nullif(btrim(coalesce(p_admin_note, '')), '');
  target_request public.league_join_requests%rowtype;
  target_identity public.driver_identities%rowtype;
  target_driver public.drivers%rowtype;
  saved_claim public.driver_claims%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  select r.* into target_request
  from public.league_join_requests r
  where r.id = p_request_id
  for update;
  if target_request.id is null or target_request.status <> 'pending' then
    raise exception using errcode = 'P0002', message = 'Pending join request not found.';
  end if;
  if not private.has_league_capability(target_request.league_id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League join approval access denied.';
  end if;
  if normalized_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'Decision must be approved or rejected.';
  end if;
  if clean_note is not null and (char_length(clean_note) > 500 or clean_note ~ '[<>]') then
    raise exception using errcode = '22023', message = 'Admin note is invalid.';
  end if;

  select di.* into target_identity
  from public.driver_identities di
  where di.id = target_request.driver_identity_id
    and di.user_id = target_request.user_id
    and di.status = 'active';
  if target_identity.id is null then
    raise exception using errcode = '23514', message = 'Active driver identity not found.';
  end if;

  if normalized_decision = 'approved' then
    insert into public.league_members (league_id, user_id, role)
    values (target_request.league_id, target_request.user_id, 'driver')
    on conflict (league_id, user_id) do update set updated_at = now();

    select d.* into target_driver
    from public.drivers d
    where d.league_id = target_request.league_id
      and (
        (target_identity.gamertag is not null and lower(d.gamertag) = lower(target_identity.gamertag))
        or lower(d.display_name) = lower(target_identity.display_name)
      )
    order by case when lower(coalesce(d.gamertag, '')) = lower(coalesce(target_identity.gamertag, '')) then 0 else 1 end
    limit 1;

    if target_driver.id is null then
      insert into public.drivers (
        league_id, display_name, gamertag, real_name, nationality_code, is_active
      ) values (
        target_request.league_id, target_identity.display_name, target_identity.gamertag,
        target_identity.real_name, target_identity.nationality_code, true
      ) returning * into target_driver;
    end if;

    if exists (
      select 1 from public.driver_identity_links dil
      where dil.driver_id = target_driver.id
        and dil.driver_identity_id <> target_identity.id
    ) then
      raise exception using errcode = '23505', message = 'This league driver is already linked to another account.';
    end if;

    if not exists (
      select 1 from public.driver_identity_links dil
      where dil.driver_id = target_driver.id
        and dil.driver_identity_id = target_identity.id
    ) then
      insert into public.driver_claims (
        driver_id, claimant_user_id, verification_method, status,
        resolved_at, resolved_by
      ) values (
        target_driver.id, target_request.user_id, 'admin_verified', 'verified',
        now(), actor_id
      ) returning * into saved_claim;

      insert into public.driver_identity_links (driver_identity_id, driver_id, claim_id)
      values (target_identity.id, target_driver.id, saved_claim.id);
    end if;
  end if;

  update public.league_join_requests
  set status = normalized_decision,
      reviewed_at = now(),
      reviewed_by = actor_id,
      admin_note = clean_note
  where id = target_request.id;

  insert into public.user_notifications (
    recipient_user_id, league_id, notification_kind, title_key, body_key, payload, dedupe_key
  ) values (
    target_request.user_id,
    target_request.league_id,
    'system',
    case when normalized_decision = 'approved' then 'league.joinApproved.title' else 'league.joinRejected.title' end,
    case when normalized_decision = 'approved' then 'league.joinApproved.body' else 'league.joinRejected.body' end,
    jsonb_build_object('request_id', target_request.id, 'decision', normalized_decision, 'admin_note', clean_note),
    'league-join:' || target_request.id::text || ':' || normalized_decision
  ) on conflict (recipient_user_id, dedupe_key) do nothing;

  insert into public.v2_audit_events (
    scope, league_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', target_request.league_id, actor_id,
    'league.join_request.' || normalized_decision,
    'league_join_request', target_request.id,
    jsonb_build_object('user_id', target_request.user_id, 'driver_id', target_driver.id)
  );

  return jsonb_build_object(
    'request_id', target_request.id,
    'status', normalized_decision,
    'user_id', target_request.user_id,
    'driver_id', target_driver.id
  );
end;
$$;

revoke all on function public.review_league_join_request(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.review_league_join_request(uuid, text, text)
  to authenticated, service_role;

create or replace function public.get_league_member_admin_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  select l.* into target_league from public.leagues l
  where l.slug = public.requested_league_slug();
  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League member administration access denied.';
  end if;

  return jsonb_build_object(
    'league', jsonb_build_object('id', target_league.id, 'name', target_league.name, 'slug', target_league.slug),
    'join_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'email', u.email,
        'display_name', di.display_name,
        'gamertag', di.gamertag,
        'real_name', di.real_name,
        'nationality_code', di.nationality_code,
        'requested_at', r.requested_at,
        'status', r.status
      ) order by r.requested_at)
      from public.league_join_requests r
      join auth.users u on u.id = r.user_id
      join public.driver_identities di on di.id = r.driver_identity_id
      where r.league_id = target_league.id and r.status = 'pending'
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', lm.user_id,
        'email', u.email,
        'role', lm.role,
        'joined_at', lm.created_at,
        'identity_status', di.status,
        'driver_id', d.id,
        'driver_name', d.display_name
      ) order by case lm.role when 'league_admin' then 1 when 'steward' then 2 else 3 end,
        lower(coalesce(d.display_name, u.email, '')))
      from public.league_members lm
      join auth.users u on u.id = lm.user_id
      left join public.driver_identities di on di.user_id = lm.user_id
      left join public.driver_identity_links dil on dil.driver_identity_id = di.id
      left join public.drivers d on d.id = dil.driver_id and d.league_id = target_league.id
      where lm.league_id = target_league.id
    ), '[]'::jsonb)
  );
end;
$$;

comment on table public.league_join_requests is
  'User-initiated league membership requests reviewed by a league administrator.';
comment on function public.complete_driver_onboarding(text, text, text, text, text) is
  'Creates or updates the authenticated global driver profile and optionally requests league membership by UUID or slug.';
comment on function public.review_league_join_request(uuid, text, text) is
  'Approves or rejects a pending league membership request and links the approved driver identity.';

