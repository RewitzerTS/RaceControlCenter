-- RaceVora V2 Phases 17-19: admin operations, global owner control and in-app notifications.
-- Additive staging migration. Never apply to the V1 Production project.

create table public.v2_audit_events (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  league_id uuid references public.leagues(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint v2_audit_scope_check check (scope in ('league', 'platform')),
  constraint v2_audit_scope_league_check check (
    (scope = 'league' and league_id is not null) or
    (scope = 'platform' and league_id is null)
  ),
  constraint v2_audit_action_length_check check (char_length(action) between 3 and 120),
  constraint v2_audit_entity_type_length_check check (char_length(entity_type) between 2 and 80),
  constraint v2_audit_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index idx_v2_audit_league_time on public.v2_audit_events (league_id, occurred_at desc) where league_id is not null;
create index idx_v2_audit_platform_time on public.v2_audit_events (occurred_at desc) where scope = 'platform';
create index idx_v2_audit_actor_time on public.v2_audit_events (actor_user_id, occurred_at desc) where actor_user_id is not null;

create table public.platform_feature_flags (
  flag_key text primary key,
  enabled boolean not null default false,
  description_key text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint platform_feature_flag_key_check check (flag_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint platform_feature_flag_description_check check (char_length(description_key) between 3 and 120)
);

insert into public.platform_feature_flags (flag_key, enabled, description_key) values
  ('driver_identity_v2', true, 'feature.driver_identity_v2'),
  ('result_versioning_v2', true, 'feature.result_versioning_v2'),
  ('gamification_enabled', true, 'feature.gamification_enabled'),
  ('achievements_enabled', true, 'feature.achievements_enabled'),
  ('challenges_enabled', true, 'feature.challenges_enabled'),
  ('vora_enabled', false, 'feature.vora_enabled'),
  ('graphics_enabled', false, 'feature.graphics_enabled'),
  ('notifications_v2', true, 'feature.notifications_v2')
on conflict (flag_key) do nothing;

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete restrict,
  source_event_id uuid references public.domain_events(id) on delete restrict,
  notification_kind text not null,
  title_key text not null,
  body_key text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint user_notifications_recipient_dedupe_unique unique (recipient_user_id, dedupe_key),
  constraint user_notifications_kind_check check (notification_kind in ('race_summary', 'steward_decision', 'career_moment', 'system')),
  constraint user_notifications_title_key_check check (char_length(title_key) between 3 and 120),
  constraint user_notifications_body_key_check check (char_length(body_key) between 3 and 120),
  constraint user_notifications_dedupe_key_check check (char_length(dedupe_key) between 8 and 180),
  constraint user_notifications_payload_object_check check (jsonb_typeof(payload) = 'object')
);

create index idx_platform_feature_flags_updated_by on public.platform_feature_flags (updated_by) where updated_by is not null;

create index idx_user_notifications_inbox on public.user_notifications (recipient_user_id, created_at desc);
create index idx_user_notifications_unread on public.user_notifications (recipient_user_id, created_at desc) where read_at is null;
create index idx_user_notifications_league on public.user_notifications (league_id, created_at desc) where league_id is not null;
create index idx_user_notifications_source_event on public.user_notifications (source_event_id) where source_event_id is not null;

alter table public.v2_audit_events enable row level security;
alter table public.platform_feature_flags enable row level security;
alter table public.user_notifications enable row level security;

revoke all on table public.v2_audit_events, public.platform_feature_flags, public.user_notifications from public, anon, authenticated;
grant select on table public.v2_audit_events, public.platform_feature_flags, public.user_notifications to authenticated;
grant select, insert, update, delete on table public.v2_audit_events, public.platform_feature_flags, public.user_notifications to service_role;

create policy "v2 league admins read tenant audit"
on public.v2_audit_events for select to authenticated
using (
  (scope = 'platform' and (select public.is_platform_owner()))
  or (
    scope = 'league'
    and (select public.matches_requested_league(league_id))
    and (select private.has_league_capability(league_id, 'league_admin'))
  )
);

create policy "v2 owners read platform flags"
on public.platform_feature_flags for select to authenticated
using ((select public.is_platform_owner()));

create policy "v2 users read own notifications"
on public.user_notifications for select to authenticated
using ((select auth.uid()) is not null and recipient_user_id = (select auth.uid()));

create or replace function private.protect_v2_audit_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'V2 audit history is append-only.';
end;
$$;

revoke all on function private.protect_v2_audit_history() from public, anon, authenticated, service_role;

create trigger v2_audit_events_protect_history
before update or delete on public.v2_audit_events
for each row execute function private.protect_v2_audit_history();

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

  select l.* into target_league
  from public.leagues l
  where l.slug = public.requested_league_slug();

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
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
    'recent_audit', coalesce((
      select jsonb_agg(jsonb_build_object('id', ae.id, 'action', ae.action, 'entity_type', ae.entity_type, 'occurred_at', ae.occurred_at) order by ae.occurred_at desc)
      from (select * from public.v2_audit_events where league_id = target_league.id order by occurred_at desc limit 12) ae
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_league_admin_workspace() from public, anon, authenticated, service_role;
grant execute on function public.get_league_admin_workspace() to authenticated;

create or replace function public.get_owner_control_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_owner() then
    raise exception using errcode = '42501', message = 'Platform owner access required.';
  end if;

  return jsonb_build_object(
    'counts', jsonb_build_object(
      'leagues', (select count(*) from public.leagues),
      'global_drivers', (select count(*) from public.driver_identities where status = 'active'),
      'pending_jobs', (select count(*) from private.domain_event_processing where status in ('pending', 'processing')),
      'failed_jobs', (select count(*) from private.domain_event_processing where status in ('failed', 'dead_letter'))
    ),
    'leagues', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'slug', l.slug, 'status', l.status) order by l.name)
      from public.leagues l
    ), '[]'::jsonb),
    'flags', coalesce((
      select jsonb_agg(jsonb_build_object('key', f.flag_key, 'enabled', f.enabled, 'description_key', f.description_key, 'updated_at', f.updated_at) order by f.flag_key)
      from public.platform_feature_flags f
    ), '[]'::jsonb),
    'recent_audit', coalesce((
      select jsonb_agg(jsonb_build_object('id', ae.id, 'action', ae.action, 'entity_type', ae.entity_type, 'occurred_at', ae.occurred_at) order by ae.occurred_at desc)
      from (select * from public.v2_audit_events order by occurred_at desc limit 20) ae
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_owner_control_snapshot() from public, anon, authenticated, service_role;
grant execute on function public.get_owner_control_snapshot() to authenticated;

create or replace function public.set_platform_feature_flag(p_flag_key text, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_flag public.platform_feature_flags%rowtype;
begin
  if not public.is_platform_owner() then
    raise exception using errcode = '42501', message = 'Platform owner access required.';
  end if;

  update public.platform_feature_flags
  set enabled = p_enabled, updated_by = (select auth.uid()), updated_at = now()
  where flag_key = p_flag_key
  returning * into updated_flag;

  if updated_flag.flag_key is null then
    raise exception using errcode = '22023', message = 'Unknown feature flag.';
  end if;

  insert into public.v2_audit_events (scope, actor_user_id, action, entity_type, metadata)
  values ('platform', (select auth.uid()), 'feature_flag.updated', 'platform_feature_flag', jsonb_build_object('flag_key', updated_flag.flag_key, 'enabled', updated_flag.enabled));

  return jsonb_build_object('key', updated_flag.flag_key, 'enabled', updated_flag.enabled, 'updated_at', updated_flag.updated_at);
end;
$$;

revoke all on function public.set_platform_feature_flag(text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.set_platform_feature_flag(text, boolean) to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  marked_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_user_id = (select auth.uid())
  returning read_at into marked_at;

  if marked_at is null then
    raise exception using errcode = '42501', message = 'Notification is not available.';
  end if;
  return marked_at;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public, anon, authenticated, service_role;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.enqueue_race_summary_notification(
  p_recipient_user_id uuid,
  p_league_id uuid,
  p_source_event_id uuid,
  p_summary jsonb,
  p_dedupe_key text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  notification_id uuid;
begin
  if jsonb_typeof(p_summary) <> 'object' then
    raise exception using errcode = '22023', message = 'Race summary must be a JSON object.';
  end if;

  insert into public.user_notifications (
    recipient_user_id, league_id, source_event_id, notification_kind,
    title_key, body_key, payload, dedupe_key
  ) values (
    p_recipient_user_id, p_league_id, p_source_event_id, 'race_summary',
    'notification.raceSummary.title', 'notification.raceSummary.body', p_summary, p_dedupe_key
  )
  on conflict (recipient_user_id, dedupe_key) do update set dedupe_key = excluded.dedupe_key
  returning id into notification_id;
  return notification_id;
end;
$$;

revoke all on function public.enqueue_race_summary_notification(uuid, uuid, uuid, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.enqueue_race_summary_notification(uuid, uuid, uuid, jsonb, text) to service_role;

comment on table public.v2_audit_events is 'Append-only league and platform audit trail for V2 admin contexts.';
comment on table public.platform_feature_flags is 'Owner-controlled server feature flags; never assign platform ownership through league roles.';
comment on table public.user_notifications is 'Private in-app inbox with deterministic bundled race summaries.';
comment on function public.get_league_admin_workspace() is 'Actor-bound tenant admin overview; league admins remain in Driver Experience until they explicitly open Admin.';
comment on function public.get_owner_control_snapshot() is 'Actor-bound global Owner Control snapshot independent of league membership.';
comment on function public.enqueue_race_summary_notification(uuid, uuid, uuid, jsonb, text) is 'Backend-only deterministic race summary enqueue endpoint.';
