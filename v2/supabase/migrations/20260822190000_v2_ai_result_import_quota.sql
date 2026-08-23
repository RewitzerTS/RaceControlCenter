-- Restores the V1 image-result analysis for V2 with actor and tenant-bound cost limits.
-- This migration is additive and is intended only for the isolated V2 Supabase project.

create table private.ai_analysis_usage (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  image_count integer not null check (image_count between 1 and 8),
  created_at timestamptz not null default now()
);

create index ai_analysis_usage_actor_created_idx
  on private.ai_analysis_usage (actor_user_id, created_at desc);

create index ai_analysis_usage_league_created_idx
  on private.ai_analysis_usage (league_id, created_at desc);

revoke all on table private.ai_analysis_usage from public, anon, authenticated;
grant select, insert, delete on table private.ai_analysis_usage to service_role;

create or replace function public.consume_ai_analysis_quota(
  p_league_id uuid,
  p_image_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_hour_units integer;
  league_month_units integer;
  actor_limit constant integer := 32;
  league_limit constant integer := 400;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_image_count is null or p_image_count not between 1 and 8 then
    raise exception using errcode = '22023', message = 'Image count must be between 1 and 8.';
  end if;
  if not private.has_league_capability(p_league_id, 'league_admin') then
    raise exception using errcode = '42501', message = 'AI result analysis access denied.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_league_id::text || actor_id::text, 0));

  select coalesce(sum(u.image_count), 0)::integer
    into actor_hour_units
  from private.ai_analysis_usage u
  where u.actor_user_id = actor_id
    and u.created_at >= now() - interval '1 hour';

  select coalesce(sum(u.image_count), 0)::integer
    into league_month_units
  from private.ai_analysis_usage u
  where u.league_id = p_league_id
    and u.created_at >= date_trunc('month', now());

  if actor_hour_units + p_image_count > actor_limit then
    return jsonb_build_object(
      'allowed', false,
      'scope', 'actor_hour',
      'retry_after_seconds', 3600
    );
  end if;
  if league_month_units + p_image_count > league_limit then
    return jsonb_build_object(
      'allowed', false,
      'scope', 'league_month',
      'retry_after_seconds', greatest(60, extract(epoch from (date_trunc('month', now()) + interval '1 month' - now()))::integer)
    );
  end if;

  insert into private.ai_analysis_usage (league_id, actor_user_id, image_count)
  values (p_league_id, actor_id, p_image_count);

  return jsonb_build_object(
    'allowed', true,
    'scope', 'ok',
    'remaining_image_units', least(actor_limit - actor_hour_units - p_image_count, league_limit - league_month_units - p_image_count)
  );
end;
$$;

revoke all on function public.consume_ai_analysis_quota(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_ai_analysis_quota(uuid, integer)
  to authenticated, service_role;

comment on function public.consume_ai_analysis_quota(uuid, integer) is
  'Reserves tenant-bound image-analysis units before a paid AI call; no production race data is modified.';
