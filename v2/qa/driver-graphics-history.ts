export { driverStats } from '../src/racing/profileData.ts';
import type { HistoryData } from '../src/racing/profileData.ts';
export async function loadHistory(): Promise<HistoryData> {
  return {
    leagueId: 'qa-only', profileNumbers: {}, assignments: [],
    seasons: [{ id: 's1', name: 'QA · F1 26', is_active: true, start_date: null, created_at: '' }],
    drivers: Array.from({ length: 22 }, (_, index) => ({ id: `d${index}`, display_name: `Testfahrer ${index + 1}`, gamertag: `QA_Fahrer_${index + 1}`, car_name: 'Mercedes', league_team: 'QA Team', is_active: true })),
    races: [{ id: 'r1', season_id: 's1', round_number: 1, grand_prix_name: 'Monaco GP', circuit_name: 'Circuit de Monaco', country_code: 'MC', status: 'completed', current_result_version_id: 'v1', race_date: '2026-09-06', race_start_at: null, race_time: null, weather: null }],
    results: Array.from({ length: 22 }, (_, index) => ({ id: `result${index}`, race_id: 'r1', result_version_id: 'v1', driver_id: `d${index}`, points_owner_driver_id: null, awarded_points: 22 - index, participation_status: 'PLAYER', fastest_lap_time_ms: null, fastest_lap_ms: null, fastest_lap_time: null, points_car_name: 'Mercedes', car_name_snapshot: 'Mercedes', points_team_name: 'QA Team', finish_position: index + 1, grid_position: index + 1, race_time: null })),
  };
}
