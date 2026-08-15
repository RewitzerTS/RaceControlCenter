-- Sprint support for race weekends.
alter table public.races
  add column if not exists has_sprint boolean not null default false;

comment on column public.races.has_sprint is 'Whether this race weekend includes a sprint race.';
