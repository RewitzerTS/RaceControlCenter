-- RaceVora F1 news cache
-- Shared single-row cache for the public F1 news Edge Function.
-- Browser roles have no access; only server-side service_role code uses it.

create table if not exists public.f1_news_cache (
  cache_key text primary key,
  payload jsonb not null default '[]'::jsonb,
  source_status jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now(),
  constraint f1_news_cache_payload_is_array check (jsonb_typeof(payload) = 'array'),
  constraint f1_news_cache_source_status_is_object check (jsonb_typeof(source_status) = 'object')
);

alter table public.f1_news_cache enable row level security;

revoke all on table public.f1_news_cache from anon, authenticated;
grant all on table public.f1_news_cache to service_role;

comment on table public.f1_news_cache is
  'Server-only shared cache for RaceVora F1 news aggregation. No browser access.';
