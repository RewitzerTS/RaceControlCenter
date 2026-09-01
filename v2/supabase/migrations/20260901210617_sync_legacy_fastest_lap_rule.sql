-- Preserve the rule selected in the legacy league settings for seasons that
-- already existed before season-scoped fastest-lap rules were introduced.

update public.seasons as season
set fastest_lap_bonus_enabled = true,
    fastest_lap_bonus_points = 1,
    fastest_lap_bonus_max_finish_position = 10,
    updated_at = now()
from public.leagues as league
where league.id = season.league_id
  and season.created_at < timestamptz '2026-08-31 18:31:45+00'
  and season.fastest_lap_bonus_enabled = false
  and lower(coalesce(league.settings -> 'rules' ->> 'fastest_lap_point', '')) in (
    '1', 'an', 'ja', 'on', 'true', 'yes'
  );
