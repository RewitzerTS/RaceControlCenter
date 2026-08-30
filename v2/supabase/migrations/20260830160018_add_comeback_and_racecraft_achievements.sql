-- Adds deterministic Racecraft Achievements derived from ordered official player results.
-- The original 50 tiered Core Achievements remain unchanged.

alter table public.achievement_definitions
  drop constraint achievement_definitions_metric_check;

alter table public.achievement_definitions
  add constraint achievement_definitions_metric_check check (
    metric in (
      'starts', 'classified_finishes', 'wins', 'podiums',
      'poles', 'fastest_laps', 'leagues_competed',
      'podiums_after_dnf', 'wins_after_dnf', 'wins_after_two_dnfs',
      'perfect_weekends', 'wins_from_grid_10', 'podiums_from_grid_15',
      'win_streak', 'classified_streak', 'pole_streak',
      'fastest_lap_streak', 'first_race_wins'
    )
  );

insert into public.achievement_definitions (
  code, metric, threshold, title_key, description_key, reward_vc,
  rule_version, sort_order, is_core
) values
  ('podiums_after_dnf_1', 'podiums_after_dnf', 1, 'achievement.podium_after_dnf.title', 'achievement.podium_after_dnf.description', 200, 1, 51, false),
  ('wins_after_dnf_1', 'wins_after_dnf', 1, 'achievement.win_after_dnf.title', 'achievement.win_after_dnf.description', 500, 1, 52, false),
  ('wins_after_two_dnfs_1', 'wins_after_two_dnfs', 1, 'achievement.win_after_two_dnfs.title', 'achievement.win_after_two_dnfs.description', 750, 1, 53, false),
  ('perfect_weekends_1', 'perfect_weekends', 1, 'achievement.perfect_weekend.title', 'achievement.perfect_weekend.description', 750, 1, 54, false),
  ('wins_from_grid_10_1', 'wins_from_grid_10', 1, 'achievement.win_from_grid_10.title', 'achievement.win_from_grid_10.description', 600, 1, 55, false),
  ('podiums_from_grid_15_1', 'podiums_from_grid_15', 1, 'achievement.podium_from_grid_15.title', 'achievement.podium_from_grid_15.description', 500, 1, 56, false),
  ('win_streak_3', 'win_streak', 3, 'achievement.win_streak.title', 'achievement.win_streak.description', 750, 1, 57, false),
  ('classified_streak_5', 'classified_streak', 5, 'achievement.classified_streak.title', 'achievement.classified_streak.description', 400, 1, 58, false),
  ('pole_streak_3', 'pole_streak', 3, 'achievement.pole_streak.title', 'achievement.pole_streak.description', 600, 1, 59, false),
  ('fastest_lap_streak_3', 'fastest_lap_streak', 3, 'achievement.fastest_lap_streak.title', 'achievement.fastest_lap_streak.description', 600, 1, 60, false),
  ('first_race_wins_1', 'first_race_wins', 1, 'achievement.first_race_win.title', 'achievement.first_race_win.description', 750, 1, 61, false);

create or replace function private.achievement_metric_value(
  p_driver_identity_id uuid,
  p_metric text
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with current_facts as (
    select
      rr.race_id,
      lower(rr.classification_status) as classification_status,
      rr.finish_position,
      rr.grid_position,
      rr.fastest_lap_time_ms,
      s.league_id,
      coalesce(
        r.race_start_at,
        r.race_date::timestamptz,
        r.weekend_start_date::timestamptz,
        r.created_at
      ) as race_at,
      (
        rr.fastest_lap_time_ms is not null
        and rr.fastest_lap_time_ms = (
          select min(rr2.fastest_lap_time_ms)
          from public.race_results rr2
          where rr2.race_id = rr.race_id
            and upper(rr2.participation_status) = 'PLAYER'
            and rr2.fastest_lap_time_ms is not null
        )
      ) as is_fastest_lap
    from public.race_results rr
    join public.drivers d
      on d.id = rr.driver_id
     and d.is_active
    join public.driver_identity_links dil
      on dil.driver_id = d.id
     and dil.driver_identity_id = p_driver_identity_id
    join public.driver_identities di
      on di.id = dil.driver_identity_id
     and di.status = 'active'
    join public.races r on r.id = rr.race_id
    join public.seasons s on s.id = r.season_id
    where upper(rr.participation_status) = 'PLAYER'
  ),
  started_facts as (
    select
      cf.*,
      row_number() over (order by cf.race_at, cf.race_id) as start_sequence
    from current_facts cf
    where cf.classification_status <> 'dns'
  ),
  sequenced_facts as (
    select
      sf.*,
      sf.classification_status = 'classified' and sf.finish_position = 1 as is_win,
      sf.classification_status = 'classified' and sf.finish_position between 1 and 3 as is_podium,
      sf.classification_status = 'classified' as is_classified,
      sf.grid_position = 1 as is_pole,
      lag(sf.classification_status, 1) over (
        order by sf.start_sequence
      ) as previous_status,
      lag(sf.classification_status, 2) over (
        order by sf.start_sequence
      ) as second_previous_status
    from started_facts sf
  ),
  streak_groups as (
    select
      qf.*,
      sum(case when qf.is_win then 0 else 1 end) over (
        order by qf.start_sequence
      ) as win_group,
      sum(case when qf.is_classified then 0 else 1 end) over (
        order by qf.start_sequence
      ) as classified_group,
      sum(case when qf.is_pole then 0 else 1 end) over (
        order by qf.start_sequence
      ) as pole_group,
      sum(case when qf.is_fastest_lap then 0 else 1 end) over (
        order by qf.start_sequence
      ) as fastest_lap_group
    from sequenced_facts qf
  ),
  totals as (
    select
      count(*) filter (where classification_status <> 'dns')::bigint as starts,
      count(*) filter (where classification_status = 'classified')::bigint as classified_finishes,
      count(*) filter (
        where classification_status = 'classified' and finish_position = 1
      )::bigint as wins,
      count(*) filter (
        where classification_status = 'classified' and finish_position between 1 and 3
      )::bigint as podiums,
      count(*) filter (where grid_position = 1)::bigint as poles,
      count(*) filter (where is_fastest_lap)::bigint as fastest_laps,
      count(distinct league_id)::bigint as leagues_competed
    from current_facts
  ),
  racecraft_totals as (
    select
      count(*) filter (
        where is_podium and previous_status = 'dnf'
      )::bigint as podiums_after_dnf,
      count(*) filter (
        where is_win and previous_status = 'dnf'
      )::bigint as wins_after_dnf,
      count(*) filter (
        where is_win
          and previous_status = 'dnf'
          and second_previous_status = 'dnf'
      )::bigint as wins_after_two_dnfs,
      count(*) filter (
        where is_win and is_pole and is_fastest_lap
      )::bigint as perfect_weekends,
      count(*) filter (
        where is_win and grid_position >= 10
      )::bigint as wins_from_grid_10,
      count(*) filter (
        where is_podium and grid_position >= 15
      )::bigint as podiums_from_grid_15,
      coalesce(max(
        case when start_sequence = 1 and is_win then 1 else 0 end
      ), 0)::bigint as first_race_wins
    from sequenced_facts
  ),
  win_streaks as (
    select coalesce(max(streak_length), 0)::bigint as win_streak
    from (
      select count(*)::bigint as streak_length
      from streak_groups
      where is_win
      group by win_group
    ) streaks
  ),
  classified_streaks as (
    select coalesce(max(streak_length), 0)::bigint as classified_streak
    from (
      select count(*)::bigint as streak_length
      from streak_groups
      where is_classified
      group by classified_group
    ) streaks
  ),
  pole_streaks as (
    select coalesce(max(streak_length), 0)::bigint as pole_streak
    from (
      select count(*)::bigint as streak_length
      from streak_groups
      where is_pole
      group by pole_group
    ) streaks
  ),
  fastest_lap_streaks as (
    select coalesce(max(streak_length), 0)::bigint as fastest_lap_streak
    from (
      select count(*)::bigint as streak_length
      from streak_groups
      where is_fastest_lap
      group by fastest_lap_group
    ) streaks
  )
  select case p_metric
    when 'starts' then t.starts
    when 'classified_finishes' then t.classified_finishes
    when 'wins' then t.wins
    when 'podiums' then t.podiums
    when 'poles' then t.poles
    when 'fastest_laps' then t.fastest_laps
    when 'leagues_competed' then t.leagues_competed
    when 'podiums_after_dnf' then rt.podiums_after_dnf
    when 'wins_after_dnf' then rt.wins_after_dnf
    when 'wins_after_two_dnfs' then rt.wins_after_two_dnfs
    when 'perfect_weekends' then rt.perfect_weekends
    when 'wins_from_grid_10' then rt.wins_from_grid_10
    when 'podiums_from_grid_15' then rt.podiums_from_grid_15
    when 'win_streak' then ws.win_streak
    when 'classified_streak' then cs.classified_streak
    when 'pole_streak' then ps.pole_streak
    when 'fastest_lap_streak' then fs.fastest_lap_streak
    when 'first_race_wins' then rt.first_race_wins
    else 0
  end
  from totals t
  cross join racecraft_totals rt
  cross join win_streaks ws
  cross join classified_streaks cs
  cross join pole_streaks ps
  cross join fastest_lap_streaks fs;
$$;

revoke all on function private.achievement_metric_value(uuid, text)
  from public, anon, authenticated, service_role;

comment on table public.achievement_definitions is
  'Immutable tiered Core and deterministic Racecraft Achievement rules using translated presentation keys.';

comment on function private.achievement_metric_value(uuid, text) is
  'Returns cumulative and ordered-result Achievement evidence from current official PLAYER results.';
