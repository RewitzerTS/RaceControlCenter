alter table public.championship_history
  add column if not exists season_name text,
  add column if not exists driver_champion_team text,
  add column if not exists constructor_champion_lineup text;

update public.seasons
set name = '15'
where is_active = true and (name = '2026' or name = 'Saison 2026');
