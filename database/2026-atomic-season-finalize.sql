create or replace function public.finalize_league_season(
  p_season_id uuid,
  p_driver_champion text default null,
  p_constructor_champion text default null,
  p_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_league_id uuid;
  v_role text;
  v_season_name text;
  v_open_races integer;
  v_history_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select s.league_id, s.name into v_league_id, v_season_name
  from public.seasons s
  where s.id = p_season_id and s.is_active = true;
  if v_league_id is null then raise exception 'Active season not found'; end if;

  select lm.role into v_role
  from public.league_members lm
  where lm.league_id = v_league_id and lm.user_id = v_user;
  if v_role not in ('owner','admin') then raise exception 'Owner or admin role required'; end if;

  select count(*) into v_open_races
  from public.races r
  where r.season_id = p_season_id
    and r.status not in ('completed','official');
  if v_open_races > 0 then
    raise exception 'Season still has % race(s) that are not completed or official', v_open_races;
  end if;

  insert into public.championship_history (
    season_id, season_name, driver_champion, constructor_champion,
    finalized_at, snapshot, updated_at
  ) values (
    p_season_id, v_season_name, nullif(trim(p_driver_champion),''), nullif(trim(p_constructor_champion),''),
    now(), coalesce(p_snapshot,'{}'::jsonb), now()
  )
  on conflict (season_id) do update set
    season_name = excluded.season_name,
    driver_champion = excluded.driver_champion,
    constructor_champion = excluded.constructor_champion,
    finalized_at = excluded.finalized_at,
    snapshot = excluded.snapshot,
    updated_at = now()
  returning id into v_history_id;

  update public.seasons
  set is_active = false, end_date = coalesce(end_date, current_date), updated_at = now()
  where id = p_season_id;

  return jsonb_build_object(
    'ok', true,
    'season_id', p_season_id,
    'league_id', v_league_id,
    'season_name', v_season_name,
    'history_id', v_history_id,
    'driver_champion', nullif(trim(p_driver_champion),''),
    'constructor_champion', nullif(trim(p_constructor_champion),'')
  );
end;
$$;

revoke execute on function public.finalize_league_season(uuid,text,text,jsonb) from public, anon;
grant execute on function public.finalize_league_season(uuid,text,text,jsonb) to authenticated;
