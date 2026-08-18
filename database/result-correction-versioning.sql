-- RaceVora result correction versioning
-- Keep published imports immutable while allowing one new draft/review version per race.

alter table public.race_result_imports
  drop constraint if exists race_result_imports_race_unique;

create unique index if not exists race_result_imports_one_open_per_race
  on public.race_result_imports (race_id)
  where status in ('draft', 'under_review');

create index if not exists race_result_imports_published_history_idx
  on public.race_result_imports (race_id, published_at desc)
  where status = 'published';
