alter table if exists public.steward_incidents
  add column if not exists submitter_driver_id uuid references public.drivers(id),
  add column if not exists accused_driver_id uuid references public.drivers(id),
  add column if not exists time_adjustment_seconds integer not null default 0;

comment on column public.steward_incidents.submitter_driver_id is 'Fahrer 1 / Einreicher';
comment on column public.steward_incidents.accused_driver_id is 'Fahrer 2 / Beschuldigter';
comment on column public.steward_incidents.time_adjustment_seconds is 'Zeitstrafe oder Gutschrift in Sekunden';
