-- RaceVora AI analysis abuse/cost protection
-- Records only authenticated account + league usage and image-unit counts.

create table if not exists public.ai_analysis_usage (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_count smallint not null,
  requested_at timestamptz not null default now(),
  constraint ai_analysis_usage_image_count_check check (image_count between 1 and 8)
);

alter table public.ai_analysis_usage enable row level security;
revoke all on table public.ai_analysis_usage from public, anon, authenticated;
grant all on table public.ai_analysis_usage to service_role;

create index if not exists ai_analysis_usage_user_requested_idx
  on public.ai_analysis_usage (user_id, requested_at desc);
create index if not exists ai_analysis_usage_requested_idx
  on public.ai_analysis_usage (requested_at desc);

create or replace function public.consume_ai_analysis_quota(
  p_league_id uuid,
  p_image_count integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_platform_owner boolean := false;
  v_user_10m integer := 0;
  v_user_24h integer := 0;
  v_global_24h integer := 0;
  v_remaining integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_image_count is null or p_image_count < 1 or p_image_count > 8 then
    raise exception 'Image count must be between 1 and 8';
  end if;

  select lm.role into v_role
  from public.league_members lm
  where lm.league_id = p_league_id
    and lm.user_id = v_user_id;

  select exists (
    select 1 from public.platform_owners po where po.user_id = v_user_id
  ) into v_platform_owner;

  if not v_platform_owner and coalesce(v_role, '') not in ('owner', 'admin') then
    raise exception 'Owner or admin role required';
  end if;

  -- Serialize quota accounting so parallel requests cannot race past the cap.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('racevora:ai-analysis-quota', 0)
  );

  -- Keep the quota ledger intentionally short-lived; no long-term usage profile is needed.
  delete from public.ai_analysis_usage
  where requested_at < pg_catalog.now() - interval '7 days';

  select coalesce(sum(u.image_count), 0)::integer into v_user_10m
  from public.ai_analysis_usage u
  where u.user_id = v_user_id
    and u.requested_at >= pg_catalog.now() - interval '10 minutes';

  select coalesce(sum(u.image_count), 0)::integer into v_user_24h
  from public.ai_analysis_usage u
  where u.user_id = v_user_id
    and u.requested_at >= pg_catalog.now() - interval '24 hours';

  select coalesce(sum(u.image_count), 0)::integer into v_global_24h
  from public.ai_analysis_usage u
  where u.requested_at >= pg_catalog.now() - interval '24 hours';

  if v_user_10m + p_image_count > 48 then
    return jsonb_build_object(
      'allowed', false,
      'scope', 'user_burst',
      'retry_after_seconds', 600,
      'limit_images', 48
    );
  end if;

  if v_user_24h + p_image_count > 160 then
    return jsonb_build_object(
      'allowed', false,
      'scope', 'user_daily',
      'retry_after_seconds', 3600,
      'limit_images', 160
    );
  end if;

  if v_global_24h + p_image_count > 800 then
    return jsonb_build_object(
      'allowed', false,
      'scope', 'global_daily',
      'retry_after_seconds', 3600,
      'limit_images', 800
    );
  end if;

  insert into public.ai_analysis_usage (league_id, user_id, image_count)
  values (p_league_id, v_user_id, p_image_count);

  v_remaining := least(
    48 - (v_user_10m + p_image_count),
    160 - (v_user_24h + p_image_count),
    800 - (v_global_24h + p_image_count)
  );

  return jsonb_build_object(
    'allowed', true,
    'scope', 'ok',
    'remaining_image_units', greatest(v_remaining, 0)
  );
end;
$function$;

revoke all on function public.consume_ai_analysis_quota(uuid, integer) from public, anon;
grant execute on function public.consume_ai_analysis_quota(uuid, integer) to authenticated;

comment on table public.ai_analysis_usage is
  'Short-lived server-side quota ledger for authenticated RaceVora AI result-image analysis.';
comment on function public.consume_ai_analysis_quota(uuid, integer) is
  'Authorizes owner/admin AI analysis usage and atomically caps image units: 48/10m per user, 160/24h per user, 800/24h globally.';