-- Race Control Center - assign existing production data to tenant #1
-- Step 2: create the default RCC league, preserve existing global admins,
-- and attach root data to the league without changing application queries yet.

begin;

insert into public.leagues (name, slug, created_by)
select 'Race Control Center', 'rcc', a.user_id
from public.app_admins a
order by a.created_at asc
limit 1
on conflict (slug) do nothing;

insert into public.league_members (league_id, user_id, role)
select l.id, a.user_id,
       case when row_number() over (order by a.created_at asc) = 1 then 'owner' else 'admin' end
from public.app_admins a
cross join public.leagues l
where l.slug = 'rcc'
on conflict (league_id, user_id) do update set role = excluded.role;

alter table public.seasons
  add column if not exists league_id uuid references public.leagues(id) on delete restrict;

alter table public.drivers
  add column if not exists league_id uuid references public.leagues(id) on delete restrict;

alter table public.league_content
  add column if not exists league_id uuid references public.leagues(id) on delete cascade;

update public.seasons
set league_id = (select id from public.leagues where slug = 'rcc')
where league_id is null;

update public.drivers
set league_id = (select id from public.leagues where slug = 'rcc')
where league_id is null;

update public.league_content
set league_id = (select id from public.leagues where slug = 'rcc')
where league_id is null;

alter table public.seasons alter column league_id set not null;
alter table public.drivers alter column league_id set not null;
alter table public.league_content alter column league_id set not null;

alter table public.seasons drop constraint if exists seasons_name_unique;
alter table public.seasons drop constraint if exists seasons_slug_key;
alter table public.seasons add constraint seasons_league_name_unique unique (league_id, name);
alter table public.seasons add constraint seasons_league_slug_unique unique (league_id, slug);

drop index if exists public.seasons_one_active_idx;
create unique index if not exists seasons_one_active_per_league_idx
  on public.seasons (league_id)
  where is_active = true;

alter table public.drivers drop constraint if exists drivers_display_name_unique;
drop index if exists public.drivers_gamertag_unique_idx;
alter table public.drivers add constraint drivers_league_display_name_unique unique (league_id, display_name);
create unique index if not exists drivers_league_gamertag_unique_idx
  on public.drivers (league_id, gamertag)
  where gamertag is not null;

alter table public.league_content drop constraint if exists league_content_pkey;
alter table public.league_content add constraint league_content_pkey primary key (league_id, id);

create index if not exists idx_seasons_league_id on public.seasons(league_id);
create index if not exists idx_drivers_league_id on public.drivers(league_id);
create index if not exists idx_league_content_league_id on public.league_content(league_id);

commit;
