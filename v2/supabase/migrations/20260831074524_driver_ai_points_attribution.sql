-- Keep the actual race participant separate from the human championship points owner.
-- AI seat assignments are effective-dated so mid-season changes never rewrite history.

create table private.season_driver_ai_assignments (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  human_driver_id uuid not null references public.drivers(id) on delete restrict,
  ai_driver_id uuid not null references public.drivers(id) on delete restrict,
  seat_code text not null,
  effective_from_round integer not null,
  effective_to_round integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint season_driver_ai_assignments_distinct_drivers_check
    check (human_driver_id <> ai_driver_id),
  constraint season_driver_ai_assignments_round_check
    check (
      effective_from_round > 0
      and (effective_to_round is null or effective_to_round >= effective_from_round)
    ),
  constraint season_driver_ai_assignments_human_start_unique
    unique (season_id, human_driver_id, effective_from_round),
  constraint season_driver_ai_assignments_ai_start_unique
    unique (season_id, ai_driver_id, effective_from_round)
);

create index idx_season_driver_ai_assignments_human_period
  on private.season_driver_ai_assignments (season_id, human_driver_id, effective_from_round, effective_to_round);
create index idx_season_driver_ai_assignments_ai_period
  on private.season_driver_ai_assignments (season_id, ai_driver_id, effective_from_round, effective_to_round);
create unique index idx_season_driver_ai_assignments_open_human
  on private.season_driver_ai_assignments (season_id, human_driver_id)
  where effective_to_round is null;
create unique index idx_season_driver_ai_assignments_open_ai
  on private.season_driver_ai_assignments (season_id, ai_driver_id)
  where effective_to_round is null;

alter table private.season_driver_ai_assignments enable row level security;
revoke all on table private.season_driver_ai_assignments from public, anon, authenticated, service_role;

create or replace function private.sync_initial_season_driver_ai_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_season public.seasons%rowtype;
  target_ai_driver_id uuid;
begin
  if new.participant_type <> 'PLAYER' then
    return new;
  end if;

  select s.* into target_season
  from public.seasons s
  where s.id = new.season_id;

  select d.id into target_ai_driver_id
  from public.drivers d
  where d.league_id = target_season.league_id
    and d.ai_driver_reference = target_season.game_key || ':' || new.seat_code
  limit 1;

  if target_ai_driver_id is null or target_ai_driver_id = new.driver_id then
    return new;
  end if;

  insert into private.season_driver_ai_assignments (
    season_id, human_driver_id, ai_driver_id, seat_code,
    effective_from_round, effective_to_round, created_by
  ) values (
    new.season_id, new.driver_id, target_ai_driver_id, new.seat_code,
    1, null, (select auth.uid())
  )
  on conflict (season_id, human_driver_id, effective_from_round)
  do update set
    ai_driver_id = excluded.ai_driver_id,
    seat_code = excluded.seat_code,
    effective_to_round = null;

  return new;
end;
$$;

revoke all on function private.sync_initial_season_driver_ai_assignment()
  from public, anon, authenticated, service_role;

create trigger season_driver_assignments_sync_ai_points_owner
after insert or update of driver_id, seat_code, participant_type
on public.season_driver_assignments
for each row execute function private.sync_initial_season_driver_ai_assignment();

-- Existing player seats become valid from round one. This includes the current
-- RummelRacer Richi/Kimi Antonelli assignment without changing official rows.
insert into private.season_driver_ai_assignments (
  season_id, human_driver_id, ai_driver_id, seat_code,
  effective_from_round, effective_to_round, created_by
)
select
  sda.season_id,
  sda.driver_id,
  ai.id,
  sda.seat_code,
  1,
  null,
  null
from public.season_driver_assignments sda
join public.seasons s on s.id = sda.season_id
join public.drivers ai
  on ai.league_id = s.league_id
 and ai.ai_driver_reference = s.game_key || ':' || sda.seat_code
where sda.participant_type = 'PLAYER'
  and ai.id <> sda.driver_id
on conflict (season_id, human_driver_id, effective_from_round) do nothing;

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
    case when d.ai_driver_reference is null then 'PLAYER' else 'BOT' end as participation_status,
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
  new.participation_status := case
    when participant_ai_reference is not null then 'BOT'
    else 'PLAYER'
  end;
  return new;
end;
$$;

revoke all on function private.apply_result_version_row_driver_attribution()
  from public, anon, authenticated, service_role;

create trigger result_version_rows_10_apply_driver_attribution
before insert or update of result_version_id, driver_id, points_owner_driver_id
on public.result_version_rows
for each row execute function private.apply_result_version_row_driver_attribution();

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
  new.participation_status := case
    when participant_ai_reference is not null then 'BOT'
    else 'PLAYER'
  end;
  return new;
end;
$$;

revoke all on function private.apply_race_result_driver_attribution()
  from public, anon, authenticated, service_role;

create trigger race_results_10_apply_driver_attribution
before insert or update of race_id, driver_id, points_owner_driver_id
on public.race_results
for each row execute function private.apply_race_result_driver_attribution();

-- Repair the mutable official projection. The immutable result version remains
-- untouched; all source facts and awarded point values stay exactly as published.
with resolved_results as (
  select
    rr.id,
    attribution.points_owner_driver_id,
    attribution.assignment_id,
    attribution.participation_status,
    d.ai_driver_reference
  from public.race_results rr
  join public.races r on r.id = rr.race_id
  join public.drivers d on d.id = rr.driver_id
  cross join lateral private.resolve_season_driver_attribution(
    r.season_id,
    r.round_number,
    rr.driver_id
  ) attribution
)
update public.race_results rr
set points_owner_driver_id = resolved.points_owner_driver_id,
    source_assignment_id = coalesce(rr.source_assignment_id, resolved.assignment_id),
    ai_driver_reference_snapshot = coalesce(rr.ai_driver_reference_snapshot, resolved.ai_driver_reference),
    participation_status = resolved.participation_status
from resolved_results resolved
where resolved.id = rr.id
  and (
    rr.points_owner_driver_id is null
    or rr.participation_status is distinct from resolved.participation_status
    or rr.source_assignment_id is null
  );

create or replace function public.assign_season_driver_ai(
  p_human_driver_id uuid,
  p_ai_driver_id uuid,
  p_effective_from_round integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
  target_season public.seasons%rowtype;
  human_driver public.drivers%rowtype;
  ai_driver public.drivers%rowtype;
  previous_assignment private.season_driver_ai_assignments%rowtype;
  saved_assignment private.season_driver_ai_assignments%rowtype;
  current_round integer;
  maximum_round integer;
  target_seat_code text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select l.* into target_league
  from public.leagues l
  where l.slug = public.requested_league_slug();

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League driver administration access denied.';
  end if;

  select s.* into target_season
  from public.seasons s
  where s.league_id = target_league.id and s.is_active
  order by s.created_at desc
  limit 1
  for update;

  if target_season.id is null then
    raise exception using errcode = '22023', message = 'An active season is required.';
  end if;

  select d.* into human_driver
  from public.drivers d
  where d.id = p_human_driver_id and d.league_id = target_league.id;
  if human_driver.id is null or human_driver.ai_driver_reference is not null then
    raise exception using errcode = '22023', message = 'The points owner must be a human driver in this league.';
  end if;

  select d.* into ai_driver
  from public.drivers d
  where d.id = p_ai_driver_id and d.league_id = target_league.id;
  if ai_driver.id is null
     or ai_driver.ai_driver_reference is null
     or ai_driver.ai_driver_reference not like target_season.game_key || ':%' then
    raise exception using errcode = '22023', message = 'The selected AI driver does not belong to the active season game.';
  end if;

  target_seat_code := split_part(ai_driver.ai_driver_reference, ':', 2);

  select max(r.round_number) into maximum_round
  from public.races r
  where r.season_id = target_season.id;
  if p_effective_from_round is null
     or p_effective_from_round < 1
     or p_effective_from_round > coalesce(maximum_round, 0)
     or not exists (
       select 1 from public.races r
       where r.season_id = target_season.id
         and r.round_number = p_effective_from_round
     ) then
    raise exception using errcode = '22023', message = 'The effective round is not part of the active season.';
  end if;

  if exists (
    select 1
    from private.season_driver_ai_assignments a
    where a.season_id = target_season.id
      and a.ai_driver_id = p_ai_driver_id
      and a.human_driver_id <> p_human_driver_id
      and (a.effective_to_round is null or a.effective_to_round >= p_effective_from_round)
  ) then
    raise exception using errcode = '23505', message = 'This AI driver is already assigned to another human driver for the selected period.';
  end if;

  select a.* into previous_assignment
  from private.season_driver_ai_assignments a
  where a.season_id = target_season.id
    and a.human_driver_id = p_human_driver_id
    and p_effective_from_round >= a.effective_from_round
    and (a.effective_to_round is null or p_effective_from_round <= a.effective_to_round)
  order by a.effective_from_round desc
  limit 1;

  if previous_assignment.id is not null
     and previous_assignment.ai_driver_id = p_ai_driver_id
     and previous_assignment.effective_from_round = p_effective_from_round then
    saved_assignment := previous_assignment;
  else
    delete from private.season_driver_ai_assignments a
    where a.season_id = target_season.id
      and a.human_driver_id = p_human_driver_id
      and a.effective_from_round >= p_effective_from_round;

    update private.season_driver_ai_assignments a
    set effective_to_round = p_effective_from_round - 1
    where a.season_id = target_season.id
      and a.human_driver_id = p_human_driver_id
      and a.effective_from_round < p_effective_from_round
      and (a.effective_to_round is null or a.effective_to_round >= p_effective_from_round);

    insert into private.season_driver_ai_assignments (
      season_id, human_driver_id, ai_driver_id, seat_code,
      effective_from_round, effective_to_round, created_by
    ) values (
      target_season.id, p_human_driver_id, p_ai_driver_id, target_seat_code,
      p_effective_from_round, null, actor_id
    ) returning * into saved_assignment;
  end if;

  select coalesce(
    min(r.round_number) filter (where r.current_result_version_id is null),
    max(r.round_number),
    1
  ) into current_round
  from public.races r
  where r.season_id = target_season.id;

  if p_effective_from_round <= current_round then
    update public.drivers
    set number = ai_driver.number,
        nationality_code = ai_driver.nationality_code,
        league_team = ai_driver.league_team,
        car_name = ai_driver.car_name,
        is_active = true
    where id = human_driver.id;

    update public.drivers set is_active = false where id = ai_driver.id;

    if previous_assignment.ai_driver_id is not null
       and previous_assignment.ai_driver_id <> ai_driver.id
       and not exists (
         select 1
         from private.season_driver_ai_assignments a
         where a.season_id = target_season.id
           and a.ai_driver_id = previous_assignment.ai_driver_id
           and current_round >= a.effective_from_round
           and (a.effective_to_round is null or current_round <= a.effective_to_round)
       ) then
      update public.drivers set is_active = true where id = previous_assignment.ai_driver_id;
    end if;
  end if;

  insert into public.v2_audit_events (
    scope, league_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', target_league.id, actor_id, 'driver.ai_assignment_changed',
    'driver', p_human_driver_id,
    jsonb_build_object(
      'season_id', target_season.id,
      'human_driver_id', p_human_driver_id,
      'ai_driver_id', p_ai_driver_id,
      'previous_ai_driver_id', previous_assignment.ai_driver_id,
      'seat_code', target_seat_code,
      'effective_from_round', p_effective_from_round
    )
  );

  return jsonb_build_object(
    'id', saved_assignment.id,
    'season_id', saved_assignment.season_id,
    'human_driver_id', saved_assignment.human_driver_id,
    'ai_driver_id', saved_assignment.ai_driver_id,
    'seat_code', saved_assignment.seat_code,
    'effective_from_round', saved_assignment.effective_from_round,
    'effective_to_round', saved_assignment.effective_to_round
  );
end;
$$;

revoke all on function public.assign_season_driver_ai(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.assign_season_driver_ai(uuid, uuid, integer)
  to authenticated, service_role;

create or replace function public.get_league_driver_admin_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
  target_season public.seasons%rowtype;
  current_round integer;
  maximum_round integer;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  select l.* into target_league from public.leagues l
  where l.slug = public.requested_league_slug();
  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League driver administration access denied.';
  end if;

  select s.* into target_season
  from public.seasons s
  where s.league_id = target_league.id and s.is_active
  order by s.created_at desc
  limit 1;

  if target_season.id is not null then
    select
      coalesce(
        min(r.round_number) filter (where r.current_result_version_id is null),
        max(r.round_number),
        1
      ),
      coalesce(max(r.round_number), 1)
      into current_round, maximum_round
    from public.races r
    where r.season_id = target_season.id;
  end if;

  return jsonb_build_object(
    'league', jsonb_build_object('id', target_league.id, 'name', target_league.name, 'slug', target_league.slug),
    'counts', jsonb_build_object(
      'total', (select count(*) from public.drivers d where d.league_id = target_league.id),
      'active', (select count(*) from public.drivers d where d.league_id = target_league.id and d.is_active),
      'linked', (select count(*) from public.drivers d join public.driver_identity_links dil on dil.driver_id = d.id where d.league_id = target_league.id)
    ),
    'active_season', case when target_season.id is null then null else jsonb_build_object(
      'id', target_season.id,
      'name', target_season.name,
      'next_round', current_round,
      'max_round', maximum_round
    ) end,
    'drivers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'display_name', d.display_name,
          'gamertag', d.gamertag,
          'number', d.number,
          'nationality_code', d.nationality_code,
          'league_team', d.league_team,
          'car_name', d.car_name,
          'is_active', d.is_active,
          'ai_driver_reference', d.ai_driver_reference,
          'identity_linked', dil.id is not null,
          'result_count', (
            select count(*)
            from public.race_results rr
            where coalesce(rr.points_owner_driver_id, rr.driver_id) = d.id
          )
        ) order by d.is_active desc, lower(d.display_name)
      )
      from public.drivers d
      left join public.driver_identity_links dil on dil.driver_id = d.id
      where d.league_id = target_league.id
    ), '[]'::jsonb),
    'ai_drivers', case when target_season.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ai.id,
        'display_name', ai.display_name,
        'ai_driver_reference', ai.ai_driver_reference,
        'league_team', ai.league_team,
        'car_name', ai.car_name,
        'is_active', ai.is_active,
        'assigned_human_id', assignment.human_driver_id,
        'assigned_human_name', human.display_name
      ) order by lower(ai.display_name))
      from public.drivers ai
      left join private.season_driver_ai_assignments assignment
        on assignment.season_id = target_season.id
       and assignment.ai_driver_id = ai.id
       and current_round >= assignment.effective_from_round
       and (assignment.effective_to_round is null or current_round <= assignment.effective_to_round)
      left join public.drivers human on human.id = assignment.human_driver_id
      where ai.league_id = target_league.id
        and ai.ai_driver_reference like target_season.game_key || ':%'
    ), '[]'::jsonb) end,
    'ai_assignments', case when target_season.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', assignment.id,
        'human_driver_id', assignment.human_driver_id,
        'human_driver_name', human.display_name,
        'ai_driver_id', assignment.ai_driver_id,
        'ai_driver_name', ai.display_name,
        'seat_code', assignment.seat_code,
        'effective_from_round', assignment.effective_from_round,
        'effective_to_round', assignment.effective_to_round,
        'is_current', current_round >= assignment.effective_from_round
          and (assignment.effective_to_round is null or current_round <= assignment.effective_to_round)
      ) order by human.display_name, assignment.effective_from_round desc)
      from private.season_driver_ai_assignments assignment
      join public.drivers human on human.id = assignment.human_driver_id
      join public.drivers ai on ai.id = assignment.ai_driver_id
      where assignment.season_id = target_season.id
    ), '[]'::jsonb) end
  );
end;
$$;

revoke all on function public.get_league_driver_admin_workspace()
  from public, anon, authenticated, service_role;
grant execute on function public.get_league_driver_admin_workspace()
  to authenticated, service_role;

create or replace function public.get_league_race_admin_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  select l.* into target_league from public.leagues l
  where l.slug = public.requested_league_slug();
  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League race administration access denied.';
  end if;

  return jsonb_build_object(
    'league', jsonb_build_object('id', target_league.id, 'name', target_league.name, 'slug', target_league.slug),
    'seasons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'slug', s.slug, 'is_active', s.is_active,
        'game_label', s.game_label, 'start_date', s.start_date, 'end_date', s.end_date
      ) order by s.is_active desc, s.start_date desc nulls last, s.name)
      from public.seasons s where s.league_id = target_league.id
    ), '[]'::jsonb),
    'races', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'season_id', r.season_id, 'season_name', s.name,
        'round_number', r.round_number, 'grand_prix_name', r.grand_prix_name,
        'circuit_name', r.circuit_name, 'country_code', r.country_code,
        'race_date', r.race_date, 'race_start_at', r.race_start_at,
        'status', r.status, 'has_sprint', r.has_sprint,
        'result_count', (select count(*) from public.race_results rr where rr.race_id = r.id),
        'result_version', rv.version_number, 'result_status', rv.status,
        'result_activated_at', rv.activated_at
      ) order by s.is_active desc, r.round_number desc)
      from public.races r
      join public.seasons s on s.id = r.season_id
      left join public.result_versions rv on rv.id = r.current_result_version_id
      where s.league_id = target_league.id
    ), '[]'::jsonb),
    'driver_standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'driver_id', ranked.driver_id, 'display_name', ranked.display_name,
        'gamertag', ranked.gamertag, 'points', ranked.points,
        'wins', ranked.wins, 'podiums', ranked.podiums, 'starts', ranked.starts
      ) order by ranked.points desc, ranked.wins desc, ranked.display_name)
      from (
        select owner.id driver_id, owner.display_name, owner.gamertag,
          coalesce(sum(rr.awarded_points), 0) points,
          count(*) filter (where rr.finish_position = 1) wins,
          count(*) filter (where rr.finish_position between 1 and 3) podiums,
          count(distinct rr.race_id) starts
        from public.race_results rr
        join public.drivers owner on owner.id = coalesce(rr.points_owner_driver_id, rr.driver_id)
        join public.races r on r.id = rr.race_id
        join public.seasons s on s.id = r.season_id
        where owner.league_id = target_league.id
          and s.league_id = target_league.id
          and s.is_active
        group by owner.id, owner.display_name, owner.gamertag
      ) ranked
    ), '[]'::jsonb),
    'team_standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_name', ranked.team_name, 'points', ranked.points,
        'wins', ranked.wins, 'podiums', ranked.podiums
      ) order by ranked.points desc, ranked.wins desc, ranked.team_name)
      from (
        select coalesce(nullif(rr.points_team_name, ''), nullif(d.league_team, ''), 'Ohne Team') team_name,
          coalesce(sum(rr.awarded_points), 0) points,
          count(*) filter (where rr.finish_position = 1) wins,
          count(*) filter (where rr.finish_position between 1 and 3) podiums
        from public.race_results rr
        join public.drivers d on d.id = rr.driver_id
        join public.races r on r.id = rr.race_id
        join public.seasons s on s.id = r.season_id
        where d.league_id = target_league.id and s.league_id = target_league.id and s.is_active
        group by coalesce(nullif(rr.points_team_name, ''), nullif(d.league_team, ''), 'Ohne Team')
      ) ranked
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_league_race_admin_workspace()
  from public, anon, authenticated, service_role;
grant execute on function public.get_league_race_admin_workspace()
  to authenticated, service_role;

create or replace function public.get_social_graphics_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_league public.leagues%rowtype;
  target_result public.result_versions%rowtype;
  target_race public.races%rowtype;
  graphics_enabled boolean;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select l.* into target_league
  from public.leagues l
  where l.slug = public.requested_league_slug();

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Social graphics administration is not allowed.';
  end if;

  select coalesce(pff.enabled, false) into graphics_enabled
  from public.platform_feature_flags pff
  where pff.flag_key = 'graphics_enabled';

  if not coalesce(graphics_enabled, false) then
    raise exception using errcode = '42501', message = 'Social graphics are disabled.';
  end if;

  select rv.* into target_result
  from public.result_versions rv
  join public.races r on r.current_result_version_id = rv.id
  join public.seasons s on s.id = r.season_id
  where s.league_id = target_league.id and rv.status = 'active'
  order by coalesce(rv.activated_at, rv.created_at) desc
  limit 1;

  if target_result.id is not null then
    select r.* into target_race
    from public.races r
    where r.id = target_result.race_id;
  end if;

  return jsonb_build_object(
    'league', jsonb_build_object(
      'id', target_league.id,
      'name', target_league.name,
      'slug', target_league.slug
    ),
    'latest_result', case when target_result.id is null then null else jsonb_build_object(
      'id', target_result.id,
      'version', target_result.version_number,
      'race_id', target_race.id,
      'race_name', target_race.grand_prix_name,
      'circuit', target_race.circuit_name,
      'country_code', target_race.country_code,
      'race_date', target_race.race_date,
      'round', target_race.round_number,
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'position', rvr.finish_position,
          'driver', d.display_name,
          'team', coalesce(rvr.points_team_name, rvr.car_name_snapshot, d.league_team, 'Independent'),
          'points', rvr.awarded_points,
          'status', coalesce(rvr.classification_status, 'classified'),
          'raceTime', rvr.race_time,
          'raceTimeMs', rvr.race_time_ms
        ) order by rvr.row_order)
        from public.result_version_rows rvr
        join public.drivers d on d.id = rvr.driver_id
        where rvr.result_version_id = target_result.id
      ), '[]'::jsonb)
    ) end,
    'driver_standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', ranked.position,
        'driver', ranked.driver,
        'points', ranked.points,
        'wins', ranked.wins
      ) order by ranked.position)
      from (
        select row_number() over (
                 order by sum(rvr.awarded_points) desc, owner.display_name
               )::integer as position,
               owner.display_name as driver,
               sum(rvr.awarded_points) as points,
               count(*) filter (where rvr.finish_position = 1) as wins
        from public.result_version_rows rvr
        join public.result_versions rv on rv.id = rvr.result_version_id and rv.status = 'active'
        join public.races r on r.current_result_version_id = rv.id
        left join lateral private.resolve_season_driver_attribution(
          r.season_id,
          r.round_number,
          rvr.driver_id
        ) attribution on true
        join public.drivers owner on owner.id = coalesce(
          rvr.points_owner_driver_id,
          attribution.points_owner_driver_id,
          rvr.driver_id
        )
        where r.season_id = target_race.season_id
        group by owner.id, owner.display_name
        order by points desc, driver
        limit 24
      ) ranked
    ), '[]'::jsonb),
    'team_standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', ranked.position,
        'team', ranked.team,
        'points', ranked.points,
        'wins', ranked.wins
      ) order by ranked.position)
      from (
        select row_number() over (order by sum(rvr.awarded_points) desc, coalesce(rvr.points_team_name, rvr.car_name_snapshot, d.league_team, 'Independent'))::integer as position,
               coalesce(rvr.points_team_name, rvr.car_name_snapshot, d.league_team, 'Independent') as team,
               sum(rvr.awarded_points) as points,
               count(*) filter (where rvr.finish_position = 1) as wins
        from public.result_version_rows rvr
        join public.result_versions rv on rv.id = rvr.result_version_id and rv.status = 'active'
        join public.races r on r.current_result_version_id = rv.id
        join public.drivers d on d.id = rvr.driver_id
        where r.season_id = target_race.season_id
        group by coalesce(rvr.points_team_name, rvr.car_name_snapshot, d.league_team, 'Independent')
        order by points desc, team
        limit 24
      ) ranked
    ), '[]'::jsonb),
    'latest_achievement', (
      select jsonb_build_object(
        'driver', d.display_name,
        'code', dae.achievement_code,
        'value', dae.observed_value,
        'unlocked_at', dae.occurred_at
      )
      from public.driver_achievement_events dae
      join public.driver_identity_links dil on dil.driver_identity_id = dae.driver_identity_id
      join public.drivers d on d.id = dil.driver_id and d.league_id = target_league.id
      where dae.event_type = 'unlocked'
      order by dae.occurred_at desc
      limit 1
    ),
    'recent_renders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sgr.id,
        'graphic_type', sgr.graphic_type,
        'graphic_format', sgr.graphic_format,
        'result_version_id', sgr.result_version_id,
        'source_digest', sgr.source_digest,
        'status', case
          when sgr.status = 'outdated' then 'outdated'
          when sgr.result_version_id is not null and r.current_result_version_id is distinct from sgr.result_version_id then 'outdated'
          else 'ready'
        end,
        'generated_at', sgr.generated_at
      ) order by sgr.generated_at desc)
      from (
        select * from public.social_graphic_renders
        where league_id = target_league.id
        order by generated_at desc
        limit 20
      ) sgr
      left join public.result_versions rv on rv.id = sgr.result_version_id
      left join public.races r on r.id = rv.race_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_social_graphics_workspace()
  from public, anon, authenticated, service_role;
grant execute on function public.get_social_graphics_workspace()
  to authenticated;

comment on table private.season_driver_ai_assignments is
  'Effective-dated mapping from a human championship points owner to the AI driver representing their seat.';
comment on function public.assign_season_driver_ai(uuid, uuid, integer) is
  'Changes a human driver AI seat from a selected race round without rewriting prior attribution.';
