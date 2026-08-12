begin;

create or replace function public.apply_race_result_slot_attribution()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sub public.race_substitutions%rowtype;
  v_assignment_id uuid;
  v_points_owner_id uuid;
  v_team_name text;
  v_round integer;
  v_driver_team text;
begin
  if new.race_id is null or new.driver_id is null then return new; end if;

  select * into v_sub
  from public.race_substitutions rs
  where rs.race_id = new.race_id and rs.substitute_driver_id = new.driver_id
  limit 1;

  if v_sub.id is not null then
    new.points_owner_driver_id := v_sub.points_owner_driver_id;
    new.points_team_name := v_sub.points_team_name;
    new.source_assignment_id := v_sub.assignment_id;
    return new;
  end if;

  select r.round_number into v_round from public.races r where r.id = new.race_id;

  select dsa.id, dsa.points_owner_driver_id, sts.slot_label
  into v_assignment_id, v_points_owner_id, v_team_name
  from public.driver_slot_assignments dsa
  join public.season_driver_slots sds on sds.id = dsa.driver_slot_id
  join public.season_team_slots sts on sts.id = sds.team_slot_id
  join public.races r on r.season_id = dsa.season_id and r.id = new.race_id
  where dsa.participant_driver_id = new.driver_id
    and coalesce(dsa.effective_round_number, 1) <= v_round
    and (dsa.valid_until_round_number is null or dsa.valid_until_round_number >= v_round)
  order by
    case when dsa.effective_from_race_id = new.race_id then 0 else 1 end,
    coalesce(dsa.effective_round_number, 1) desc,
    dsa.created_at desc
  limit 1;

  if v_assignment_id is not null then
    new.points_owner_driver_id := coalesce(v_points_owner_id, new.driver_id);
    new.points_team_name := v_team_name;
    new.source_assignment_id := v_assignment_id;
  else
    select d.league_team into v_driver_team from public.drivers d where d.id = new.driver_id;
    new.points_owner_driver_id := new.driver_id;
    new.points_team_name := nullif(btrim(coalesce(v_driver_team, '')), '');
    new.source_assignment_id := null;
  end if;

  return new;
end;
$$;

create or replace function public.set_race_substitution(
  p_race_id uuid,
  p_primary_driver_id uuid,
  p_substitute_driver_id uuid,
  p_points_owner_mode text default 'primary'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_season_id uuid;
  v_league_id uuid;
  v_round integer;
  v_role text;
  v_driver_slot_id uuid;
  v_team_name text;
  v_points_owner_id uuid;
  v_assignment_id uuid;
  v_substitution_id uuid;
  v_existing_assignment_id uuid;
  v_existing_substitute_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_primary_driver_id = p_substitute_driver_id then raise exception 'Primary and substitute driver must differ'; end if;
  if lower(coalesce(p_points_owner_mode, 'primary')) not in ('primary','substitute') then
    raise exception 'Points owner mode must be primary or substitute';
  end if;

  select r.season_id, s.league_id, r.round_number
  into v_season_id, v_league_id, v_round
  from public.races r
  join public.seasons s on s.id = r.season_id
  where r.id = p_race_id;
  if v_season_id is null then raise exception 'Race not found'; end if;

  select lm.role into v_role
  from public.league_members lm
  where lm.league_id = v_league_id and lm.user_id = v_user_id;
  if v_role is null or v_role not in ('owner','admin') then raise exception 'Owner or admin role required'; end if;

  select dsa.driver_slot_id, sts.slot_label
  into v_driver_slot_id, v_team_name
  from public.driver_slot_assignments dsa
  join public.season_driver_slots sds on sds.id = dsa.driver_slot_id
  join public.season_team_slots sts on sts.id = sds.team_slot_id
  where dsa.season_id = v_season_id
    and dsa.participant_driver_id = p_primary_driver_id
    and dsa.points_owner_driver_id = p_primary_driver_id
    and coalesce(dsa.effective_round_number, 1) <= v_round
    and (dsa.valid_until_round_number is null or dsa.valid_until_round_number >= v_round)
  order by coalesce(dsa.effective_round_number, 1) desc, dsa.created_at desc
  limit 1;
  if v_driver_slot_id is null then raise exception 'Primary driver has no active season slot for this race'; end if;

  if not exists (
    select 1
    from public.driver_season_assignments dsa
    where dsa.season_id = v_season_id
      and dsa.driver_id = p_substitute_driver_id
      and dsa.is_primary = false
      and coalesce(dsa.effective_round_number, 1) <= v_round
  ) then
    raise exception 'Selected substitute is not a reserve driver for this season';
  end if;

  select rs.assignment_id, rs.substitute_driver_id
  into v_existing_assignment_id, v_existing_substitute_id
  from public.race_substitutions rs
  where rs.race_id = p_race_id and rs.driver_slot_id = v_driver_slot_id;
  if v_existing_assignment_id is not null then
    delete from public.race_substitutions
    where race_id = p_race_id and driver_slot_id = v_driver_slot_id;
    delete from public.driver_slot_assignments where id = v_existing_assignment_id;
    update public.race_results
    set driver_id = driver_id
    where race_id = p_race_id and driver_id = v_existing_substitute_id;
  end if;

  v_points_owner_id := case when lower(coalesce(p_points_owner_mode, 'primary')) = 'substitute'
    then p_substitute_driver_id else p_primary_driver_id end;

  insert into public.driver_slot_assignments (
    driver_slot_id, season_id, participant_driver_id, points_owner_driver_id,
    participation_mode, effective_from_race_id, effective_round_number,
    valid_until_race_id, valid_until_round_number
  ) values (
    v_driver_slot_id, v_season_id, p_substitute_driver_id, v_points_owner_id,
    'player', p_race_id, v_round, p_race_id, v_round
  ) returning id into v_assignment_id;

  insert into public.race_substitutions (
    race_id, driver_slot_id, assignment_id, primary_driver_id,
    substitute_driver_id, points_owner_driver_id, points_team_name, created_by
  ) values (
    p_race_id, v_driver_slot_id, v_assignment_id, p_primary_driver_id,
    p_substitute_driver_id, v_points_owner_id, v_team_name, v_user_id
  ) returning id into v_substitution_id;

  update public.race_results
  set driver_id = driver_id
  where race_id = p_race_id and driver_id = p_substitute_driver_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_substitution_id,
    'assignment_id', v_assignment_id,
    'race_id', p_race_id,
    'primary_driver_id', p_primary_driver_id,
    'substitute_driver_id', p_substitute_driver_id,
    'points_owner_driver_id', v_points_owner_id,
    'points_team_name', v_team_name
  );
end;
$$;

revoke execute on function public.set_race_substitution(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.set_race_substitution(uuid, uuid, uuid, text) to authenticated;

create or replace function public.remove_race_substitution(p_substitution_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_assignment_id uuid;
  v_league_id uuid;
  v_role text;
  v_race_id uuid;
  v_substitute_driver_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select rs.assignment_id, s.league_id, rs.race_id, rs.substitute_driver_id
  into v_assignment_id, v_league_id, v_race_id, v_substitute_driver_id
  from public.race_substitutions rs
  join public.races r on r.id = rs.race_id
  join public.seasons s on s.id = r.season_id
  where rs.id = p_substitution_id;
  if v_assignment_id is null then return false; end if;

  select lm.role into v_role from public.league_members lm
  where lm.league_id = v_league_id and lm.user_id = v_user_id;
  if v_role is null or v_role not in ('owner','admin') then raise exception 'Owner or admin role required'; end if;

  delete from public.race_substitutions where id = p_substitution_id;
  delete from public.driver_slot_assignments where id = v_assignment_id;

  update public.race_results
  set driver_id = driver_id
  where race_id = v_race_id and driver_id = v_substitute_driver_id;

  return true;
end;
$$;

revoke execute on function public.remove_race_substitution(uuid) from public, anon;
grant execute on function public.remove_race_substitution(uuid) to authenticated;

commit;
