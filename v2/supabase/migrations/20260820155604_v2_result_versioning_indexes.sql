-- Phase 6 follow-up: cover every new foreign key used by lifecycle and attribution queries.

create index idx_result_versions_created_by
  on public.result_versions (created_by)
  where created_by is not null;
create index idx_result_versions_validated_by
  on public.result_versions (validated_by)
  where validated_by is not null;
create index idx_result_versions_activated_by
  on public.result_versions (activated_by)
  where activated_by is not null;
create index idx_result_versions_voided_by
  on public.result_versions (voided_by)
  where voided_by is not null;
create index idx_result_version_rows_points_owner_driver_id
  on public.result_version_rows (points_owner_driver_id)
  where points_owner_driver_id is not null;
create index idx_race_results_points_owner_driver_id
  on public.race_results (points_owner_driver_id)
  where points_owner_driver_id is not null;
