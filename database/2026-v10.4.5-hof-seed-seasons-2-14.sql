alter table public.championship_history
  add column if not exists season_name text,
  add column if not exists driver_champion_team text,
  add column if not exists constructor_champion_lineup text;

with source(season_name, driver_champion, driver_champion_team, constructor_champion, constructor_champion_lineup) as (
  values
    ('2',  'Fabian',  'Alpha Tauri',              'Alpha Tauri',              'Davide(Yuki Tsunoda) & Fabian(Pierre Gasly)'),
    ('3',  'Davide',  'Alfa Romeo',               'Alfa Romeo',               'Davide(Kimi Räikkönen) & Fabian(Antonio Giovinazzi)'),
    ('4',  'Davide',  'Haas',                     'Haas',                     'Davide(Mick Schumacher) & Fabian(Nikita Mazepin)'),
    ('5',  'Davide',  'Haas',                     'Haas',                     'Davide(Mick Schumacher) & Fabian(Nikita Mazepin)'),
    ('6',  'Davide',  'Haas',                     'Alfa Romeo',               'Fabian(Kimi Raikkönen) & Jannick(Antonio Giovinazzi)'),
    ('7',  'Jannick', 'Alpine',                   'Alpine',                   'Jannick(Fernando Alonso) & Jannis(Esteban Ocon)'),
    ('8',  'Davide',  'Alpha Tauri',              'Alpha Tauri',              'Davide(Yuki Tsunoda) & Fabian(Daniel Ricciardo)'),
    ('9',  'Davide',  'Alpha Tauri',              'Alpha Tauri',              'Davide(Yuki Tsunoda) & Fabian(Daniel Ricciardo)'),
    ('10', 'Diogo',   'Team Portugal',            'Team RusIta',              'Davide(Yuki Tsunoda) & Maxim(Max Verstappen)'),
    ('11', 'Davide',  'Team RusIta',              'Team RusIta',              'Davide(Yuki Tsunoda) & Maxim(Max Verstappen)'),
    ('12', 'Richard', 'Team Kiesbett Connection', 'Team Kiesbett Connection', 'Jasmin(Sergio Perez) & Richard(Logan Sargeant)'),
    ('13', 'Davide',  'Team RusIta',              'Team RusIta',              'Davide(Zhou Guanyu) & Maxim(Oscar Piastri)'),
    ('14', 'Richard', 'Team Kiesbett Connection', 'Team RusIta',              'Davide(Zhou Guanyu) & Maxim(Oscar Piastri)')
), resolved as (
  select s.id as season_id, source.*
  from source
  join public.seasons s on s.name in (source.season_name, 'Saison ' || source.season_name)
)
insert into public.championship_history (
  season_id,
  season_name,
  driver_champion,
  driver_champion_team,
  constructor_champion,
  constructor_champion_lineup
)
select season_id, season_name, driver_champion, driver_champion_team, constructor_champion, constructor_champion_lineup
from resolved
on conflict (season_id)
do update set
  season_name = excluded.season_name,
  driver_champion = excluded.driver_champion,
  driver_champion_team = excluded.driver_champion_team,
  constructor_champion = excluded.constructor_champion,
  constructor_champion_lineup = excluded.constructor_champion_lineup;
