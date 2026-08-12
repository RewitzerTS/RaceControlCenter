-- Allow tenant RLS policies to check memberships without exposing league_members
-- directly to anonymous/public clients.

create or replace function public.is_league_member(
  check_league_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select check_user_id is not null
    and exists (
      select 1
      from public.league_members lm
      where lm.league_id = check_league_id
        and lm.user_id = check_user_id
    );
$$;

create or replace function public.has_league_role(
  check_league_id uuid,
  allowed_roles text[],
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select check_user_id is not null
    and exists (
      select 1
      from public.league_members lm
      where lm.league_id = check_league_id
        and lm.user_id = check_user_id
        and lm.role = any(allowed_roles)
    );
$$;

revoke all on function public.is_league_member(uuid, uuid) from public;
revoke all on function public.has_league_role(uuid, text[], uuid) from public;

grant execute on function public.is_league_member(uuid, uuid) to anon, authenticated;
grant execute on function public.has_league_role(uuid, text[], uuid) to authenticated;
