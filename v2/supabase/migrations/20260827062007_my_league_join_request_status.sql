create or replace function public.get_my_league_join_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', request.id,
      'league_id', league.id,
      'league_name', league.name,
      'league_slug', league.slug,
      'status', request.status,
      'requested_at', request.requested_at,
      'reviewed_at', request.reviewed_at
    ) order by request.requested_at desc)
    from public.league_join_requests request
    join public.leagues league on league.id = request.league_id
    where request.user_id = actor_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_my_league_join_requests()
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_league_join_requests()
  to authenticated, service_role;

comment on function public.get_my_league_join_requests() is
  'Returns the authenticated user''s own league join request history with safe league labels.';
