import { expect, test } from '@playwright/test';
import { installPublicFixture, publicRacingFixture } from './public-fixture';

test.beforeEach(async ({ context }) => { await installPublicFixture(context); });
test.afterEach(async ({ page }, testInfo) => {
  if (process.env.RACEVORA_CAPTURE_UI === '1') await page.screenshot({ path: testInfo.outputPath('verified.png'), fullPage: true });
});
test('driver and team standings are native, retain scores and navigate back correctly', async ({ page }) => {
  const privateRequests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/rest/v1/season_driver_assignments')) privateRequests.push(request.url()); });
  await page.goto('/racing/standings?league=rcc&demo=1');
  await expect(page.locator('#drivers-standings-body tr')).toHaveCount(2);
  await expect(page.locator('main iframe')).toHaveCount(0);
  const row = page.locator('#drivers-standings-body tr').first();
  await expect(row.locator('td').nth(8)).toHaveText('26');
  await expect(row.locator('td').nth(7)).toHaveText('1');
  await row.locator('a').click();
  await expect(page).toHaveURL(/\/racing\/drivers\/profile\?league=rcc&driver=/);
  await page.goBack();
  await page.locator('.standings-switch a').nth(1).click();
  await expect(page).toHaveURL(/view=teams/);
  await expect(page.locator('#teams-standings-body tr')).toHaveCount(1);
  await expect(page.locator('#teams-standings-body td').last()).toHaveText('44');
  await page.locator('#teams-standings-body td').nth(2).locator('a').click();
  await expect(page).toHaveURL(/\/racing\/teams\/profile\?league=rcc&team=Test/);
  await page.goBack();
  await expect(page.locator('#teams-standings-body tr')).toHaveCount(1);
  expect(privateRequests).toEqual([]);
});
test('long names fit a 320px compact table, optional statistics stay inside a scroll region', async ({ page, context }) => {
  await context.route('**/rest/v1/drivers?**', (route) => route.fulfill({ json: [{ id: '50000000-0000-4000-8000-000000000001', display_name: 'AußergewöhnlichlangerFahrername1234567890 Änne', car_name: 'McLaren MCL39', league_team: 'Test Team', is_active: true }] }));
  await context.route('**/rest/v1/race_results?**', (route) => route.fulfill({ json: [{ id: 'r1', race_id: '30000000-0000-4000-8000-000000000001', result_version_id: '40000000-0000-4000-8000-000000000001', driver_id: '50000000-0000-4000-8000-000000000001', awarded_points: 26, finish_position: 1, car_name_snapshot: 'McLaren MCL39', points_car_name: 'McLaren MCL39' }] }));
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/racing/standings?league=rcc&demo=1');
  await expect(page.locator('#drivers-standings-body tr')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.standings-detail-toggle').click();
  await expect(page.locator('.standings-detail-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.standing-car')).toHaveAttribute('alt', 'McLaren MCL39');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.standings-detail-toggle').click();
  await expect(page.locator('#drivers-standings-body td').nth(3)).toBeHidden();
});
test('championship load failure offers a working retry', async ({ page, context }) => {
  let fail = true;
  await context.route('**/rest/v1/race_results?**', async (route) => { if (fail) await route.fulfill({ status: 503, json: { message: 'Fixture unavailable' } }); else await route.fallback(); });
  await page.goto('/racing/standings?league=rcc&demo=1');
  await expect(page.locator('.native-standings [role="alert"]')).toBeVisible();
  fail = false;
  await page.locator('.native-standings button').click();
  await expect(page.locator('#drivers-standings-body tr')).toHaveCount(2);
});
test('no active season points to the archive and does not invent standings', async ({ page, context }) => {
  await context.route('**/rest/v1/seasons?**', (route) => route.fulfill({ json: null }));
  await page.goto('/racing/standings?league=rcc&demo=1');
  await expect(page.locator('.native-standings')).toContainText('Aktuell läuft keine Saison');
  await expect(page.locator('.native-standings table')).toHaveCount(0);
  await expect(page.locator('.native-standings a[href*="view=seasons"]')).toBeVisible();
});

test('signed-in drivers see all three season teams before any race, including after reload and roster retry', async ({ page, context }) => {
  const user = { id: '91000000-0000-4000-8000-000000000086', email: 'standings-driver@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { onboarding_complete: true, display_name: 'Standings Test' } };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', aal: 'aal1', exp })).toString('base64url')}.synthetic`;
  await context.addInitScript(({ user, token, exp }) => {
    localStorage.setItem('racevora.locale', 'de');
    for (const ref of ['nfvwarlowjqphytqqtxz', 'znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`, JSON.stringify({ user, access_token: token, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer' }));
  }, { user, token, exp });
  const teamNames = ['Ice Test Team', 'Black Test Team', 'Stars Test Team'];
  const drivers = Array.from({ length: 6 }, (_, i) => ({ ...publicRacingFixture.drivers[0], id: `50000000-0000-4000-8000-00000000000${i + 1}`, display_name: `Test Driver ${i + 1}`, league_team: 'Previous season team' }));
  const roster = drivers.map((driver, i) => ({ driver_id: driver.id, team_name: teamNames[Math.floor(i / 2)], car_name: ['Red Bull RB21', 'McLaren MCL39', 'Mercedes W16'][Math.floor(i / 2)] }));
  const calls: unknown[] = [];
  let failRoster = false;
  await context.route('https://*.supabase.co/**', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    if (name === 'user') return route.fulfill({ json: user });
    if (name === 'current_app_role') return route.fulfill({ json: 'driver' });
    if (name === 'get_owner_mfa_status') return route.fulfill({ json: { is_owner: false, verified: false } });
    if (name === 'league_members') return route.fulfill({ json: [{ league_id: publicRacingFixture.league.id, role: 'driver' }] });
    if (name === 'driver_identities') return route.fulfill({ json: { id: user.id, status: 'active', profile_number: 86 } });
    if (name === 'drivers') return route.fulfill({ json: drivers });
    if (name === 'races') return route.fulfill({ json: [{ ...publicRacingFixture.race, status: 'upcoming', current_result_version_id: null }] });
    if (name === 'season_driver_assignments') return route.fulfill({ json: drivers.map((d, i) => ({ driver_id: d.id, car_name: 'Old car', team_name: i < 2 ? teamNames[0] : '', created_at: '', seat_code: `seat-${i}`, participant_type: 'PLAYER' })) });
    if (name === 'get_season_championship_roster') {
      calls.push(route.request().postDataJSON());
      return route.fulfill({ status: failRoster ? 503 : 200, json: failRoster ? { message: 'Test unavailable' } : roster });
    }
    if (route.request().url().includes('/rpc/')) return route.fulfill({ json: null });
    return route.fallback();
  });
  await page.goto('/racing/standings?league=rcc');
  const rows = page.locator('#drivers-standings-body tr');
  await expect(rows).toHaveCount(6);
  const details = page.locator('.standings-detail-toggle');
  if (await details.isVisible()) await details.click();
  for (let i = 0; i < 6; i++) {
    await expect(rows.nth(i).locator('td').nth(3)).toHaveText(teamNames[Math.floor(i / 2)]);
    await expect(rows.nth(i).locator('td').nth(8)).toHaveText('0');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(calls[0]).toEqual({ p_season_id: publicRacingFixture.season.id });
  await page.reload();
  await expect(rows).toHaveCount(6);
  await expect(page.locator('#drivers-standings-body')).not.toContainText('Ohne Team');
  failRoster = true;
  await page.reload();
  await expect(page.locator('.native-standings [role="alert"]')).toBeVisible();
  await expect(rows).toHaveCount(0);
  failRoster = false;
  await page.locator('.native-standings [role="alert"] button').click();
  await expect(rows).toHaveCount(6);
  await expect(page.locator('#drivers-standings-body')).not.toContainText('Ohne Team');
  await page.goto('/racing/grid?league=rcc');
  await expect(page.locator('.native-grid-team')).toHaveCount(3);
  for (const name of teamNames) {
    const team = page.locator('.native-grid-team').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(team.locator('li')).toHaveCount(2);
  }
  await expect(page.locator('.native-grid')).not.toContainText('Previous season team');
});
