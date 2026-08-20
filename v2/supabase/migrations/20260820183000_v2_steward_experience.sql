-- RaceVora V2 Phase 16: tenant-safe stewarding with immutable decisions and result revisions.
-- This migration is additive to V2 staging and must never run on the V1 Production project.

create table private.steward_case_counters (
  league_id uuid not null references public.leagues(id) on delete cascade,
  case_year integer not null,
  next_number integer not null default 1 check (next_number > 0),
  primary key (league_id, case_year)
);

create table public.steward_cases (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  race_id uuid not null references public.races(id) on delete restrict,
  case_number text not null,
  status text not null default 'under_review',
  title text not null,
  description text not null,
  reported_driver_id uuid references public.drivers(id) on delete restrict,
  accused_driver_id uuid not null references public.drivers(id) on delete restrict,
  rule_code text not null,
  rule_version text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  current_decision_version integer,
  idempotency_key text not null,
  constraint steward_cases_league_number_unique unique (league_id, case_number),
  constraint steward_cases_actor_idempotency_unique unique (created_by, idempotency_key),
  constraint steward_cases_status_check check (status in ('under_review', 'closed', 'appealed', 'withdrawn')),
  constraint steward_cases_title_length_check check (char_length(btrim(title)) between 4 and 140),
  constraint steward_cases_description_length_check check (char_length(btrim(description)) between 10 and 4000),
  constraint steward_cases_rule_code_length_check check (char_length(btrim(rule_code)) between 1 and 80),
  constraint steward_cases_rule_version_length_check check (char_length(btrim(rule_version)) between 1 and 80),
  constraint steward_cases_idempotency_length_check check (char_length(idempotency_key) between 8 and 160),
  constraint steward_cases_closed_state_check check (
    (status in ('closed', 'appealed') and closed_at is not null and current_decision_version is not null)
    or (status in ('under_review', 'withdrawn') and current_decision_version is null)
  )
);

create index idx_steward_cases_league_status_created
  on public.steward_cases (league_id, status, created_at desc);
create index idx_steward_cases_race on public.steward_cases (race_id, created_at desc);
create index idx_steward_cases_accused on public.steward_cases (accused_driver_id, created_at desc);
create index idx_steward_cases_reported on public.steward_cases (reported_driver_id) where reported_driver_id is not null;

create table public.steward_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.steward_cases(id) on delete restrict,
  evidence_kind text not null,
  uri text,
  description text not null,
  is_public boolean not null default false,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  idempotency_key text not null,
  constraint steward_evidence_actor_idempotency_unique unique (submitted_by, idempotency_key),
  constraint steward_evidence_kind_check check (evidence_kind in ('video', 'image', 'telemetry', 'statement', 'document', 'other')),
  constraint steward_evidence_uri_length_check check (uri is null or char_length(uri) between 8 and 1000),
  constraint steward_evidence_description_length_check check (char_length(btrim(description)) between 3 and 2000),
  constraint steward_evidence_idempotency_length_check check (char_length(idempotency_key) between 8 and 160)
);

create index idx_steward_evidence_case on public.steward_evidence (case_id, submitted_at);

create table public.steward_votes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.steward_cases(id) on delete restrict,
  steward_user_id uuid not null references auth.users(id) on delete restrict,
  vote_version integer not null,
  outcome text not null,
  reasoning text not null,
  conflict_disclosed boolean not null default false,
  supersedes_vote_id uuid references public.steward_votes(id) on delete restrict,
  cast_at timestamptz not null default now(),
  idempotency_key text not null,
  constraint steward_votes_case_steward_version_unique unique (case_id, steward_user_id, vote_version),
  constraint steward_votes_actor_idempotency_unique unique (steward_user_id, idempotency_key),
  constraint steward_votes_outcome_check check (outcome in ('no_action', 'warning', 'penalty', 'dismissed')),
  constraint steward_votes_version_positive_check check (vote_version > 0),
  constraint steward_votes_reasoning_length_check check (char_length(btrim(reasoning)) between 5 and 2000),
  constraint steward_votes_idempotency_length_check check (char_length(idempotency_key) between 8 and 160)
);

create index idx_steward_votes_case on public.steward_votes (case_id, cast_at desc);
create index idx_steward_votes_supersedes on public.steward_votes (supersedes_vote_id) where supersedes_vote_id is not null;

create table public.steward_decision_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.steward_cases(id) on delete restrict,
  version_number integer not null,
  outcome text not null,
  reasoning text not null,
  rule_code text not null,
  rule_version text not null,
  finalized_by uuid not null references auth.users(id) on delete restrict,
  finalized_at timestamptz not null default now(),
  result_version_id uuid not null references public.result_versions(id) on delete restrict,
  idempotency_key text not null,
  constraint steward_decisions_case_version_unique unique (case_id, version_number),
  constraint steward_decisions_actor_idempotency_unique unique (finalized_by, idempotency_key),
  constraint steward_decisions_version_positive_check check (version_number > 0),
  constraint steward_decisions_outcome_check check (outcome in ('no_action', 'warning', 'penalty', 'dismissed')),
  constraint steward_decisions_reasoning_length_check check (char_length(btrim(reasoning)) between 10 and 4000),
  constraint steward_decisions_rule_code_length_check check (char_length(btrim(rule_code)) between 1 and 80),
  constraint steward_decisions_rule_version_length_check check (char_length(btrim(rule_version)) between 1 and 80),
  constraint steward_decisions_idempotency_length_check check (char_length(idempotency_key) between 8 and 160)
);

create index idx_steward_decisions_case on public.steward_decision_versions (case_id, version_number desc);
create index idx_steward_decisions_result_version on public.steward_decision_versions (result_version_id);

create table public.steward_penalties (
  id uuid primary key default gen_random_uuid(),
  decision_version_id uuid not null references public.steward_decision_versions(id) on delete restrict,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  penalty_type text not null,
  time_delta_ms integer,
  points_delta numeric(7,2),
  reason text not null,
  created_at timestamptz not null default now(),
  constraint steward_penalties_type_check check (penalty_type in ('warning', 'time_penalty', 'points_penalty', 'disqualification')),
  constraint steward_penalties_payload_check check (
    (penalty_type = 'warning' and time_delta_ms is null and points_delta is null)
    or (penalty_type = 'time_penalty' and time_delta_ms > 0 and points_delta is null)
    or (penalty_type = 'points_penalty' and points_delta < 0 and time_delta_ms is null)
    or (penalty_type = 'disqualification' and time_delta_ms is null and points_delta is null)
  ),
  constraint steward_penalties_reason_length_check check (char_length(btrim(reason)) between 3 and 500)
);

create index idx_steward_penalties_decision on public.steward_penalties (decision_version_id);
create index idx_steward_penalties_driver on public.steward_penalties (driver_id);

create table public.steward_appeals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.steward_cases(id) on delete restrict,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  reason text not null,
  status text not null default 'submitted',
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  resolution_note text,
  idempotency_key text not null,
  constraint steward_appeals_actor_idempotency_unique unique (submitted_by, idempotency_key),
  constraint steward_appeals_status_check check (status in ('submitted', 'accepted', 'rejected', 'withdrawn')),
  constraint steward_appeals_reason_length_check check (char_length(btrim(reason)) between 10 and 3000),
  constraint steward_appeals_idempotency_length_check check (char_length(idempotency_key) between 8 and 160),
  constraint steward_appeals_resolution_check check (
    (status = 'submitted' and resolved_at is null and resolved_by is null and resolution_note is null)
    or (status <> 'submitted' and resolved_at is not null and resolved_by is not null and char_length(btrim(resolution_note)) between 3 and 2000)
  )
);

create index idx_steward_appeals_case on public.steward_appeals (case_id, submitted_at desc);
create index idx_steward_appeals_resolved_by on public.steward_appeals (resolved_by) where resolved_by is not null;

create table public.steward_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.steward_cases(id) on delete restrict,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint steward_case_events_type_check check (event_type in ('case_created', 'evidence_added', 'vote_cast', 'decision_finalized', 'appeal_submitted')),
  constraint steward_case_events_payload_object_check check (jsonb_typeof(payload) = 'object')
);

create index idx_steward_case_events_case on public.steward_case_events (case_id, occurred_at);
create index idx_steward_case_events_actor on public.steward_case_events (actor_user_id) where actor_user_id is not null;

alter table public.steward_cases enable row level security;
alter table public.steward_evidence enable row level security;
alter table public.steward_votes enable row level security;
alter table public.steward_decision_versions enable row level security;
alter table public.steward_penalties enable row level security;
alter table public.steward_appeals enable row level security;
alter table public.steward_case_events enable row level security;

revoke all on table public.steward_cases, public.steward_evidence, public.steward_votes,
  public.steward_decision_versions, public.steward_penalties, public.steward_appeals,
  public.steward_case_events from public, anon, authenticated;
grant select on table public.steward_cases, public.steward_evidence, public.steward_votes,
  public.steward_decision_versions, public.steward_penalties, public.steward_appeals,
  public.steward_case_events to anon, authenticated;
grant select, insert, update, delete on table public.steward_cases, public.steward_evidence,
  public.steward_votes, public.steward_decision_versions, public.steward_penalties,
  public.steward_appeals, public.steward_case_events to service_role;

create or replace function private.can_read_steward_case(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.steward_cases sc
    join public.leagues l on l.id = sc.league_id
    where sc.id = p_case_id
      and (
        (
          sc.status in ('closed', 'appealed')
          and l.is_public
          and l.status = 'active'
          and coalesce(l.settings ->> 'published', 'true') = 'true'
          and public.matches_requested_league(sc.league_id)
        )
        or (
          (select auth.uid()) is not null
          and public.matches_requested_league(sc.league_id)
          and (
            private.has_league_capability(sc.league_id, 'steward')
            or exists (
              select 1
              from public.driver_identities di
              join public.driver_identity_links dil on dil.driver_identity_id = di.id
              where di.user_id = (select auth.uid())
                and dil.driver_id in (sc.reported_driver_id, sc.accused_driver_id)
            )
          )
        )
      )
  );
$$;

revoke all on function private.can_read_steward_case(uuid) from public, anon, authenticated, service_role;
grant execute on function private.can_read_steward_case(uuid) to anon, authenticated;

create or replace function private.can_read_private_steward_case(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.steward_cases sc
      where sc.id = p_case_id
        and public.matches_requested_league(sc.league_id)
        and private.has_league_capability(sc.league_id, 'steward')
    );
$$;

revoke all on function private.can_read_private_steward_case(uuid) from public, anon, authenticated, service_role;
grant execute on function private.can_read_private_steward_case(uuid) to anon, authenticated;

create policy "v2 readable steward cases"
on public.steward_cases for select to anon, authenticated
using ((select private.can_read_steward_case(id)));

create policy "v2 readable public steward evidence"
on public.steward_evidence for select to anon, authenticated
using (
  (select private.can_read_steward_case(case_id))
  and (
    is_public
    or (select private.can_read_private_steward_case(case_id))
  )
);

create policy "v2 readable steward votes"
on public.steward_votes for select to authenticated
using ((select private.can_read_steward_case(case_id)));

create policy "v2 readable steward decisions"
on public.steward_decision_versions for select to anon, authenticated
using ((select private.can_read_steward_case(case_id)));

create policy "v2 readable steward penalties"
on public.steward_penalties for select to anon, authenticated
using (exists (
  select 1 from public.steward_decision_versions sdv
  where sdv.id = decision_version_id
    and (select private.can_read_steward_case(sdv.case_id))
));

create policy "v2 readable steward appeals"
on public.steward_appeals for select to authenticated
using ((select private.can_read_steward_case(case_id)));

create policy "v2 readable steward case events"
on public.steward_case_events for select to authenticated
using ((select private.can_read_steward_case(case_id)));

create or replace function private.protect_steward_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '23514', message = 'Steward records are append-only.';
end;
$$;

revoke all on function private.protect_steward_history() from public, anon, authenticated, service_role;

create trigger steward_evidence_protect before update or delete on public.steward_evidence
for each row execute function private.protect_steward_history();
create trigger steward_votes_protect before update or delete on public.steward_votes
for each row execute function private.protect_steward_history();
create trigger steward_decisions_protect before update or delete on public.steward_decision_versions
for each row execute function private.protect_steward_history();
create trigger steward_penalties_protect before update or delete on public.steward_penalties
for each row execute function private.protect_steward_history();
create trigger steward_events_protect before update or delete on public.steward_case_events
for each row execute function private.protect_steward_history();

create or replace function public.create_steward_case(
  p_race_id uuid,
  p_reported_driver_id uuid,
  p_accused_driver_id uuid,
  p_title text,
  p_description text,
  p_rule_code text,
  p_rule_version text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_league_id uuid;
  target_case public.steward_cases%rowtype;
  sequence_number integer;
  target_case_year integer := extract(year from current_date)::integer;
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;

  select s.league_id into target_league_id
  from public.races r join public.seasons s on s.id = r.season_id
  where r.id = p_race_id;

  if target_league_id is null or not public.matches_requested_league(target_league_id)
     or not private.has_league_capability(target_league_id, 'steward') then
    raise exception using errcode = '42501', message = 'Steward capability required for the requested league.';
  end if;

  if not exists (select 1 from public.drivers d where d.id = p_accused_driver_id and d.league_id = target_league_id)
     or (p_reported_driver_id is not null and not exists (
       select 1 from public.drivers d where d.id = p_reported_driver_id and d.league_id = target_league_id
     )) then
    raise exception using errcode = '23514', message = 'Case drivers must belong to the race league.';
  end if;

  select * into target_case from public.steward_cases
  where created_by = actor_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id', target_case.id, 'case_number', target_case.case_number, 'status', target_case.status);
  end if;

  insert into private.steward_case_counters (league_id, case_year, next_number)
  values (target_league_id, target_case_year, 2)
  on conflict (league_id, case_year) do update
    set next_number = private.steward_case_counters.next_number + 1
  returning next_number - 1 into sequence_number;

  insert into public.steward_cases (
    league_id, race_id, case_number, title, description, reported_driver_id,
    accused_driver_id, rule_code, rule_version, created_by, idempotency_key
  ) values (
    target_league_id, p_race_id,
    format('RV-%s-%s', target_case_year, lpad(sequence_number::text, 4, '0')),
    btrim(p_title), btrim(p_description), p_reported_driver_id,
    p_accused_driver_id, btrim(p_rule_code), btrim(p_rule_version), actor_id, p_idempotency_key
  ) returning * into target_case;

  insert into public.steward_case_events (case_id, event_type, actor_user_id, payload)
  values (target_case.id, 'case_created', actor_id, jsonb_build_object('case_number', target_case.case_number));

  return jsonb_build_object('id', target_case.id, 'case_number', target_case.case_number, 'status', target_case.status);
end;
$$;

create or replace function public.add_steward_evidence(
  p_case_id uuid, p_evidence_kind text, p_uri text, p_description text,
  p_is_public boolean, p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); target_case public.steward_cases%rowtype; evidence_id uuid;
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;
  select * into target_case from public.steward_cases where id = p_case_id for update;
  if not found or target_case.status <> 'under_review' or not public.matches_requested_league(target_case.league_id)
     or not private.has_league_capability(target_case.league_id, 'steward') then
    raise exception using errcode = '42501', message = 'Open steward case access required.';
  end if;
  select id into evidence_id from public.steward_evidence where submitted_by = actor_id and idempotency_key = p_idempotency_key;
  if evidence_id is null then
    insert into public.steward_evidence (case_id, evidence_kind, uri, description, is_public, submitted_by, idempotency_key)
    values (p_case_id, p_evidence_kind, nullif(btrim(p_uri), ''), btrim(p_description), p_is_public, actor_id, p_idempotency_key)
    returning id into evidence_id;
    insert into public.steward_case_events (case_id, event_type, actor_user_id, payload)
    values (p_case_id, 'evidence_added', actor_id, jsonb_build_object('evidence_id', evidence_id, 'kind', p_evidence_kind));
  end if;
  return jsonb_build_object('id', evidence_id);
end;
$$;

create or replace function public.cast_steward_vote(
  p_case_id uuid, p_outcome text, p_reasoning text, p_conflict_disclosed boolean, p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); target_case public.steward_cases%rowtype; vote_id uuid; previous_id uuid; next_version integer;
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;
  select * into target_case from public.steward_cases where id = p_case_id for update;
  if not found or target_case.status <> 'under_review' or not public.matches_requested_league(target_case.league_id)
     or not private.has_league_capability(target_case.league_id, 'steward') then
    raise exception using errcode = '42501', message = 'Open steward case access required.';
  end if;
  select id into vote_id from public.steward_votes where steward_user_id = actor_id and idempotency_key = p_idempotency_key;
  if vote_id is null then
    select id, vote_version into previous_id, next_version from public.steward_votes
    where case_id = p_case_id and steward_user_id = actor_id order by vote_version desc limit 1;
    next_version := coalesce(next_version, 0) + 1;
    insert into public.steward_votes (case_id, steward_user_id, vote_version, outcome, reasoning, conflict_disclosed, supersedes_vote_id, idempotency_key)
    values (p_case_id, actor_id, next_version, p_outcome, btrim(p_reasoning), p_conflict_disclosed, previous_id, p_idempotency_key)
    returning id into vote_id;
    insert into public.steward_case_events (case_id, event_type, actor_user_id, payload)
    values (p_case_id, 'vote_cast', actor_id, jsonb_build_object('vote_id', vote_id, 'version', next_version, 'conflict_disclosed', p_conflict_disclosed));
  end if;
  return jsonb_build_object('id', vote_id, 'version', next_version);
end;
$$;

create or replace function public.finalize_steward_decision(
  p_case_id uuid, p_outcome text, p_reasoning text, p_rule_code text,
  p_rule_version text, p_penalties jsonb, p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  target_case public.steward_cases%rowtype;
  current_result_id uuid;
  new_result_id uuid;
  decision_id uuid;
  decision_number integer;
  penalty jsonb;
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;
  select * into target_case from public.steward_cases where id = p_case_id for update;
  if not found or target_case.status <> 'under_review' or not public.matches_requested_league(target_case.league_id)
     or not private.has_league_capability(target_case.league_id, 'steward') then
    raise exception using errcode = '42501', message = 'Open steward case access required.';
  end if;
  if jsonb_typeof(coalesce(p_penalties, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_penalties, '[]'::jsonb)) > 10 then
    raise exception using errcode = '22023', message = 'Penalties must be an array with at most ten entries.';
  end if;
  if p_outcome = 'penalty' and jsonb_array_length(coalesce(p_penalties, '[]'::jsonb)) = 0 then
    raise exception using errcode = '23514', message = 'A penalty decision requires a structured penalty.';
  end if;
  if p_outcome <> 'penalty' and jsonb_array_length(coalesce(p_penalties, '[]'::jsonb)) > 0 then
    raise exception using errcode = '23514', message = 'Only a penalty decision may carry penalties.';
  end if;
  if not exists (select 1 from public.steward_votes sv where sv.case_id = p_case_id) then
    raise exception using errcode = '23514', message = 'At least one steward vote is required.';
  end if;
  if exists (
    select 1 from public.steward_votes sv
    where sv.case_id = p_case_id and sv.steward_user_id = actor_id and sv.conflict_disclosed
      and sv.vote_version = (select max(sv2.vote_version) from public.steward_votes sv2 where sv2.case_id = p_case_id and sv2.steward_user_id = actor_id)
  ) then
    raise exception using errcode = '23514', message = 'A steward with a disclosed conflict cannot finalize this case.';
  end if;
  select r.current_result_version_id into current_result_id from public.races r where r.id = target_case.race_id for update;
  if current_result_id is null then raise exception using errcode = '23514', message = 'A steward decision requires a currently published race result.'; end if;

  select id, version_number into decision_id, decision_number
  from public.steward_decision_versions where finalized_by = actor_id and idempotency_key = p_idempotency_key;
  if decision_id is not null then
    return jsonb_build_object('id', decision_id, 'version', decision_number);
  end if;

  decision_number := coalesce(target_case.current_decision_version, 0) + 1;
  new_result_id := private.create_result_version(
    target_case.race_id,
    format('Steward decision %s v%s', target_case.case_number, decision_number),
    current_result_id,
    null
  );

  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, team_id, source_assignment_id,
    car_name_snapshot, ai_driver_reference_snapshot, grid_position, finish_position,
    race_time_ms, fastest_lap_time_ms, pit_stops, participation_status,
    classification_status, base_points, penalty_time_delta_ms, awarded_points, notes,
    fastest_lap_time, race_time, points_owner_driver_id, points_team_name,
    points_car_name, points, fastest_lap_ms
  )
  select new_result_id, row_order, driver_id, team_id, source_assignment_id,
    car_name_snapshot, ai_driver_reference_snapshot, grid_position, finish_position,
    race_time_ms, fastest_lap_time_ms, pit_stops, participation_status,
    classification_status, base_points, penalty_time_delta_ms, awarded_points, notes,
    fastest_lap_time, race_time, points_owner_driver_id, points_team_name,
    points_car_name, points, fastest_lap_ms
  from public.result_version_rows where result_version_id = current_result_id;

  insert into public.steward_decision_versions (
    case_id, version_number, outcome, reasoning, rule_code, rule_version,
    finalized_by, result_version_id, idempotency_key
  ) values (
    p_case_id, decision_number, p_outcome, btrim(p_reasoning), btrim(p_rule_code),
    btrim(p_rule_version), actor_id, new_result_id, p_idempotency_key
  ) returning id into decision_id;

  for penalty in select value from jsonb_array_elements(coalesce(p_penalties, '[]'::jsonb)) loop
    if coalesce(penalty ->> 'driver_id', '') <> target_case.accused_driver_id::text then
      raise exception using errcode = '23514', message = 'A penalty driver must match the accused driver.';
    end if;
    insert into public.steward_penalties (decision_version_id, driver_id, penalty_type, time_delta_ms, points_delta, reason)
    values (
      decision_id, (penalty ->> 'driver_id')::uuid, penalty ->> 'penalty_type',
      nullif(penalty ->> 'time_delta_ms', '')::integer,
      nullif(penalty ->> 'points_delta', '')::numeric,
      btrim(penalty ->> 'reason')
    );

    if penalty ->> 'penalty_type' = 'time_penalty' then
      update public.result_version_rows
      set penalty_time_delta_ms = penalty_time_delta_ms + (penalty ->> 'time_delta_ms')::integer,
          notes = concat_ws(E'\n', nullif(notes, ''), format('%s: +%sms', target_case.case_number, penalty ->> 'time_delta_ms'))
      where result_version_id = new_result_id and driver_id = target_case.accused_driver_id;
    elsif penalty ->> 'penalty_type' = 'points_penalty' then
      update public.result_version_rows
      set awarded_points = greatest(0, awarded_points + (penalty ->> 'points_delta')::numeric),
          points = greatest(0, points + (penalty ->> 'points_delta')::numeric),
          notes = concat_ws(E'\n', nullif(notes, ''), format('%s: %s points', target_case.case_number, penalty ->> 'points_delta'))
      where result_version_id = new_result_id and driver_id = target_case.accused_driver_id;
    elsif penalty ->> 'penalty_type' = 'disqualification' then
      update public.result_version_rows
      set classification_status = 'dsq', finish_position = null, awarded_points = 0, points = 0,
          notes = concat_ws(E'\n', nullif(notes, ''), format('%s: disqualification', target_case.case_number))
      where result_version_id = new_result_id and driver_id = target_case.accused_driver_id;
    end if;
  end loop;

  if not exists (select 1 from public.result_version_rows where result_version_id = new_result_id and driver_id = target_case.accused_driver_id) then
    raise exception using errcode = '23514', message = 'The accused driver is not present in the current official result.';
  end if;

  with ordered as (
    select id, row_number() over (order by race_time_ms + penalty_time_delta_ms, row_order)::integer as next_position
    from public.result_version_rows
    where result_version_id = new_result_id and classification_status = 'classified' and race_time_ms is not null
  )
  update public.result_version_rows rvr set finish_position = ordered.next_position
  from ordered where rvr.id = ordered.id;

  perform private.validate_result_version(new_result_id);
  perform private.activate_result_version(new_result_id);

  update public.steward_cases set status = 'closed', closed_at = now(), current_decision_version = decision_number
  where id = p_case_id;
  insert into public.steward_case_events (case_id, event_type, actor_user_id, payload)
  values (p_case_id, 'decision_finalized', actor_id, jsonb_build_object('decision_id', decision_id, 'result_version_id', new_result_id, 'version', decision_number));
  perform private.emit_domain_event(
    'steward.decision_finalized', 'steward_case', p_case_id, target_case.league_id,
    jsonb_build_object('case_number', target_case.case_number, 'decision_id', decision_id, 'race_id', target_case.race_id),
    format('steward-case:%s:decision:%s', p_case_id, decision_number), new_result_id, actor_id, now()
  );
  return jsonb_build_object('id', decision_id, 'version', decision_number, 'result_version_id', new_result_id);
end;
$$;

create or replace function public.submit_steward_appeal(
  p_case_id uuid, p_reason text, p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); target_case public.steward_cases%rowtype; appeal_id uuid;
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;
  select * into target_case from public.steward_cases where id = p_case_id for update;
  if not found or target_case.status <> 'closed' or not public.matches_requested_league(target_case.league_id) then
    raise exception using errcode = '23514', message = 'Only a closed case in the requested league can be appealed.';
  end if;
  if not exists (
    select 1 from public.driver_identities di join public.driver_identity_links dil on dil.driver_identity_id = di.id
    where di.user_id = actor_id and dil.driver_id in (target_case.reported_driver_id, target_case.accused_driver_id)
  ) and not private.has_league_capability(target_case.league_id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Only an involved driver or league administrator may appeal.';
  end if;
  select id into appeal_id from public.steward_appeals where submitted_by = actor_id and idempotency_key = p_idempotency_key;
  if appeal_id is null then
    insert into public.steward_appeals (case_id, submitted_by, reason, idempotency_key)
    values (p_case_id, actor_id, btrim(p_reason), p_idempotency_key) returning id into appeal_id;
    update public.steward_cases set status = 'appealed' where id = p_case_id;
    insert into public.steward_case_events (case_id, event_type, actor_user_id, payload)
    values (p_case_id, 'appeal_submitted', actor_id, jsonb_build_object('appeal_id', appeal_id));
  end if;
  return jsonb_build_object('id', appeal_id, 'status', 'submitted');
end;
$$;

revoke all on function public.create_steward_case(uuid, uuid, uuid, text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.add_steward_evidence(uuid, text, text, text, boolean, text) from public, anon, authenticated, service_role;
revoke all on function public.cast_steward_vote(uuid, text, text, boolean, text) from public, anon, authenticated, service_role;
revoke all on function public.finalize_steward_decision(uuid, text, text, text, text, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function public.submit_steward_appeal(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.create_steward_case(uuid, uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.add_steward_evidence(uuid, text, text, text, boolean, text) to authenticated;
grant execute on function public.cast_steward_vote(uuid, text, text, boolean, text) to authenticated;
grant execute on function public.finalize_steward_decision(uuid, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.submit_steward_appeal(uuid, text, text) to authenticated;

comment on table public.steward_cases is 'Tenant-bound steward cases. Closed cases are public only for the requested published league.';
comment on table public.steward_decision_versions is 'Immutable steward decisions with locked rule snapshots and official result revision references.';
comment on function public.finalize_steward_decision(uuid, text, text, text, text, jsonb, text) is 'Actor-bound atomic decision, penalty, and current-result revision command. AI must never call this autonomously.';
