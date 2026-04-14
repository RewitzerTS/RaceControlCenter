-- Regeln & FAQs Inhalte inkl. öffentlicher Rennkonfiguration
create table if not exists public.league_content (
  id text primary key,
  rules_text text not null default '',
  faq_text text not null default '',
  rules_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.touch_league_content_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_touch_league_content_updated_at on public.league_content;
create trigger trg_touch_league_content_updated_at
before update on public.league_content
for each row
execute function public.touch_league_content_updated_at();

alter table public.league_content enable row level security;

drop policy if exists "public read league content" on public.league_content;
create policy "public read league content"
on public.league_content
for select
using (true);

drop policy if exists "admins manage league content" on public.league_content;
create policy "admins manage league content"
on public.league_content
for all
using (public.is_app_admin())
with check (public.is_app_admin());

insert into public.league_content (id)
values ('default')
on conflict (id) do nothing;
