begin;

alter table public.race_results
  drop constraint if exists race_results_source_assignment_id_fkey;

alter table public.race_results
  add constraint race_results_source_assignment_id_fkey
  foreign key (source_assignment_id)
  references public.driver_slot_assignments(id)
  on delete set null;

commit;
