import type { BrowserContext } from '@playwright/test';

const league = { id: '10000000-0000-4000-8000-000000000001', slug: 'rcc', name: 'Browser Test League', is_public: true, status: 'active', logo_url: null, settings: { published: true, owner_only: false } };
const season = { id: '20000000-0000-4000-8000-000000000001', league_id: league.id, slug: 'browser-season', name: 'Browser Test Season', is_active: true, game_key: 'f1-25', created_at: '2026-01-01T00:00:00Z', fastest_lap_bonus_enabled: true, fastest_lap_bonus_points: 1, fastest_lap_bonus_max_finish_position: 10 };
const race = { id: '30000000-0000-4000-8000-000000000001', season_id: season.id, round_number: 1, grand_prix_name: 'Japan GP', circuit_name: 'Suzuka International Racing Course', country_code: 'JP', race_date: '2026-08-01', race_start_at: '2026-08-01T18:00:00Z', status: 'completed', current_result_version_id: '40000000-0000-4000-8000-000000000001' };
const drivers = [1, 2].map((position) => ({ id: `50000000-0000-4000-8000-00000000000${position}`, league_id: league.id, display_name: `Test Driver ${position}`, gamertag: `Test${position}`, is_active: true, league_team: 'Test Team', car_name: 'Test Car', nationality_code: 'DE', number: position }));
const results = drivers.map((driver, index) => ({ id: `60000000-0000-4000-8000-00000000000${index + 1}`, race_id: race.id, result_version_id: race.current_result_version_id, driver_id: driver.id, grid_position: index + 1, finish_position: index + 1, participation_status: 'HUMAN', base_points: index ? 18 : 25, awarded_points: index ? 18 : 26, fastest_lap_time_ms: index ? 92000 : 91000, race_time_ms: 3600000 + index * 4000, car_name_snapshot: 'Test Car', points_team_name: 'Test Team' }));
const tables: Record<string, unknown[]> = { leagues: [league], seasons: [season], races: [race], drivers, race_results: results };
export const publicRacingFixture = { league, season, race, drivers, results };

export async function installPublicFixture(context: BrowserContext) {
  await context.route('https://*.supabase.co/**', async (route) => {
    const request = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.abort('blockedbyclient');
    if (process.env.RACEVORA_SMOKE_LIVE === '1') return route.continue();
    const table = new URL(request.url()).pathname.split('/').pop() || '';
    if (table === 'season_driver_assignments') return route.fulfill({ status: 401, json: { message: 'Private roster: permission denied' } });
    const rows = tables[table] || [];
    const single = (request.headers().accept || '').includes('vnd.pgrst.object');
    await route.fulfill({ status: 200, json: single ? rows[0] ?? null : rows });
  });
}
