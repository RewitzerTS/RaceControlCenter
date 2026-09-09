import { expect, test } from '@playwright/test';
import { installPublicFixture, publicRacingFixture as f } from './public-fixture';

test.beforeEach(async ({ context }) => installPublicFixture(context));
test('grid is native, fits the viewport and keeps league-aware profile links', async ({ page }) => {
  await page.goto('/racing/grid?league=rcc&demo=1');
  await expect(page.locator('.native-grid-team li')).toHaveCount(2);
  await expect(page.locator('main iframe')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.native-grid')).not.toContainText('KI-Fahrer');
  await page.locator('.native-grid-seat-heading a').first().click();
  await expect(page).toHaveURL(/\/racing\/drivers\/profile\?league=rcc&driver=/);
  await page.goBack();
  await expect(page.locator('.native-grid-team li')).toHaveCount(2);
});
test('grid retries failed requests without showing stale seats', async ({ page, context }) => {
  let fail = true;
  await context.route('**/rest/v1/drivers?**', async (route) => fail ? route.fulfill({ status: 503, json: { message: 'Unavailable' } }) : route.fallback());
  await page.goto('/racing/grid?league=rcc&demo=1');
  await expect(page.locator('.native-grid [role="alert"]')).toBeVisible();
  fail = false;
  await page.locator('.native-grid button').click();
  await expect(page.locator('.native-grid-team li')).toHaveCount(2);
});

for (const [name, file] of [['Aston Martin', 'aston-martin'], ['Kick Sauber', 'sauber'], ['Mercedes', 'mercedes']]) {
  test(`${name} emblems decode in grid and championship`, async ({ page, context }) => {
    await context.route('**/rest/v1/drivers?**', (route) => route.fulfill({ json: f.drivers.map((driver) => ({ ...driver, league_team: name, car_name: name })) }));
    await context.route('**/rest/v1/race_results?**', (route) => route.fulfill({ json: f.results.map((result) => ({ ...result, car_name_snapshot: name, points_team_name: name })) }));
    for (const path of ['grid', 'standings']) {
      await page.goto(`/racing/${path}?league=rcc&demo=1`);
      const logo = page.locator(`img.standing-car[src$="/${file}.svg"]`).first();
      await expect(logo).toBeAttached();
      await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
  });
}
