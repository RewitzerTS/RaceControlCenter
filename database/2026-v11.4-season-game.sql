-- Race Control Center · Season game mapping (F1 25/F1 26)

begin;

alter table public.seasons
  add column if not exists game_key text not null default 'f1_25';

alter table public.seasons
  add column if not exists game_label text not null default 'F1 25';

update public.seasons
set game_key = coalesce(nullif(trim(game_key), ''), 'f1_25'),
    game_label = case
      when coalesce(nullif(trim(game_key), ''), 'f1_25') = 'f1_26' then 'F1 26'
      else 'F1 25'
    end
where true;

commit;
