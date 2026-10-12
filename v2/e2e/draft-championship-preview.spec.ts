import { expect, test } from '@playwright/test';
import { installPublicFixture, publicRacingFixture as f } from './public-fixture';

test('saved draft previews a full championship, switches and refreshes without publishing', async ({ page, context }, info) => {
  await installPublicFixture(context);
  const user = { id: '91000000-0000-4000-8000-000000000092', email: 'preview@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { display_name: 'Test Admin', onboarding_complete: true } };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', aal: 'aal1', exp })).toString('base64url')}.synthetic`;
  await context.addInitScript(({ user, token, exp }) => {
    localStorage.setItem('racevora.locale', 'de');
    for (const ref of ['nfvwarlowjqphytqqtxz', 'znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`, JSON.stringify({ user, access_token: token, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer' }));
  }, { user, token, exp });
  const drivers = Array.from({ length: 22 }, (_, i) => ({ ...f.drivers[0], id: `driver-${i}`, display_name: i === 2 ? 'Maximilian Alexander Beispielname' : `Testfahrer ${String(i + 1).padStart(2, '0')}`, gamertag: `TestGamertag_${i + 1}` }));
  let saved = false; let failPreview = false;
  const writes: string[] = [];
  const drafts = [1, 2].map(i => ({ id: `draft-${i}`, race_id: f.race.id, race_name: i === 1 ? 'Japan GP' : 'China GP', version_number: i, row_count: 22, status: 'validated', created_at: `2026-10-12T16:0${i}:00Z` }));
  await context.route('https://*.supabase.co/**', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    if (name === 'user') return route.fulfill({ json: user });
    if (name === 'current_app_role') return route.fulfill({ json: 'league_admin' });
    if (name === 'get_owner_mfa_status') return route.fulfill({ json: { is_owner: false, verified: false } });
    if (name === 'league_members') return route.fulfill({ json: [{ league_id: f.league.id, role: 'league_admin' }] });
    if (name === 'driver_identities') return route.fulfill({ json: { id: user.id, status: 'active', profile_number: 92 } });
    if (name === 'get_league_race_admin_workspace') return route.fulfill({ json: { league: f.league, seasons: [{ ...f.season, is_active: true }], races: [{ ...f.race, current_result_version_id: null }], driver_standings: [], team_standings: [] } });
    if (name === 'get_league_driver_admin_workspace') return route.fulfill({ json: { league: f.league, drivers, counts: { total: 22, active: 22, linked: 22 } } });
    if (name === 'get_league_configuration_workspace') return route.fulfill({ json: { league: f.league, rules: {}, faqs: [], audit: [], result_drafts: saved ? drafts : [] } });
    if (name === 'create_league_result_draft') { saved = true; writes.push(name); return route.fulfill({ json: { id: 'draft-2' } }); }
    if (name === 'get_result_draft_championship_preview') {
      if (failPreview) return route.fulfill({ status: 400, json: { message: 'PREVIEW_STEWARD_TIMES_REQUIRED' } });
      const id = route.request().postDataJSON().p_result_version_id;
      return route.fulfill({ json: { versionId: id, versionNumber: id === 'draft-1' ? 1 : 2, raceId: f.race.id, raceName: id === 'draft-1' ? 'Japan GP' : 'China GP', generatedAt: '2026-10-12T16:00:00Z', pendingCorrections: 2, replacesPublished: false,
        data: { season: f.season, drivers, races: [{ ...f.race, current_result_version_id: null, status: 'upcoming' }], assignments: [], results: [], currentRoster: drivers.map(d => ({ driver_id: d.id, team_name: null, car_name: 'Test Car' })) },
        draftRows: drivers.map((d, i) => ({ id: `row-${i}`, driver_id: d.id, race_id: f.race.id, result_version_id: id, finish_position: i + 1, awarded_points: i === 0 ? (id === 'draft-1' ? 18 : 25) : Math.max(0, 18 - i * 2), fastest_lap_time_ms: 80000 + i * 1000 })) } });
    }
    if (name?.includes('publish') || name?.includes('discard')) writes.push(name);
    if (route.request().url().includes('/rpc/')) return route.fulfill({ json: null });
    return route.fallback();
  });
  await page.goto('/admin/results/import?league=rcc');
  const panel = page.locator('.draft-championship');
  await expect(panel).toContainText('Nach dem Speichern');
  await page.locator('.result-import-race-row select').selectOption(f.race.id);
  await page.getByRole('radio', { name: /CSV/ }).check();
  await page.getByRole('textbox', { name: 'CSV-Daten prüfen' }).fill('driver;finish_position;grid_position;points\nTestfahrer 01;1;1;25');
  await page.getByRole('button', { name: 'Entwurf speichern', exact: true }).click();
  await expect(panel.locator('tbody tr')).toHaveCount(22);
  await expect(panel.locator('tbody tr').first()).toContainText('25');
  await expect(panel).toContainText('Die offizielle WM und XP bleiben unverändert.');
  await panel.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('draft-championship-page.png'), fullPage: true });
  await panel.getByLabel('Gespeicherter Entwurf').selectOption('draft-1');
  await expect(panel.locator('tbody tr').first()).toContainText('18');
  failPreview = true;
  await panel.getByRole('button', { name: 'Vorschau aktualisieren' }).click();
  await expect(panel.getByRole('alert')).toContainText('gültige Rennzeiten');
  await expect(panel.locator('tbody')).toHaveCount(0);
  failPreview = false;
  await panel.getByRole('button', { name: 'Vorschau aktualisieren' }).click();
  await expect(panel.locator('tbody tr')).toHaveCount(22);
  await page.reload();
  await expect(panel.locator('tbody tr')).toHaveCount(22);
  expect(writes).toEqual(['create_league_result_draft']);
});
