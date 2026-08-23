-- Cover join-request foreign keys used by identity cleanup and reviewer audits.

create index idx_league_join_requests_driver_identity
  on public.league_join_requests (driver_identity_id);

create index idx_league_join_requests_reviewed_by
  on public.league_join_requests (reviewed_by)
  where reviewed_by is not null;

