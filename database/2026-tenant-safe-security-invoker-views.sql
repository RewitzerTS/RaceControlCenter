-- Ensure analytical views execute with the caller's permissions and RLS context.
alter view public.v_team_standings set (security_invoker = true);
alter view public.v_driver_context set (security_invoker = true);
alter view public.v_season_points_ledger set (security_invoker = true);
alter view public.v_driver_standings set (security_invoker = true);
