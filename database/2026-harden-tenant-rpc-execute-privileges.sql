-- Race Control Center - harden tenant RPC execute privileges
-- Explicitly prevent anonymous callers from invoking SECURITY DEFINER tenant-management RPCs.

revoke execute on function public.create_league(text, text, boolean) from anon;
revoke execute on function public.list_league_members(uuid) from anon;
revoke execute on function public.set_league_member_role(uuid, uuid, text) from anon;
revoke execute on function public.remove_league_member(uuid, uuid) from anon;
revoke execute on function public.add_existing_league_member_by_email(uuid, text, text) from anon;
revoke execute on function public.can_manage_league(uuid) from anon;
revoke execute on function public.is_league_owner(uuid) from anon;
