-- Keep the current driver grid aligned with the explicitly started season.

create or replace function private.deactivate_league_drivers_for_new_season()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active then
    update public.drivers
    set is_active = false
    where league_id = new.league_id;
  end if;
  return new;
end;
$$;

revoke all on function private.deactivate_league_drivers_for_new_season()
  from public, anon, authenticated, service_role;

create trigger seasons_deactivate_previous_driver_grid
after insert on public.seasons
for each row execute function private.deactivate_league_drivers_for_new_season();

create or replace function private.sync_active_season_driver_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_season public.seasons%rowtype;
begin
  select s.* into target_season
  from public.seasons s
  where s.id = new.season_id;

  if target_season.is_active then
    update public.drivers
    set is_active = true
    where id = new.driver_id;

    if new.participant_type = 'PLAYER' then
      update public.drivers
      set is_active = false
      where league_id = target_season.league_id
        and ai_driver_reference = target_season.game_key || ':' || new.seat_code
        and id <> new.driver_id;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_active_season_driver_assignment()
  from public, anon, authenticated, service_role;

create trigger season_assignments_sync_active_driver
after insert on public.season_driver_assignments
for each row execute function private.sync_active_season_driver_assignment();

comment on function private.sync_active_season_driver_assignment() is
  'Ensures the current grid contains exactly the assigned player or the preset AI driver for each active-season seat.';
