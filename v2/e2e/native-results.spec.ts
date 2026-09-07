import { expect, test } from '@playwright/test';
import { installPublicFixture } from './public-fixture';

test.beforeEach(async ({ context }) => { await installPublicFixture(context); });
test.afterEach(async ({ page }, testInfo) => {
  if (process.env.RACEVORA_CAPTURE_UI === '1') {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: testInfo.outputPath('verified.png'), fullPage: true });
  }
});

test('native results preserve published points, FL and BOT distinction without embedded documents', async ({ page, context }) => {
  await context.route('**/rest/v1/race_results?**', async (route) => {
    const base = { race_id: '30000000-0000-4000-8000-000000000001', result_version_id: '40000000-0000-4000-8000-000000000001' };
    await route.fulfill({ json: [
      { ...base, id: 'r1', driver_id: '50000000-0000-4000-8000-000000000001', awarded_points: 24, fastest_lap_time_ms: 80000, participation_status: 'HUMAN' },
      { ...base, id: 'r2', driver_id: '50000000-0000-4000-8000-000000000002', awarded_points: 18, fastest_lap_time_ms: 81000, participation_status: 'BOT' },
      { ...base, id: 'old', result_version_id: 'old-version', driver_id: '50000000-0000-4000-8000-000000000001', awarded_points: 999, participation_status: 'BOT' },
    ] });
  });
  const embedded: string[] = [];
  page.on('request', (request) => { if (request.isNavigationRequest() && request.url().includes('/ergebnisse')) embedded.push(request.url()); });
  await page.goto('/racing/results?league=rcc&demo=1');
  await expect(page.locator('[data-native-racing="results"]')).toBeVisible();
  await expect(page.locator('main iframe')).toHaveCount(0);
  const first = page.locator('.results-matrix-table tbody tr').first();
  await expect(first.locator('.results-total-cell')).toHaveText('24');
  await expect(first.locator('[data-result-marker="fl"]')).toHaveCount(1);
  await expect(first.locator('[data-result-marker="bot"]')).toHaveCount(0);
  await expect(page.locator('.results-matrix-table [data-result-marker="bot"]')).toHaveCount(1);
  expect(embedded).toEqual([]);
  await first.locator('.sticky-driver a').click();
  await expect(page).toHaveURL(/racing\/drivers\/profile\?league=rcc&driver=/);
  await page.goBack();
  await expect(first.locator('.results-total-cell')).toHaveText('24');
  await page.locator('.results-race-header a').click();
  await expect(page).toHaveURL(/racing\/races\/detail\?league=rcc&season=.*&round=1/);
});

test('driver column stays fixed while points scroll, including 320px and long names', async ({ page, context }) => {
  await context.route('**/rest/v1/drivers?**', async (route) => route.fulfill({ json: [{ id: '50000000-0000-4000-8000-000000000001', display_name: 'Ein außergewöhnlich langer Fahrername mit vielen Wörtern', gamertag: 'UnunterbrochenerSehrLangerGamertag1234567890', is_active: true }] }));
  await context.route('**/rest/v1/races?**', async (route) => route.fulfill({ json: Array.from({ length: 24 }, (_, index) => ({ id: `race-${index}`, season_id: 'season', round_number: index + 1, grand_prix_name: `Grand Prix ${index + 1}`, country_code: 'DE', status: 'completed', current_result_version_id: `version-${index}` })) }));
  await context.route('**/rest/v1/race_results?**', async (route) => route.fulfill({ json: Array.from({ length: 24 }, (_, index) => ({ id: `result-${index}`, race_id: `race-${index}`, result_version_id: `version-${index}`, driver_id: '50000000-0000-4000-8000-000000000001', awarded_points: 25, participation_status: 'HUMAN' })) }));
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/racing/results?league=rcc&demo=1');
  const wrap = page.locator('#results-matrix-wrap');
  const driver = wrap.locator('tbody .sticky-driver').first();
  await expect(driver).toBeVisible();
  const before = await driver.boundingBox();
  const cell = wrap.locator('tbody td').first();
  const cellBefore = await cell.boundingBox();
  await wrap.evaluate((element) => { element.scrollLeft = 240; });
  const after = await driver.boundingBox();
  const cellAfter = await cell.boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(2);
  expect(cellBefore!.x - cellAfter!.x).toBeGreaterThan(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(wrap.locator('.results-total-cell').first()).toHaveText('600');
});

test('comparison filters both accessible chart tables and preserves leader gaps', async ({ page }) => {
  await page.goto('/racing/results?league=rcc&demo=1');
  await expect(page.locator('#results-trend-chart')).toBeVisible();
  await expect(page.locator('[data-chart-ready="true"]')).toHaveCount(2);
  await expect(page.locator('[data-results-focus-mode="own"]')).toBeDisabled();
  await page.locator('[data-results-focus-mode="compare"]').click();
  const selects = page.locator('.results-compare select');
  await expect(selects).toHaveCount(2);
  await selects.nth(1).selectOption('');
  await page.locator('.results-values summary').first().click();
  await expect(page.locator('.results-values').first().locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('.results-values').first().locator('tbody td')).toHaveText('26');
  await page.locator('.results-values summary').nth(1).click();
  await expect(page.locator('.results-values').nth(1).locator('tbody td')).toHaveText('0');
  await selects.nth(0).selectOption('50000000-0000-4000-8000-000000000002');
  await expect(page.locator('.results-values').nth(1).locator('tbody td')).toHaveText('-8');
});

test('empty season renders a complete state without charts or other league data', async ({ page, context }) => {
  await context.route('**/rest/v1/seasons?**', async (route) => route.fulfill({ json: null }));
  await page.goto('/racing/results?league=rcc&demo=1');
  await expect(page.getByRole('heading', { name: 'Keine aktive Saison' })).toBeVisible();
  await expect(page.locator('.results-matrix-table')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('main iframe')).toHaveCount(0);
});
