-- Fix the Phase 17 race count to follow the established race -> season -> league relationship.

create or replace function public.get_league_admin_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_league public.leagues%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  select l.* into target_league from public.leagues l where l.slug = public.requested_league_slug();
  if target_league.id is null or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League administration is not allowed.';
  end if;
  return jsonb_build_object(
    'league', jsonb_build_object('id', target_league.id, 'name', target_league.name, 'slug', target_league.slug, 'status', target_league.status),
    'counts', jsonb_build_object(
      'races', (select count(*) from public.races r join public.seasons s on s.id = r.season_id where s.league_id = target_league.id),
      'drivers', (select count(*) from public.drivers d where d.league_id = target_league.id and d.is_active),
      'members', (select count(*) from public.league_members lm where lm.league_id = target_league.id),
      'open_steward_cases', (select count(*) from public.steward_cases sc where sc.league_id = target_league.id and sc.status in ('under_review', 'appealed')),
      'pending_jobs', (select count(*) from private.domain_event_processing dep join public.domain_events de on de.id = dep.event_id where de.league_id = target_league.id and dep.status in ('pending', 'processing')),
      'failed_jobs', (select count(*) from private.domain_event_processing dep join public.domain_events de on de.id = dep.event_id where de.league_id = target_league.id and dep.status in ('failed', 'dead_letter'))
    ),
    'recent_audit', coalesce((select jsonb_agg(jsonb_build_object('id', ae.id, 'action', ae.action, 'entity_type', ae.entity_type, 'occurred_at', ae.occurred_at) order by ae.occurred_at desc) from (select * from public.v2_audit_events where league_id = target_league.id order by occurred_at desc limit 12) ae), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_league_admin_workspace() from public, anon, authenticated, service_role;
grant execute on function public.get_league_admin_workspace() to authenticated;
