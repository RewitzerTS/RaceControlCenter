-- Fix mutable search_path warnings and remove anonymous access to legacy admin helpers.
alter function public.touch_league_content_updated_at() set search_path = public;
alter function public.resolve_driver_assignment(uuid, uuid, integer) set search_path = public;
alter function public.apply_race_penalties(uuid) set search_path = public;
alter function public.set_updated_at() set search_path = public;

revoke execute on function public.is_app_admin(uuid) from anon;
revoke execute on function public.is_rcc_admin() from anon;
