import { expect, test } from '@playwright/test';
import { installPublicFixture } from './public-fixture';

// Browser tests use isolated synthetic HTTP fixtures by default. An explicit
// live read-only mode verifies the public demo. Authenticated business journeys
// remain a separate suite.
test.beforeEach(async ({ context }) => {
  await installPublicFixture(context);
});

test.afterEach(async ({ page }, testInfo) => {
  if (process.env.RACEVORA_CAPTURE_UI === '1') await page.screenshot({ path: testInfo.outputPath('verified.png') });
});

test('accessible brand and keyboard-operated mobile navigation', async ({ page }, testInfo) => {
  await page.goto('/racing/calendar?league=rcc&demo=1');
  await expect(page.locator('main iframe')).toBeVisible();
  await expect(page.locator('a.brand')).toHaveAccessibleName('RaceVora · Home');
  if (testInfo.project.name === 'mobile') {
    const more = page.locator('#mobile-more-toggle');
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await more.focus();
    await page.keyboard.press('Escape');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(more).toBeFocused();
  } else {
    const label = page.locator('.driver-navigation .nav-item > span').first();
    await expect(label).toBeVisible();
    await expect(label).toHaveCSS('position', 'static');
  }
});

test('calendar title stays within the screen down to 320px', async ({ page }, testInfo) => {
  const widths = testInfo.project.name === 'mobile' ? [390, 320] : [1280];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/racing/calendar?league=rcc&demo=1');
    await expect(page.locator('main iframe')).toBeVisible();
    const title = page.frameLocator('main iframe').locator('h1').first();
    await expect(title).toBeVisible();
    const size = await title.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = range.getBoundingClientRect();
      return { left: rect.left, right: rect.right, viewport: window.innerWidth };
    });
    expect(size.left).toBeGreaterThanOrEqual(0);
    expect(size.right).toBeLessThanOrEqual(size.viewport);
  }
});

test('anonymous results render without requesting the private season roster', async ({ page }) => {
  const privateRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/season_driver_assignments')) privateRequests.push(request.url());
  });
  await page.goto('/racing/results?league=rcc&demo=1');
  await expect(page.locator('main iframe')).toBeVisible();
  const frame = page.frameLocator('main iframe');
  await expect(frame.locator('.results-matrix-table tbody tr').first()).toBeVisible();
  await expect(frame.locator('[data-results-retry]')).toHaveCount(0);
  expect(privateRequests).toEqual([]);
});

test('failed results finish loading and can be retried', async ({ page, context }) => {
  let fail = true;
  await context.route('**/rest/v1/race_results?**', async (route) => fail
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary test failure' }) })
    : route.fallback());
  await page.goto('/racing/results?league=rcc&demo=1');
  await expect(page.locator('main iframe')).toBeVisible();
  const frame = page.frameLocator('main iframe');
  const retry = frame.locator('[data-results-retry]');
  await expect(retry).toBeVisible();
  await expect(frame.locator('.results-chart-panel').first()).toBeHidden();
  fail = false;
  await retry.click();
  await expect(frame.locator('.results-matrix-table tbody tr').first()).toBeVisible();
});
