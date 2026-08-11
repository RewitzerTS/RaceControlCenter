begin;

create or replace function public.can_manage_league(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner','admin')
  );
$$;

create or replace function public.is_league_owner(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = auth.uid()
      and lm.role = 'owner'
  );
$$;

revoke all on function public.can_manage_league(uuid) from public;
revoke all on function public.is_league_owner(uuid) from public;
grant execute on function public.can_manage_league(uuid) to authenticated;
grant execute on function public.is_league_owner(uuid) to authenticated;

create or replace function public.list_league_members(p_league_id uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.can_manage_league(p_league_id) then
    raise exception 'not authorized to manage this league';
  end if;

  return query
  select lm.user_id, u.email::text, lm.role, lm.created_at
  from public.league_members lm
  join auth.users u on u.id = lm.user_id
  where lm.league_id = p_league_id
  order by
    case lm.role when 'owner' then 1 when 'admin' then 2 when 'steward' then 3 else 4 end,
    lower(coalesce(u.email, ''));
end;
$$;

create or replace function public.add_existing_league_member_by_email(
  p_league_id uuid,
  p_email text,
  p_role text default 'member'
)
returns table (user_id uuid, email text, role text)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user auth.users%rowtype;
  v_role text := lower(trim(coalesce(p_role, 'member')));
begin
  if not public.can_manage_league(p_league_id) then
    raise exception 'not authorized to manage this league';
  end if;
  if v_role not in ('owner','admin','steward','member') then raise exception 'invalid league role'; end if;
  if v_role = 'owner' and not public.is_league_owner(p_league_id) then
    raise exception 'only an owner can add another owner';
  end if;

  select * into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user.id is null then raise exception 'user_not_found'; end if;

  insert into public.league_members (league_id, user_id, role)
  values (p_league_id, v_user.id, v_role)
  on conflict (league_id, user_id)
  do update set role = excluded.role, updated_at = now();

  return query select v_user.id, v_user.email::text, v_role;
end;
$$;

create or replace function public.set_league_member_role(
  p_league_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_current_role text;
  v_new_role text := lower(trim(coalesce(p_role, '')));
  v_owner_count integer;
begin
  if not public.can_manage_league(p_league_id) then raise exception 'not authorized to manage this league'; end if;
  if v_new_role not in ('owner','admin','steward','member') then raise exception 'invalid league role'; end if;

  select role into v_current_role from public.league_members
  where league_id = p_league_id and user_id = p_user_id;
  if v_current_role is null then raise exception 'league member not found'; end if;

  if (v_current_role = 'owner' or v_new_role = 'owner') and not public.is_league_owner(p_league_id) then
    raise exception 'only an owner can change owner roles';
  end if;

  if v_current_role = 'owner' and v_new_role <> 'owner' then
    select count(*) into v_owner_count from public.league_members
    where league_id = p_league_id and role = 'owner';
    if v_owner_count <= 1 then raise exception 'a league must keep at least one owner'; end if;
  end if;

  update public.league_members
  set role = v_new_role, updated_at = now()
  where league_id = p_league_id and user_id = p_user_id;
end;
$$;

create or replace function public.remove_league_member(
  p_league_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_current_role text;
  v_owner_count integer;
begin
  if not public.can_manage_league(p_league_id) then raise exception 'not authorized to manage this league'; end if;

  select role into v_current_role from public.league_members
  where league_id = p_league_id and user_id = p_user_id;
  if v_current_role is null then return; end if;

  if v_current_role = 'owner' then
    if not public.is_league_owner(p_league_id) then raise exception 'only an owner can remove an owner'; end if;
    select count(*) into v_owner_count from public.league_members
    where league_id = p_league_id and role = 'owner';
    if v_owner_count <= 1 then raise exception 'a league must keep at least one owner'; end if;
  end if;

  delete from public.league_members where league_id = p_league_id and user_id = p_user_id;
end;
$$;

revoke all on function public.list_league_members(uuid) from public;
revoke all on function public.add_existing_league_member_by_email(uuid,text,text) from public;
revoke all on function public.set_league_member_role(uuid,uuid,text) from public;
revoke all on function public.remove_league_member(uuid,uuid) from public;
grant execute on function public.list_league_members(uuid) to authenticated;
grant execute on function public.add_existing_league_member_by_email(uuid,text,text) to authenticated;
grant execute on function public.set_league_member_role(uuid,uuid,text) to authenticated;
grant execute on function public.remove_league_member(uuid,uuid) to authenticated;

commit;
