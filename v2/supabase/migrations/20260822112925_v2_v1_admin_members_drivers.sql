-- RaceVora V2: restore the V1 member, permission and driver admin workflows.
-- Additive V2-only migration. Never apply to the preserved V1 project.

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

  select l.* into target_league
  from public.leagues l
  where l.slug = public.requested_league_slug();

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League member administration access denied.';
  end if;

  return jsonb_build_object(
    'league', jsonb_build_object(
      'id', target_league.id,
      'name', target_league.name,
      'slug', target_league.slug
    ),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', lm.user_id,
          'email', u.email,
          'role', lm.role,
          'joined_at', lm.created_at,
          'identity_status', di.status,
          'driver_id', d.id,
          'driver_name', d.display_name
        )
        order by
          case lm.role when 'league_admin' then 1 when 'steward' then 2 else 3 end,
          lower(coalesce(d.display_name, u.email, ''))
      )
      from public.league_members lm
      join auth.users u on u.id = lm.user_id
      left join public.driver_identities di on di.user_id = lm.user_id
      left join public.driver_identity_links dil on dil.driver_identity_id = di.id
      left join public.drivers d
        on d.id = dil.driver_id
       and d.league_id = target_league.id
      where lm.league_id = target_league.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.add_existing_league_member_by_email(
  p_email text,
  p_role text default 'driver'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
  target_user auth.users%rowtype;
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  normalized_role text := lower(btrim(coalesce(p_role, 'driver')));
  saved_member public.league_members%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select l.* into target_league
  from public.leagues l
  where l.slug = public.requested_league_slug();

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League member administration access denied.';
  end if;
  if normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or char_length(normalized_email) > 254 then
    raise exception using errcode = '22023', message = 'A valid account email is required.';
  end if;
  if normalized_role not in ('driver', 'steward', 'league_admin') then
    raise exception using errcode = '22023', message = 'Unknown league role.';
  end if;

  select u.* into target_user
  from auth.users u
  where lower(u.email) = normalized_email
  limit 1;

  if target_user.id is null then
    raise exception using errcode = 'P0002', message = 'No registered RaceVora account uses this email.';
  end if;
  if not exists (
    select 1 from public.driver_identities di
    where di.user_id = target_user.id and di.status = 'active'
  ) then
    raise exception using errcode = '23514', message = 'This account has no active driver identity yet.';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (target_league.id, target_user.id, normalized_role)
  on conflict (league_id, user_id) do update set role = excluded.role
  returning * into saved_member;

  insert into public.v2_audit_events (
    scope, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', actor_id, 'league.member.upserted', 'league_member', target_user.id,
    jsonb_build_object('league_id', target_league.id, 'role', saved_member.role)
  );

  return jsonb_build_object(
    'user_id', saved_member.user_id,
    'email', target_user.email,
    'role', saved_member.role,
    'joined_at', saved_member.created_at
  );
end;
$$;

create or replace function public.set_league_member_role(
  p_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
  normalized_role text := lower(btrim(coalesce(p_role, '')));
  current_role text;
  saved_member public.league_members%rowtype;
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
  if normalized_role not in ('driver', 'steward', 'league_admin') then
    raise exception using errcode = '22023', message = 'Unknown league role.';
  end if;

  select lm.role into current_role
  from public.league_members lm
  where lm.league_id = target_league.id and lm.user_id = p_user_id;
  if current_role is null then
    raise exception using errcode = 'P0002', message = 'League member not found.';
  end if;
  if p_user_id = actor_id and current_role = 'league_admin'
     and normalized_role <> 'league_admin' and not public.is_platform_owner() then
    raise exception using errcode = '42501', message = 'You cannot demote your own league admin account.';
  end if;
  if current_role = 'league_admin' and normalized_role <> 'league_admin'
     and not public.is_platform_owner()
     and (select count(*) from public.league_members lm
          where lm.league_id = target_league.id and lm.role = 'league_admin') <= 1 then
    raise exception using errcode = '23514', message = 'The league must retain at least one league admin.';
  end if;

  update public.league_members
  set role = normalized_role
  where league_id = target_league.id and user_id = p_user_id
  returning * into saved_member;

  insert into public.v2_audit_events (
    scope, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', actor_id, 'league.member.role_changed', 'league_member', p_user_id,
    jsonb_build_object('league_id', target_league.id, 'from', current_role, 'to', normalized_role)
  );
  return jsonb_build_object('user_id', saved_member.user_id, 'role', saved_member.role);
end;
$$;

create or replace function public.remove_league_member(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
  current_role text;
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

  select lm.role into current_role from public.league_members lm
  where lm.league_id = target_league.id and lm.user_id = p_user_id;
  if current_role is null then
    raise exception using errcode = 'P0002', message = 'League member not found.';
  end if;
  if p_user_id = actor_id and not public.is_platform_owner() then
    raise exception using errcode = '42501', message = 'You cannot remove your own league account.';
  end if;
  if current_role = 'league_admin' and not public.is_platform_owner()
     and (select count(*) from public.league_members lm
          where lm.league_id = target_league.id and lm.role = 'league_admin') <= 1 then
    raise exception using errcode = '23514', message = 'The league must retain at least one league admin.';
  end if;

  delete from public.league_members
  where league_id = target_league.id and user_id = p_user_id;

  insert into public.v2_audit_events (
    scope, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', actor_id, 'league.member.removed', 'league_member', p_user_id,
    jsonb_build_object('league_id', target_league.id, 'role', current_role)
  );
  return jsonb_build_object('user_id', p_user_id, 'removed', true);
end;
$$;

create or replace function public.get_league_driver_admin_workspace()
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
    raise exception using errcode = '42501', message = 'League driver administration access denied.';
  end if;

  return jsonb_build_object(
    'league', jsonb_build_object('id', target_league.id, 'name', target_league.name, 'slug', target_league.slug),
    'counts', jsonb_build_object(
      'total', (select count(*) from public.drivers d where d.league_id = target_league.id),
      'active', (select count(*) from public.drivers d where d.league_id = target_league.id and d.is_active),
      'linked', (select count(*) from public.drivers d join public.driver_identity_links dil on dil.driver_id = d.id where d.league_id = target_league.id)
    ),
    'drivers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'display_name', d.display_name,
          'gamertag', d.gamertag,
          'number', d.number,
          'nationality_code', d.nationality_code,
          'league_team', d.league_team,
          'car_name', d.car_name,
          'is_active', d.is_active,
          'identity_linked', dil.id is not null,
          'result_count', (select count(*) from public.race_results rr where rr.driver_id = d.id)
        ) order by d.is_active desc, lower(d.display_name)
      )
      from public.drivers d
      left join public.driver_identity_links dil on dil.driver_id = d.id
      where d.league_id = target_league.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.upsert_league_driver(
  p_display_name text,
  p_driver_id uuid default null,
  p_gamertag text default '',
  p_number integer default null,
  p_nationality_code text default '',
  p_league_team text default '',
  p_car_name text default '',
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
  saved_driver public.drivers%rowtype;
  normalized_name text := btrim(coalesce(p_display_name, ''));
  normalized_gamertag text := nullif(btrim(coalesce(p_gamertag, '')), '');
  normalized_nationality text := nullif(upper(btrim(coalesce(p_nationality_code, ''))), '');
  normalized_team text := nullif(btrim(coalesce(p_league_team, '')), '');
  normalized_car text := nullif(btrim(coalesce(p_car_name, '')), '');
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  select l.* into target_league from public.leagues l
  where l.slug = public.requested_league_slug();
  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League driver administration access denied.';
  end if;

  if char_length(normalized_name) not between 2 and 80 or normalized_name ~ '[<>]' then
    raise exception using errcode = '22023', message = 'Driver name must contain 2 to 80 safe characters.';
  end if;
  if normalized_gamertag is not null and (char_length(normalized_gamertag) > 80 or normalized_gamertag ~ '[<>]') then
    raise exception using errcode = '22023', message = 'Gamertag is invalid.';
  end if;
  if normalized_nationality is not null and normalized_nationality !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'Nationality must use a two-letter country code.';
  end if;
  if p_number is not null and p_number not between 0 and 999 then
    raise exception using errcode = '22023', message = 'Driver number must be between 0 and 999.';
  end if;
  if coalesce(char_length(normalized_team), 0) > 80 or coalesce(char_length(normalized_car), 0) > 80 then
    raise exception using errcode = '22023', message = 'Team or car name is too long.';
  end if;

  if p_driver_id is null then
    insert into public.drivers (
      league_id, display_name, gamertag, number, nationality_code, league_team, car_name, is_active
    ) values (
      target_league.id, normalized_name, normalized_gamertag, p_number,
      normalized_nationality, normalized_team, normalized_car, coalesce(p_is_active, true)
    ) returning * into saved_driver;
  else
    update public.drivers
    set display_name = normalized_name,
        gamertag = normalized_gamertag,
        number = p_number,
        nationality_code = normalized_nationality,
        league_team = normalized_team,
        car_name = normalized_car,
        is_active = coalesce(p_is_active, true)
    where id = p_driver_id and league_id = target_league.id
    returning * into saved_driver;
    if saved_driver.id is null then
      raise exception using errcode = 'P0002', message = 'Driver not found in this league.';
    end if;
  end if;

  insert into public.v2_audit_events (
    scope, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', actor_id,
    case when p_driver_id is null then 'driver.created' else 'driver.updated' end,
    'driver', saved_driver.id,
    jsonb_build_object('league_id', target_league.id, 'display_name', saved_driver.display_name)
  );
  return to_jsonb(saved_driver);
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'Driver name or gamertag already exists in this league.';
end;
$$;

revoke all on function public.get_league_member_admin_workspace() from public, anon, authenticated, service_role;
revoke all on function public.add_existing_league_member_by_email(text, text) from public, anon, authenticated, service_role;
revoke all on function public.set_league_member_role(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.remove_league_member(uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_league_driver_admin_workspace() from public, anon, authenticated, service_role;
revoke all on function public.upsert_league_driver(text, uuid, text, integer, text, text, text, boolean) from public, anon, authenticated, service_role;

grant execute on function public.get_league_member_admin_workspace() to authenticated, service_role;
grant execute on function public.add_existing_league_member_by_email(text, text) to authenticated, service_role;
grant execute on function public.set_league_member_role(uuid, text) to authenticated, service_role;
grant execute on function public.remove_league_member(uuid) to authenticated, service_role;
grant execute on function public.get_league_driver_admin_workspace() to authenticated, service_role;
grant execute on function public.upsert_league_driver(text, uuid, text, integer, text, text, text, boolean) to authenticated, service_role;
