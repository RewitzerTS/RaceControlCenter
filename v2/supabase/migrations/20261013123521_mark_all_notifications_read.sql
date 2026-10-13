-- Account-wide inbox action, matching the existing single-item RPC boundary.
-- No direct UPDATE privilege is granted to clients. Only the authenticated
-- actor's unread rows can change; notification contents and old read times stay.
create or replace function public.mark_all_notifications_read()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  marked_at timestamptz := statement_timestamp();
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  update public.user_notifications
  set read_at = marked_at
  where recipient_user_id = actor and read_at is null and created_at <= marked_at;
  return marked_at;
end;
$$;
revoke all on function public.mark_all_notifications_read() from public, anon, authenticated, service_role;
grant execute on function public.mark_all_notifications_read() to authenticated;
