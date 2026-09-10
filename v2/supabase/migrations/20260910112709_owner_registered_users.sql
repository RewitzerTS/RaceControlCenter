-- Owner-only directory. No credentials or other auth fields leave the database.
create schema if not exists owner_directory;
revoke all on schema owner_directory from public, anon, authenticated;
grant usage on schema owner_directory to authenticated;
create or replace function owner_directory.list_users(p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception using errcode = '42501', message = 'Platform owner access required.';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception using errcode = '22023', message = 'Invalid offset.';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from auth.users where deleted_at is null and not coalesce(is_anonymous, false)),
    'users', coalesce((select jsonb_agg(to_jsonb(u)) from (
      select id, nullif(btrim(raw_user_meta_data->>'display_name'), '') as name, email
      from auth.users
      where deleted_at is null and not coalesce(is_anonymous, false)
      order by created_at, id limit 50 offset p_offset
    ) u), '[]'::jsonb)
  );
end;
$$;
revoke all on function owner_directory.list_users(integer) from public, anon, authenticated, service_role;
grant execute on function owner_directory.list_users(integer) to authenticated;

create or replace function public.get_owner_registered_users(p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select owner_directory.list_users(p_offset); $$;
revoke all on function public.get_owner_registered_users(integer) from public, anon, authenticated, service_role;
grant execute on function public.get_owner_registered_users(integer) to authenticated;
