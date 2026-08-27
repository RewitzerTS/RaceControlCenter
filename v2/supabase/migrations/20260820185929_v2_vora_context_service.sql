-- RaceVora V2 Phase 20: controlled Vora context service with deterministic fallback.
-- Vora receives no free SQL surface and no authorization beyond the current actor.

create table public.vora_context_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  driver_identity_id uuid not null references public.driver_identities(id) on delete cascade,
  context_fields text[] not null,
  insight_rule text not null,
  generated_at timestamptz not null default now(),
  constraint vora_context_fields_check check (cardinality(context_fields) between 1 and 12),
  constraint vora_context_rule_check check (insight_rule ~ '^[a-z][a-z0-9_]{2,79}$')
);

create index idx_vora_context_audit_actor_time on public.vora_context_audit (actor_user_id, generated_at desc);
create index idx_vora_context_audit_identity_time on public.vora_context_audit (driver_identity_id, generated_at desc);

alter table public.vora_context_audit enable row level security;
revoke all on table public.vora_context_audit from public, anon, authenticated;
grant select on table public.vora_context_audit to authenticated;
grant select, insert, update, delete on table public.vora_context_audit to service_role;

create policy "v2 users read own Vora context audit"
on public.vora_context_audit for select to authenticated
using ((select auth.uid()) is not null and actor_user_id = (select auth.uid()));

create trigger vora_context_audit_protect_history
before update or delete on public.vora_context_audit
for each row execute function private.protect_v2_audit_history();

create or replace function public.get_vora_companion_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  identity_id uuid;
  career public.driver_career_stats%rowtype;
  progression public.driver_progression%rowtype;
  recent_result public.career_result_facts%rowtype;
  active_challenges integer := 0;
  insight_rule text;
  insight_title_key text;
  insight_body_key text;
  fields text[] := array['career_stats', 'progression', 'recent_result', 'active_challenges'];
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not coalesce((select enabled from public.platform_feature_flags where flag_key = 'vora_enabled'), false) then
    raise exception using errcode = '55000', message = 'Vora is not enabled.';
  end if;

  select di.id into identity_id
  from public.driver_identities di
  where di.user_id = (select auth.uid()) and di.status = 'active';
  if identity_id is null then
    raise exception using errcode = '55000', message = 'An active Driver Identity is required.';
  end if;

  select * into career from public.driver_career_stats where driver_identity_id = identity_id;
  select * into progression from public.driver_progression where driver_identity_id = identity_id;
  select * into recent_result from public.career_result_facts where driver_identity_id = identity_id order by race_date desc nulls last, created_at desc limit 1;
  select count(*) into active_challenges from public.driver_challenges where driver_identity_id = identity_id and status = 'active';

  if coalesce(career.starts, 0) = 0 then
    insight_rule := 'first_race'; insight_title_key := 'vora.insight.firstRace.title'; insight_body_key := 'vora.insight.firstRace.body';
  elsif coalesce(progression.xp_to_next_level, 1000) between 1 and 250 then
    insight_rule := 'level_close'; insight_title_key := 'vora.insight.levelClose.title'; insight_body_key := 'vora.insight.levelClose.body';
  elsif recent_result.finish_position between 1 and 3 then
    insight_rule := 'recent_podium'; insight_title_key := 'vora.insight.podium.title'; insight_body_key := 'vora.insight.podium.body';
  elsif active_challenges > 0 then
    insight_rule := 'active_challenge'; insight_title_key := 'vora.insight.challenge.title'; insight_body_key := 'vora.insight.challenge.body';
  else
    insight_rule := 'career_consistency'; insight_title_key := 'vora.insight.consistency.title'; insight_body_key := 'vora.insight.consistency.body';
  end if;

  insert into public.vora_context_audit (actor_user_id, driver_identity_id, context_fields, insight_rule)
  values ((select auth.uid()), identity_id, fields, insight_rule);

  return jsonb_build_object(
    'source', 'deterministic_v1',
    'generated_at', now(),
    'insight', jsonb_build_object('rule', insight_rule, 'title_key', insight_title_key, 'body_key', insight_body_key),
    'career', jsonb_build_object(
      'starts', coalesce(career.starts, 0), 'wins', coalesce(career.wins, 0), 'podiums', coalesce(career.podiums, 0),
      'average_finish', career.average_finish, 'last_race_date', career.last_race_date
    ),
    'progression', jsonb_build_object(
      'level', coalesce(progression.level, 1), 'rank', coalesce(progression.rank, 'Rookie'),
      'lifetime_xp', coalesce(progression.lifetime_xp, 0), 'xp_to_next_level', coalesce(progression.xp_to_next_level, 1000)
    ),
    'recent_result', case when recent_result.id is null then null else jsonb_build_object(
      'finish_position', recent_result.finish_position, 'grid_position', recent_result.grid_position,
      'classification_status', recent_result.classification_status, 'race_date', recent_result.race_date
    ) end,
    'active_challenges', active_challenges,
    'context_fields', to_jsonb(fields)
  );
end;
$$;

revoke all on function public.get_vora_companion_snapshot() from public, anon, authenticated, service_role;
grant execute on function public.get_vora_companion_snapshot() to authenticated;

update public.platform_feature_flags
set enabled = true, updated_at = now()
where flag_key = 'vora_enabled';

comment on table public.vora_context_audit is 'Minimal append-only proof of which controlled fields Vora used; contains no prompts or free-form private data.';
comment on function public.get_vora_companion_snapshot() is 'Actor-bound controlled Context Service. Returns only the current user own racing projections and deterministic insight keys; never executes user-provided SQL.';
