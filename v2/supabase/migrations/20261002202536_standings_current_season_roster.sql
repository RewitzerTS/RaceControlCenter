-- Read current championship labels from the same season/round resolver as team
-- management. Do not rewrite the initial grid, result snapshots, points or XP.
create function league_roster_private.championship_roster(p_season_id uuid)
returns table(driver_id uuid, team_name text, car_name text)
language plpgsql stable security definer set search_path='' as $$
declare lid uuid; view_round integer;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='LEAGUE_ACCESS_REQUIRED';
  end if;
  select s.league_id into lid from public.seasons s where s.id=p_season_id;
  -- Match the existing authenticated season/roster read policy, including the
  -- requested league header. Being signed in alone never grants league access.
  if lid is null or not public.matches_requested_league(lid) then
    raise exception using errcode='42501',message='LEAGUE_ACCESS_REQUIRED';
  end if;
  select coalesce(min(r.round_number) filter(where r.status='upcoming'),max(r.round_number),1)
    into view_round from public.races r where r.season_id=p_season_id;
  return query select m.id,nullif(btrim(m.team_name),''),m.car_name
    from league_roster_private.season_members(p_season_id,view_round) m
    where nullif(btrim(m.car_name),'') is not null order by m.id;
end; $$;

create function public.get_season_championship_roster(p_season_id uuid)
returns table(driver_id uuid, team_name text, car_name text)
language sql stable security invoker set search_path='' as $$
  select * from league_roster_private.championship_roster(p_season_id);
$$;
revoke all on function league_roster_private.championship_roster(uuid),
  public.get_season_championship_roster(uuid) from public,anon,authenticated,service_role;
grant execute on function league_roster_private.championship_roster(uuid),
  public.get_season_championship_roster(uuid) to authenticated;

comment on function public.get_season_championship_roster(uuid) is
  'League-scoped current season participant/team/car labels at the next upcoming round (or last round). Historical scoring remains in published result snapshots.';
