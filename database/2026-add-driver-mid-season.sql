create or replace function public.add_driver_to_active_season(
  p_league_id uuid,
  p_display_name text,
  p_gamertag text default null,
  p_number integer default null,
  p_role text default 'reserve',
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
  v_member_role text;
  v_season_id uuid;
  v_driver_id uuid;
  v_status jsonb;
  v_name text := btrim(coalesce(p_display_name,''));
  v_gamertag text := nullif(btrim(coalesce(p_gamertag,'')),'');
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 100 then raise exception 'Driver name must be between 2 and 100 characters'; end if;
  if lower(coalesce(p_role,'')) not in ('primary','reserve') then raise exception 'Role must be primary or reserve'; end if;

  select lm.role into v_member_role
  from public.league_members lm
  where lm.league_id=p_league_id and lm.user_id=v_user_id;
  if v_member_role is null or v_member_role not in ('owner','admin') then raise exception 'Owner or admin role required'; end if;

  select s.id into v_season_id
  from public.seasons s
  where s.league_id=p_league_id and s.is_active=true
  limit 1;
  if v_season_id is null then raise exception 'No active season found'; end if;

  if exists (
    select 1 from public.drivers d
    where d.league_id=p_league_id and lower(d.display_name)=lower(v_name)
  ) then
    raise exception 'A driver with this name already exists in the league';
  end if;

  insert into public.drivers (league_id,display_name,gamertag,number,is_active)
  values (p_league_id,v_name,v_gamertag,p_number,true)
  returning id into v_driver_id;

  v_status := public.set_season_driver_status(
    v_season_id,
    v_driver_id,
    lower(p_role),
    p_team_id,
    p_effective_from_race_id
  );

  return jsonb_build_object(
    'ok',true,
    'driver_id',v_driver_id,
    'season_id',v_season_id,
    'role',v_status->>'role',
    'team_id',v_status->>'team_id',
    'effective_round_number',(v_status->>'effective_round_number')::integer,
    'slot_assignment_id',v_status->>'slot_assignment_id'
  );
end;
$$;

revoke execute on function public.add_driver_to_active_season(uuid,text,text,integer,text,uuid,uuid) from public,anon;
grant execute on function public.add_driver_to_active_season(uuid,text,text,integer,text,uuid,uuid) to authenticated;
