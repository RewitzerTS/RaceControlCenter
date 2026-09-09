import { expect, test } from '@playwright/test';
import { installPublicFixture } from './public-fixture';

const driver = '50000000-0000-4000-8000-000000000001';
const season = '20000000-0000-4000-8000-000000000001';
test.beforeEach(async ({ context }) => { await installPublicFixture(context); });
test('driver, team and race are native with complete statistics and linked navigation', async ({ page }, testInfo) => {
  await page.goto(`/racing/drivers/profile?league=rcc&demo=1&driver=${driver}`);
  await expect(page.locator('.profile-identity h2')).toHaveText('Test Driver 1');
  await expect(page.locator('main iframe')).toHaveCount(0);
  await expect(page.locator('.profile-stats div').filter({ has: page.locator('dt', { hasText: /^Punkte$/ }) }).locator('dd')).toHaveText('26');
  await expect(page.locator('.profile-stats div').filter({ has: page.locator('dt', { hasText: /^Schnellste Runden$/ }) }).locator('dd')).toHaveText('1');
  await expect(page.locator('.profile-flag')).toBeVisible();
  await expect.poll(() => page.locator('.profile-flag').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.profile-form').evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(200);
  if (process.env.RACEVORA_CAPTURE_UI === '1') await page.screenshot({ path: testInfo.outputPath('driver.png'), fullPage: true });
  await page.locator('.profile-controls label').nth(1).locator('select').selectOption(season);
  await expect(page).toHaveURL(new RegExp(`season=${season}`));
  await page.goBack();
  await expect(page.locator('.profile-controls label').nth(1).locator('select')).toHaveValue('');
  await page.locator('.profile-columns a').filter({ hasText: 'Test Team' }).first().click();
  await expect(page.locator('[data-native-racing="team-profile"]')).toBeVisible();
  await expect(page.locator('.profile-identity h2')).toHaveText('Test Team');
  await expect(page.locator('.profile-stats div').filter({ has: page.locator('dt', { hasText: /^Punkte$/ }) }).locator('dd')).toHaveText('44');
  await expect(page.locator('main iframe')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env.RACEVORA_CAPTURE_UI === '1') await page.screenshot({ path: testInfo.outputPath('team.png'), fullPage: true });
  await page.locator('.profile-section').last().getByRole('link', { name: 'Japan GP' }).click();
  await expect(page.locator('[data-native-racing="race-detail"]')).toBeVisible();
  await expect(page.locator('.profile-table-scroll tbody tr')).toHaveCount(2);
  await expect(page.locator('.profile-fastest').last()).toHaveText('26');
  await expect(page.locator('.profile-table-scroll tbody tr').first()).toContainText('1:00:00.000');
  await expect(page.locator('.profile-track-map')).toBeVisible();
  await expect.poll(() => page.locator('.profile-track-map').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator('main iframe')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env.RACEVORA_CAPTURE_UI === '1') await page.screenshot({ path: testInfo.outputPath('race.png'), fullPage: true });
  await page.locator('.profile-table-scroll tbody a').first().click();
  await expect(page.locator('[data-native-racing="driver-profile"]')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`season=${season}`));
});
test('invalid season or driver never falls back to a different selection', async ({ page }) => {
  for (const path of [`drivers/profile?driver=missing`, `drivers/profile?driver=${driver}&season=missing`, 'teams/profile?team=missing', 'races/detail?round=1&season=missing']) {
    await page.goto(`/racing/${path}&league=rcc&demo=1`);
    await expect(page.locator('.native-profile')).toContainText('Die angeforderte Auswahl');
    await expect(page.locator('.profile-stats')).toHaveCount(0);
    await expect(page.locator('.profile-table-scroll tbody tr')).toHaveCount(0);
  }
});
test('profiles show zero-start states without an invented performance rating', async ({ page, context }) => {
  await context.route('**/rest/v1/race_results?**', (route) => route.fulfill({ json: [] }));
  await context.route('**/rest/v1/races?**', (route) => route.fulfill({ json: [] }));
  await page.goto(`/racing/drivers/profile?league=rcc&demo=1&driver=${driver}`);
  await expect(page.locator('.profile-rating')).toHaveText('— Noch ohne Rating');
  await expect(page.locator('.profile-stats div').first().locator('dd')).toHaveText('0');
});
test('optional race metadata failure preserves results and allows retry', async ({ page, context }) => {
  let fail = true;
  await context.route('**/rest/v1/steward_cases?**', async (route) => fail ? route.fulfill({ status: 403, json: { message: 'Unavailable' } }) : route.fulfill({ json: [{ id: 'case', title: 'Test case', description: '[Fahrer1] Test Driver 1\nTest incident', reported_driver_id: driver, accused_driver_id: driver, status: 'closed', rule_code: 'R1', rule_version: '1' }] }));
  await context.route('**/rest/v1/result_versions?**', (route) => route.fulfill({ json: [{ id: '40000000-0000-4000-8000-000000000001', version_number: 2, status: 'active', change_reason: 'Test correction' }, { id: 'old', version_number: 1, status: 'superseded', change_reason: 'Test initial' }] }));
  await page.goto(`/racing/races/detail?league=rcc&demo=1&round=1&season=${season}`);
  await expect(page.locator('.profile-table-scroll tbody tr')).toHaveCount(2);
  await expect(page.locator('.native-profile [role="alert"]')).toContainText('Steward-Einträge');
  await page.locator('.native-profile summary').click();
  await expect(page.locator('.native-profile details')).toContainText('V2 · Aktuell');
  await expect(page.locator('.native-profile details')).toContainText('V1 · Ersetzt');
  fail = false;
  await page.locator('.native-profile button').click();
  await expect(page.locator('.native-profile')).toContainText('Test incident');
  await expect(page.locator('.native-profile [role="alert"]')).toHaveCount(0);
});
test('core profile failure can be retried', async ({ page, context }) => {
  let fail = true;
  await context.route('**/rest/v1/race_results?**', async (route) => fail ? route.fulfill({ status: 503, json: { message: 'Unavailable' } }) : route.fallback());
  await page.goto(`/racing/drivers/profile?league=rcc&demo=1&driver=${driver}`);
  await expect(page.locator('.native-profile [role="alert"]')).toBeVisible();
  fail = false;
  await page.locator('.native-profile button').click();
  await expect(page.locator('.profile-stats')).toBeVisible();
});
