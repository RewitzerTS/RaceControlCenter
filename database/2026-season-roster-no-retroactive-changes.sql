-- Prevent in-season roster changes from rewriting completed rounds.
-- Updates to a driver status/team may only start after the last completed/official race.

create or replace function public.set_season_driver_status(
  p_season_id uuid,
  p_driver_id uuid,
  p_role text,
  p_team_id uuid default null,
  p_effective_from_race_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_league_id uuid;
  v_member_role text;
  v_driver_league_id uuid;
  v_team_league_id uuid;
  v_team_name text;
  v_round integer;
  v_driver_slot_id uuid;
  v_slot_assignment_id uuid;
  v_last_completed_round integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if lower(coalesce(p_role,'')) not in ('primary','reserve','inactive') then raise exception 'Role must be primary, reserve or inactive'; end if;
  select s.league_id into v_league_id from public.seasons s where s.id=p_season_id;
  if v_league_id is null then raise exception 'Season not found'; end if;
  select lm.role into v_member_role from public.league_members lm where lm.league_id=v_league_id and lm.user_id=v_user_id;
  if v_member_role is null or v_member_role not in ('owner','admin') then raise exception 'Owner or admin role required'; end if;
  select d.league_id into v_driver_league_id from public.drivers d where d.id=p_driver_id;
  if v_driver_league_id is null or v_driver_league_id<>v_league_id then raise exception 'Driver does not belong to this league'; end if;

  select coalesce(max(r.round_number),0) into v_last_completed_round
  from public.races r where r.season_id=p_season_id and r.status in ('completed','official');

  if p_effective_from_race_id is not null then
    select r.round_number into v_round from public.races r where r.id=p_effective_from_race_id and r.season_id=p_season_id;
    if v_round is null then raise exception 'Effective race does not belong to this season'; end if;
    if v_round <= v_last_completed_round then raise exception 'Roster changes cannot start in an already completed race'; end if;
  else
    v_round := greatest(v_last_completed_round+1,1);
  end if;

  if lower(p_role)='primary' then
    if p_team_id is null then raise exception 'Primary driver requires a team'; end if;
    select t.league_id,t.display_name into v_team_league_id,v_team_name from public.teams t where t.id=p_team_id;
    if v_team_league_id is null or v_team_league_id<>v_league_id then raise exception 'Team does not belong to this league'; end if;
    select sds.id into v_driver_slot_id
    from public.season_driver_slots sds
    join public.season_team_slots sts on sts.id=sds.team_slot_id
    where sds.season_id=p_season_id and lower(sts.slot_label)=lower(v_team_name)
      and not exists (
        select 1 from public.driver_slot_assignments dsa
        where dsa.driver_slot_id=sds.id
          and coalesce(dsa.effective_round_number,1)<=v_round
          and (dsa.valid_until_round_number is null or dsa.valid_until_round_number>=v_round)
          and dsa.participant_driver_id<>p_driver_id
      )
    order by sds.seat_number limit 1;
    if v_driver_slot_id is null then raise exception 'Team has no free primary seat from this race'; end if;
  elsif p_team_id is not null then
    select t.league_id,t.display_name into v_team_league_id,v_team_name from public.teams t where t.id=p_team_id;
    if v_team_league_id is null or v_team_league_id<>v_league_id then raise exception 'Team does not belong to this league'; end if;
  end if;

  update public.driver_slot_assignments
  set valid_until_round_number=v_round-1,valid_until_race_id=null
  where season_id=p_season_id and participant_driver_id=p_driver_id
    and coalesce(effective_round_number,1)<=v_round
    and (valid_until_round_number is null or valid_until_round_number>=v_round)
    and effective_from_race_id is distinct from p_effective_from_race_id;

  insert into public.driver_season_assignments
    (season_id,driver_id,team_id,league_team,is_primary,effective_from_race_id,effective_round_number)
  values
    (p_season_id,p_driver_id,case when lower(p_role)='inactive' then null else p_team_id end,
     case when lower(p_role)='inactive' then null else v_team_name end,lower(p_role)='primary',p_effective_from_race_id,v_round);

  if lower(p_role)='primary' then
    insert into public.driver_slot_assignments
      (driver_slot_id,season_id,participant_driver_id,points_owner_driver_id,participation_mode,effective_from_race_id,effective_round_number)
    values
      (v_driver_slot_id,p_season_id,p_driver_id,p_driver_id,'player',p_effective_from_race_id,v_round)
    returning id into v_slot_assignment_id;
  end if;

  return jsonb_build_object('ok',true,'season_id',p_season_id,'driver_id',p_driver_id,'role',lower(p_role),'team_id',case when lower(p_role)='inactive' then null else p_team_id end,'effective_round_number',v_round,'slot_assignment_id',v_slot_assignment_id);
end;
$$;
