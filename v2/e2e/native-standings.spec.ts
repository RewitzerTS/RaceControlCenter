import { expect, test } from '@playwright/test';
import { installPublicFixture } from './public-fixture';

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
