-- Store the fastest-lap bonus as a season rule so historical seasons keep
-- the rule that was selected when their calendar was configured.

alter table public.seasons
  add column if not exists fastest_lap_bonus_enabled boolean not null default false,
  add column if not exists fastest_lap_bonus_points numeric(5,2) not null default 1,
  add column if not exists fastest_lap_bonus_max_finish_position smallint not null default 10;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'seasons_fastest_lap_bonus_points_check'
      and conrelid = 'public.seasons'::regclass
  ) then
    alter table public.seasons
      add constraint seasons_fastest_lap_bonus_points_check
      check (fastest_lap_bonus_points >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'seasons_fastest_lap_bonus_max_finish_position_check'
      and conrelid = 'public.seasons'::regclass
  ) then
    alter table public.seasons
      add constraint seasons_fastest_lap_bonus_max_finish_position_check
      check (fastest_lap_bonus_max_finish_position between 1 and 99);
  end if;
end
$$;

comment on column public.seasons.fastest_lap_bonus_enabled is
  'Whether this season awards the configured fastest-lap bonus.';
comment on column public.seasons.fastest_lap_bonus_points is
  'Points awarded for the fastest lap when the season rule is enabled.';
comment on column public.seasons.fastest_lap_bonus_max_finish_position is
  'Highest numerical finishing position eligible for the fastest-lap bonus.';

create or replace function private.set_league_season_fastest_lap_rule(
  p_season_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select s.league_id
  into target_league_id
  from public.seasons s
  join public.leagues l on l.id = s.league_id
  where s.id = p_season_id
    and s.is_active
    and l.slug = public.requested_league_slug()
  for update of s;

  if target_league_id is null
     or not private.has_league_capability(target_league_id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Season rule access denied.';
  end if;

  if exists (
    select 1
    from public.races r
    where r.season_id = p_season_id
      and (
        r.status <> 'upcoming'
        or exists (
          select 1
          from public.result_versions rv
          where rv.race_id = r.id
        )
      )
  ) then
    raise exception using errcode = '23514', message = 'Season rules cannot be changed after racing has started.';
  end if;

  update public.seasons
  set fastest_lap_bonus_enabled = coalesce(p_enabled, false),
      fastest_lap_bonus_points = 1,
      fastest_lap_bonus_max_finish_position = 10,
      updated_at = now()
  where id = p_season_id;

  insert into public.v2_audit_events (
    scope, league_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league',
    target_league_id,
    actor_id,
    'season.fastest_lap_rule.configured',
    'season',
    p_season_id,
    jsonb_build_object(
      'enabled', coalesce(p_enabled, false),
      'points', 1,
      'maximum_finish_position', 10
    )
  );
end;
$$;

revoke all on function private.set_league_season_fastest_lap_rule(uuid, boolean)
  from public, anon, authenticated, service_role;

create or replace function public.start_league_season_with_rules_and_calendar(
  p_name text,
  p_slug text,
  p_game_key text,
  p_start_date date,
  p_assignments jsonb,
  p_calendar jsonb,
  p_fastest_lap_bonus_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  season_id uuid;
begin
  result := public.start_league_season_with_calendar(
    p_name,
    p_slug,
    p_game_key,
    p_start_date,
    coalesce(p_assignments, '[]'::jsonb),
    p_calendar
  );

  season_id := (result -> 'season' ->> 'id')::uuid;
  perform private.set_league_season_fastest_lap_rule(
    season_id,
    coalesce(p_fastest_lap_bonus_enabled, false)
  );

  return result || jsonb_build_object(
    'fastest_lap_bonus_enabled', coalesce(p_fastest_lap_bonus_enabled, false),
    'fastest_lap_bonus_points', 1,
    'fastest_lap_bonus_max_finish_position', 10
  );
end;
$$;

revoke all on function public.start_league_season_with_rules_and_calendar(
  text, text, text, date, jsonb, jsonb, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.start_league_season_with_rules_and_calendar(
  text, text, text, date, jsonb, jsonb, boolean
) to authenticated, service_role;

create or replace function public.configure_league_season_rules_and_calendar(
  p_season_id uuid,
  p_calendar jsonb,
  p_fastest_lap_bonus_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := public.configure_league_season_calendar(p_season_id, p_calendar);
  perform private.set_league_season_fastest_lap_rule(
    p_season_id,
    coalesce(p_fastest_lap_bonus_enabled, false)
  );

  return result || jsonb_build_object(
    'fastest_lap_bonus_enabled', coalesce(p_fastest_lap_bonus_enabled, false),
    'fastest_lap_bonus_points', 1,
    'fastest_lap_bonus_max_finish_position', 10
  );
end;
$$;

revoke all on function public.configure_league_season_rules_and_calendar(
  uuid, jsonb, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.configure_league_season_rules_and_calendar(
  uuid, jsonb, boolean
) to authenticated, service_role;

comment on function public.start_league_season_with_rules_and_calendar(
  text, text, text, date, jsonb, jsonb, boolean
) is 'Atomically starts a season with its calendar and fixed fastest-lap eligibility rule.';
comment on function public.configure_league_season_rules_and_calendar(
  uuid, jsonb, boolean
) is 'Configures an unraced season calendar and its fastest-lap bonus rule in one transaction.';
