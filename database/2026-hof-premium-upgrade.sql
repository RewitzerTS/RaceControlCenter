alter table public.championship_history
  add column if not exists season_name text,
  add column if not exists driver_champion_team text,
  add column if not exists constructor_champion_lineup text;

update public.seasons
set name = '15'
where is_active = true;

update public.championship_history ch
set season_name = s.name
from public.seasons s
where s.id = ch.season_id
  and (ch.season_name is null or ch.season_name = '');
