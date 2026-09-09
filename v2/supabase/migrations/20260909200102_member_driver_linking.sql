-- Explicit admin-verified links. No result, driver or existing link is rewritten.
create or replace function private.get_linkable_league_drivers()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare target_league uuid;
begin
  select id into target_league from public.leagues where slug = public.requested_league_slug();
  if auth.uid() is null or target_league is null or not private.has_league_capability(target_league, 'league_admin') then
    raise exception using errcode = '42501', message = 'MEMBER_LINK_DENIED';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', d.id, 'display_name', d.display_name, 'gamertag', d.gamertag,
    'number', d.number, 'is_active', d.is_active
  ) order by lower(d.display_name), d.id)
  from public.drivers d where d.league_id = target_league
    and private.result_participation_status(d.ai_driver_reference, null) = 'PLAYER'
    and not exists (select 1 from public.driver_identity_links l where l.driver_id = d.id)), '[]'::jsonb);
end;
$$;

create or replace function private.link_league_member_driver(p_user_id uuid, p_driver_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target_league uuid;
  identity_id uuid;
  existing_identity uuid;
  driver_record public.drivers%rowtype;
  claim_id uuid;
begin
  select id into target_league from public.leagues where slug = public.requested_league_slug();
  if actor is null or target_league is null or not private.has_league_capability(target_league, 'league_admin') then
    raise exception using errcode = '42501', message = 'MEMBER_LINK_DENIED';
  end if;
  -- Serialize against membership removal and concurrent manual links.
  perform 1 from public.league_members where league_id = target_league and user_id = p_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'MEMBER_NOT_FOUND'; end if;
  select id into identity_id from public.driver_identities where user_id = p_user_id and status = 'active' for update;
  if identity_id is null then raise exception using errcode = '23514', message = 'MEMBER_IDENTITY_INACTIVE'; end if;
  select * into driver_record from public.drivers where id = p_driver_id and league_id = target_league for update;
  if driver_record.id is null or private.result_participation_status(driver_record.ai_driver_reference, null) <> 'PLAYER' then
    raise exception using errcode = 'P0002', message = 'MEMBER_DRIVER_NOT_FOUND';
  end if;
  select driver_identity_id into existing_identity from public.driver_identity_links where driver_id = p_driver_id;
  if existing_identity = identity_id then
    return jsonb_build_object('driver_id', p_driver_id, 'already_linked', true);
  end if;
  if existing_identity is not null then raise exception using errcode = '23505', message = 'MEMBER_DRIVER_TAKEN'; end if;
  if exists (select 1 from public.driver_identity_links l join public.drivers d on d.id = l.driver_id
      where l.driver_identity_id = identity_id and d.league_id = target_league) then
    raise exception using errcode = '23505', message = 'MEMBER_ALREADY_LINKED';
  end if;
  insert into public.driver_claims (driver_id, claimant_user_id, verification_method, status, resolved_at, resolved_by)
  values (p_driver_id, p_user_id, 'admin_verified', 'verified', now(), actor) returning id into claim_id;
  insert into public.driver_identity_links (driver_identity_id, driver_id, claim_id)
  values (identity_id, p_driver_id, claim_id);
  insert into public.v2_audit_events (scope, actor_user_id, action, entity_type, entity_id, metadata)
  values ('league', actor, 'league.member.driver_linked', 'driver', p_driver_id,
    jsonb_build_object('league_id', target_league, 'user_id', p_user_id, 'claim_id', claim_id));
  return jsonb_build_object('driver_id', p_driver_id, 'already_linked', false);
end;
$$;

create or replace function public.get_linkable_league_drivers()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.get_linkable_league_drivers();
$$;
create or replace function public.link_league_member_driver(p_user_id uuid, p_driver_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.link_league_member_driver(p_user_id, p_driver_id);
$$;
revoke all on function private.get_linkable_league_drivers(), private.link_league_member_driver(uuid, uuid),
  public.get_linkable_league_drivers(), public.link_league_member_driver(uuid, uuid) from public, anon, authenticated;
grant execute on function private.get_linkable_league_drivers(), private.link_league_member_driver(uuid, uuid),
  public.get_linkable_league_drivers(), public.link_league_member_driver(uuid, uuid) to authenticated;

-- Avoid duplicate member rows when an identity also has links in other leagues.
-- Preserve the existing workspace response and join-request fields.
do $$
declare body text;
begin
  body := pg_get_functiondef('public.get_league_member_admin_workspace()'::regprocedure);
  body := replace(body,
    'left join public.driver_identity_links dil on dil.driver_identity_id = di.id',
    'left join public.driver_identity_links dil on dil.driver_identity_id = di.id and exists (select 1 from public.drivers scoped_driver where scoped_driver.id = dil.driver_id and scoped_driver.league_id = target_league.id)');
  execute body;
end;
$$;
