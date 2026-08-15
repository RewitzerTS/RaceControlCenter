-- Race Control Center - seed the selected game's AI roster when a new season starts.
-- Existing league drivers are preserved for history. Matching AI seats are reused;
-- otherwise a new AI placeholder driver is created. Only the selected roster is active.

create or replace function public.create_next_league_season(
  p_league_id uuid,
  p_game_key text default 'f1_25',
  p_game_label text default 'F1 25'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_next integer;
  v_season public.seasons%rowtype;
  v_slug text;
  v_game_key text := lower(coalesce(nullif(trim(p_game_key), ''), 'f1_25'));
  v_game_label text := coalesce(nullif(trim(p_game_label), ''), 'F1 25');
  v_driver_id uuid;
  v_seeded integer := 0;
  v_roster record;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select lm.role into v_role
  from public.league_members lm
  where lm.league_id = p_league_id
    and lm.user_id = v_user;

  if v_role not in ('owner','admin') then
    raise exception 'Owner or admin role required';
  end if;

  if v_game_key not in ('f1_25', 'f1_26') then
    raise exception 'Unsupported game key';
  end if;

  if exists (
    select 1 from public.seasons s
    where s.league_id = p_league_id and s.is_active = true
  ) then
    raise exception 'League already has an active season';
  end if;

  select coalesce(max((regexp_match(coalesce(s.name,''),'([0-9]+)'))[1]::integer),0)+1
  into v_next
  from public.seasons s
  where s.league_id = p_league_id;

  v_slug := 'season-' || v_next;

  insert into public.seasons (league_id, slug, name, is_active, game_key, game_label)
  values (p_league_id, v_slug, 'Saison ' || v_next, true, v_game_key, v_game_label)
  returning * into v_season;

  -- A new season starts from the selected game's grid. Historical driver rows
  -- remain in the league, but only the current grid is active going forward.
  update public.drivers
  set is_active = false,
      updated_at = now()
  where league_id = p_league_id
    and is_active = true;

  for v_roster in
    select roster.team_name, roster.driver_name
    from (values
      ('f1_25', 'Alpine', 'Pierre Gasly'),
      ('f1_25', 'Alpine', 'Franco Colapinto'),
      ('f1_25', 'Aston Martin', 'Fernando Alonso'),
      ('f1_25', 'Aston Martin', 'Lance Stroll'),
      ('f1_25', 'Ferrari', 'Charles Leclerc'),
      ('f1_25', 'Ferrari', 'Lewis Hamilton'),
      ('f1_25', 'Haas', 'Esteban Ocon'),
      ('f1_25', 'Haas', 'Oliver Bearman'),
      ('f1_25', 'McLaren', 'Lando Norris'),
      ('f1_25', 'McLaren', 'Oscar Piastri'),
      ('f1_25', 'Mercedes', 'George Russell'),
      ('f1_25', 'Mercedes', 'Andrea Kimi Antonelli'),
      ('f1_25', 'Red Bull', 'Max Verstappen'),
      ('f1_25', 'Red Bull', 'Yuki Tsunoda'),
      ('f1_25', 'Sauber', 'Nico Hülkenberg'),
      ('f1_25', 'Sauber', 'Gabriel Bortoleto'),
      ('f1_25', 'VCARB', 'Isack Hadjar'),
      ('f1_25', 'VCARB', 'Liam Lawson'),
      ('f1_25', 'Williams', 'Alexander Albon'),
      ('f1_25', 'Williams', 'Carlos Sainz'),
      ('f1_26', 'Red Bull Racing', 'Max Verstappen'),
      ('f1_26', 'Red Bull Racing', 'Isack Hadjar'),
      ('f1_26', 'Mercedes', 'George Russell'),
      ('f1_26', 'Mercedes', 'Andrea Kimi Antonelli'),
      ('f1_26', 'Ferrari', 'Lewis Hamilton'),
      ('f1_26', 'Ferrari', 'Charles Leclerc'),
      ('f1_26', 'McLaren', 'Lando Norris'),
      ('f1_26', 'McLaren', 'Oscar Piastri'),
      ('f1_26', 'Aston Martin', 'Fernando Alonso'),
      ('f1_26', 'Aston Martin', 'Lance Stroll'),
      ('f1_26', 'Alpine', 'Pierre Gasly'),
      ('f1_26', 'Alpine', 'Franco Colapinto'),
      ('f1_26', 'Williams', 'Alexander Albon'),
      ('f1_26', 'Williams', 'Carlos Sainz'),
      ('f1_26', 'Racing Bulls', 'Liam Lawson'),
      ('f1_26', 'Racing Bulls', 'Arvid Lindblad'),
      ('f1_26', 'Audi', 'Nico Hülkenberg'),
      ('f1_26', 'Audi', 'Gabriel Bortoleto'),
      ('f1_26', 'Haas', 'Esteban Ocon'),
      ('f1_26', 'Haas', 'Oliver Bearman'),
      ('f1_26', 'Cadillac', 'Sergio Pérez'),
      ('f1_26', 'Cadillac', 'Valtteri Bottas')
    ) as roster(game_key, team_name, driver_name)
    where roster.game_key = v_game_key
  loop
    v_driver_id := null;

    -- Prefer an already configured seat (AI reference), so existing player/
    -- gamertag data can carry forward without rewriting historical driver IDs.
    select d.id into v_driver_id
    from public.drivers d
    where d.league_id = p_league_id
      and (
        lower(coalesce(d.ai_driver_reference, '')) = lower(v_roster.driver_name)
        or lower(d.display_name) = lower(v_roster.driver_name)
        or (
          lower(v_roster.driver_name) = 'nico hülkenberg'
          and (
            lower(coalesce(d.ai_driver_reference, '')) = 'nico hulkenberg'
            or lower(d.display_name) = 'nico hulkenberg'
          )
        )
      )
    order by
      case when lower(coalesce(d.ai_driver_reference, '')) = lower(v_roster.driver_name) then 0 else 1 end,
      case when nullif(trim(coalesce(d.gamertag, '')), '') is not null then 0 else 1 end,
      d.updated_at desc nulls last
    limit 1;

    if v_driver_id is null then
      insert into public.drivers (
        league_id,
        display_name,
        gamertag,
        real_name,
        ai_driver_reference,
        car_name,
        league_team,
        is_active
      ) values (
        p_league_id,
        v_roster.driver_name,
        null,
        v_roster.driver_name,
        v_roster.driver_name,
        v_roster.team_name,
        v_roster.team_name,
        true
      )
      returning id into v_driver_id;
    else
      update public.drivers
      set is_active = true,
          ai_driver_reference = v_roster.driver_name,
          car_name = v_roster.team_name,
          league_team = v_roster.team_name,
          updated_at = now()
      where id = v_driver_id;
    end if;

    insert into public.driver_season_assignments (
      season_id,
      driver_id,
      car_name,
      ai_driver_reference,
      league_team,
      is_primary,
      effective_round_number,
      notes
    ) values (
      v_season.id,
      v_driver_id,
      v_roster.team_name,
      v_roster.driver_name,
      v_roster.team_name,
      true,
      1,
      'Automatisch beim Saisonstart aus dem KI-Fahrerkader angelegt'
    );

    v_seeded := v_seeded + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'id', v_season.id,
    'slug', v_season.slug,
    'name', v_season.name,
    'league_id', v_season.league_id,
    'game_key', v_season.game_key,
    'game_label', v_season.game_label,
    'seeded_ai_drivers', v_seeded
  );
end;
$$;
