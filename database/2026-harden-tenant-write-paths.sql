begin;

-- RaceVora security hardening, 2026-08-16.
-- This migration changes policies, function guards and grants only. It does not
-- update, delete or recreate league-owned application data.

-- ---------------------------------------------------------------------------
-- 1. Privileged identity tables are intentionally not directly client-readable.
-- SECURITY DEFINER helpers owned by postgres continue to provide the narrowly
-- scoped checks that the application needs.
-- ---------------------------------------------------------------------------
revoke all privileges on table public.platform_owners from anon, authenticated;
revoke all privileges on table public.app_admins from anon, authenticated;

-- The legacy policy allowed every authenticated user to enumerate app_admins.
-- The existing service-role ALL policy remains available to backend operations.
drop policy if exists "admins read admin list" on public.app_admins;

-- ---------------------------------------------------------------------------
-- 2. League admins may manage non-owner memberships, but must never be able to
-- demote an owner through direct table UPDATE. Platform owners retain control.
-- The RPC set_league_member_role() already enforced this rule; RLS now matches it.
-- ---------------------------------------------------------------------------
drop policy if exists "managers update league memberships" on public.league_members;
create policy "managers update league memberships"
on public.league_members
for update
to authenticated
using (
  public.is_platform_owner()
  or (
    public.can_manage_league(league_id)
    and role <> 'owner'
  )
)
with check (
  public.is_platform_owner()
  or (
    public.can_manage_league(league_id)
    and role <> 'owner'
  )
);

-- ---------------------------------------------------------------------------
-- 3. Public/member Steward views expose finalized decisions only. Staff retain
-- their separate authenticated policy for open and closed cases.
-- matches_requested_league() also preserves private-league membership gating via
-- the leagues table RLS and prevents a requested tenant from returning another.
-- ---------------------------------------------------------------------------
drop policy if exists "request scope steward cases" on public.steward_cases;
drop policy if exists "read published steward cases" on public.steward_cases;
create policy "request scope closed steward cases"
on public.steward_cases
for select
to anon, authenticated
using (
  status = 'closed'
  and exists (
    select 1
    from public.races r
    join public.seasons s on s.id = r.season_id
    where r.id = steward_cases.race_id
      and public.matches_requested_league(s.league_id)
  )
);

-- Staff access must still respect the tenant selected in the request so an admin
-- visiting another league cannot render their own league's private cases there.
drop policy if exists "league staff read steward cases" on public.steward_cases;
create policy "league staff read steward cases"
on public.steward_cases
for select
to authenticated
using (
  exists (
    select 1
    from public.races r
    join public.seasons s on s.id = r.season_id
    where r.id = steward_cases.race_id
      and public.matches_requested_league(s.league_id)
      and public.has_league_role(s.league_id, array['owner','admin','steward'])
  )
);

-- Race substitutions are admin UI data, not a general member/public feed. Drop
-- the broad request-scope policy so the staff-only policy below is effective.
drop policy if exists "request scope race substitutions" on public.race_substitutions;
drop policy if exists "league staff read race substitutions" on public.race_substitutions;
create policy "league staff read race substitutions"
on public.race_substitutions
for select
to authenticated
using (
  exists (
    select 1
    from public.races r
    join public.seasons s on s.id = r.season_id
    where r.id = race_substitutions.race_id
      and public.matches_requested_league(s.league_id)
      and public.has_league_role(s.league_id, array['owner','admin','steward'])
  )
);

-- ---------------------------------------------------------------------------
-- 4. Publishing a result draft must prove the requested race belongs to the
-- selected tenant and every supplied driver belongs to the same league.
-- The function intentionally stays SECURITY INVOKER so table RLS remains a
-- second independent enforcement layer.
-- ---------------------------------------------------------------------------
create or replace function public.publish_race_result_draft(
  p_import_id uuid,
  p_race_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_import_race_id uuid;
  v_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select ri.race_id, s.league_id
    into v_import_race_id, v_league_id
  from public.race_result_imports ri
  join public.races r on r.id = ri.race_id
  join public.seasons s on s.id = r.season_id
  where ri.id = p_import_id;

  if v_import_race_id is null then
    raise exception 'Result draft not found';
  end if;
  if v_import_race_id <> p_race_id then
    raise exception 'Draft does not belong to race';
  end if;
  if not public.can_manage_race_workflow(p_race_id) then
    raise exception 'Insufficient league role or tenant context';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Official result must contain at least one row';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as x(driver_id uuid)
    left join public.drivers d
      on d.id = x.driver_id
     and d.league_id = v_league_id
    where x.driver_id is null or d.id is null
  ) then
    raise exception 'Official result contains a driver outside this league';
  end if;

  delete from public.race_results where race_id = p_race_id;

  insert into public.race_results (
    race_id,
    driver_id,
    team_id,
    car_name_snapshot,
    ai_driver_reference_snapshot,
    grid_position,
    finish_position,
    race_time_ms,
    fastest_lap_time_ms,
    fastest_lap_ms,
    pit_stops,
    participation_status,
    base_points,
    penalty_time_delta_ms,
    awarded_points,
    fastest_lap_time,
    race_time,
    points_car_name,
    points
  )
  select
    p_race_id,
    x.driver_id,
    tm.id,
    d.car_name,
    d.ai_driver_reference,
    x.grid_position,
    x.finish_position,
    x.race_time_ms,
    x.fastest_lap_time_ms,
    x.fastest_lap_ms,
    coalesce(x.pit_stops, 0),
    coalesce(nullif(x.participation_status, ''), 'PLAYER'),
    coalesce(x.base_points, 0),
    coalesce(x.penalty_time_delta_ms, 0),
    coalesce(x.awarded_points, 0),
    x.fastest_lap_time,
    x.race_time,
    d.car_name,
    coalesce(x.points, x.base_points, 0)
  from jsonb_to_recordset(p_rows) as x(
    driver_id uuid,
    grid_position integer,
    finish_position integer,
    race_time_ms bigint,
    fastest_lap_time_ms bigint,
    fastest_lap_ms bigint,
    pit_stops integer,
    participation_status text,
    base_points numeric(7,2),
    penalty_time_delta_ms integer,
    awarded_points numeric(7,2),
    fastest_lap_time text,
    race_time text,
    points numeric
  )
  join public.drivers d
    on d.id = x.driver_id
   and d.league_id = v_league_id
  left join lateral (
    select t.id
    from public.teams t
    where t.league_id = v_league_id
      and (
        lower(btrim(coalesce(t.display_name, ''))) = lower(btrim(coalesce(d.league_team, '')))
        or lower(btrim(coalesce(t.short_name, ''))) = lower(btrim(coalesce(d.league_team, '')))
      )
    order by t.created_at asc
    limit 1
  ) tm on true;

  update public.races
  set status = 'completed'
  where id = p_race_id;

  update public.race_result_imports
  set status = 'published',
      published_by = coalesce(published_by, auth.uid()),
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = p_import_id;
end;
$function$;

revoke all on function public.publish_race_result_draft(uuid, uuid, jsonb) from public;
revoke execute on function public.publish_race_result_draft(uuid, uuid, jsonb) from anon;
grant execute on function public.publish_race_result_draft(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Legacy mutating penalty recalculation is no longer callable anonymously and
-- requires the same owner/admin + requested-tenant guard as the result workflow.
-- ---------------------------------------------------------------------------
create or replace function public.apply_race_penalties(p_race_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.can_manage_race_workflow(p_race_id) then
    raise exception 'Insufficient league role or tenant context';
  end if;

  update public.race_results rr
  set penalty_time_delta_ms = coalesce((
        select sum(case when rp.penalty_type = 'time_penalty' then rp.time_delta_ms
                        when rp.penalty_type = 'time_credit' then -rp.time_delta_ms
                        else 0 end)
        from public.race_penalties rp
        where rp.race_id = rr.race_id
          and rp.driver_id = rr.driver_id
      ), 0),
      awarded_points = greatest(
        0,
        rr.base_points + coalesce((
          select sum(rp.points_delta)
          from public.race_penalties rp
          where rp.race_id = rr.race_id
            and rp.driver_id = rr.driver_id
        ), 0)
      ),
      updated_at = now()
  where rr.race_id = p_race_id;
end;
$function$;

revoke all on function public.apply_race_penalties(uuid) from public;
revoke execute on function public.apply_race_penalties(uuid) from anon;
grant execute on function public.apply_race_penalties(uuid) to authenticated;

commit;
