import { expect, test } from '@playwright/test';
import { installPublicFixture } from './public-fixture';

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
