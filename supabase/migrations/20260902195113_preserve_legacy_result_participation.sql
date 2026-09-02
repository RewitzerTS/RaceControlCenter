-- Restore recorded participation without changing published race facts.
-- Legacy AI references are seat/driver names, not proof that a bot raced.
-- Only the canonical game_key:seat_code identity denotes a dedicated AI driver.
-- Preserve the recorded per-race status for human and legacy driver identities.
create or replace function private.result_participation_status(
  p_ai_driver_reference text,
  p_recorded_status text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_ai_driver_reference ~ '^[a-z0-9_]+:[a-z0-9_-]+$' then 'BOT'
    when upper(btrim(p_recorded_status)) = 'BOT' then 'BOT'
    else 'PLAYER'
  end;
$$;

revoke all on function private.result_participation_status(text, text)
  from public, anon, authenticated, service_role;

create or replace function private.resolve_season_driver_attribution(
  p_season_id uuid,
  p_round_number integer,
  p_participant_driver_id uuid
)
returns table (
  points_owner_driver_id uuid,
  participation_status text,
  assignment_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(a.human_driver_id, d.id) as points_owner_driver_id,
    private.result_participation_status(d.ai_driver_reference, null) as participation_status,
    a.id as assignment_id
  from public.drivers d
  left join lateral (
    select assignment.id, assignment.human_driver_id
    from private.season_driver_ai_assignments assignment
    where assignment.season_id = p_season_id
      and p_round_number >= assignment.effective_from_round
      and (assignment.effective_to_round is null or p_round_number <= assignment.effective_to_round)
      and (
        assignment.human_driver_id = p_participant_driver_id
        or assignment.ai_driver_id = p_participant_driver_id
      )
    order by assignment.effective_from_round desc
    limit 1
  ) a on true
  where d.id = p_participant_driver_id;
$$;

revoke all on function private.resolve_season_driver_attribution(uuid, integer, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.apply_result_version_row_driver_attribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_season_id uuid;
  target_round integer;
  attribution record;
  participant_ai_reference text;
begin
  select r.season_id, r.round_number
    into target_season_id, target_round
  from public.result_versions rv
  join public.races r on r.id = rv.race_id
  where rv.id = new.result_version_id;

  select * into attribution
  from private.resolve_season_driver_attribution(target_season_id, target_round, new.driver_id);

  select d.ai_driver_reference into participant_ai_reference
  from public.drivers d
  where d.id = new.driver_id;

  new.points_owner_driver_id := coalesce(
    new.points_owner_driver_id,
    attribution.points_owner_driver_id,
    new.driver_id
  );
  new.source_assignment_id := coalesce(new.source_assignment_id, attribution.assignment_id);
  new.ai_driver_reference_snapshot := coalesce(new.ai_driver_reference_snapshot, participant_ai_reference);
  new.participation_status := private.result_participation_status(
    participant_ai_reference, new.participation_status
  );
  return new;
end;
$$;

revoke all on function private.apply_result_version_row_driver_attribution()
  from public, anon, authenticated, service_role;

create or replace function private.apply_race_result_driver_attribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_season_id uuid;
  target_round integer;
  attribution record;
  participant_ai_reference text;
begin
  select r.season_id, r.round_number
    into target_season_id, target_round
  from public.races r
  where r.id = new.race_id;

  select * into attribution
  from private.resolve_season_driver_attribution(target_season_id, target_round, new.driver_id);

  select d.ai_driver_reference into participant_ai_reference
  from public.drivers d
  where d.id = new.driver_id;

  new.points_owner_driver_id := coalesce(
    new.points_owner_driver_id,
    attribution.points_owner_driver_id,
    new.driver_id
  );
  new.source_assignment_id := coalesce(new.source_assignment_id, attribution.assignment_id);
  new.ai_driver_reference_snapshot := coalesce(new.ai_driver_reference_snapshot, participant_ai_reference);
  new.participation_status := private.result_participation_status(
    participant_ai_reference, new.participation_status
  );
  return new;
end;
$$;

revoke all on function private.apply_race_result_driver_attribution()
  from public, anon, authenticated, service_role;

-- Restore only the mutable projection from the exact published source row.
-- Dedicated AI identities remain BOT, even if an old import recorded PLAYER.
-- Do not rewrite result versions, points, standings ownership or race facts.
update public.race_results rr
set participation_status = private.result_participation_status(
  d.ai_driver_reference, rvr.participation_status
)
from public.result_version_rows rvr, public.drivers d
where rvr.result_version_id = rr.result_version_id
  and rvr.driver_id = rr.driver_id
  and d.id = rr.driver_id
  and rr.participation_status is distinct from private.result_participation_status(
    d.ai_driver_reference, rvr.participation_status
  );
