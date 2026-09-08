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

test('security disclosure contact is served as text, not the SPA', async ({ request }) => {
  const response = await request.get('/.well-known/security.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/plain');
  const body = await response.text();
  expect(body).toContain('Contact: mailto:support@racevora.com');
  expect(body).toContain('Canonical: https://racevora.com/.well-known/security.txt');
  expect(body).not.toMatch(/<html/i);
});

test('accessible brand and keyboard-operated mobile navigation', async ({ page }, testInfo) => {
  await page.goto('/racing/calendar?league=rcc&demo=1');
  await expect(page.locator('[data-native-racing="calendar"]')).toBeVisible();
  await expect(page.locator('main iframe')).toHaveCount(0);
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
    await expect(page.locator('main iframe')).toHaveCount(0);
    const title = page.locator('#calendar-title');
    await expect(title).toBeVisible();
    const size = await title.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = range.getBoundingClientRect();
      return { left: rect.left, right: rect.right, viewport: window.innerWidth };
    });
    expect(size.left).toBeGreaterThanOrEqual(0);
    expect(size.right).toBeLessThanOrEqual(size.viewport);
    const mapImage = page.locator('.native-calendar .track-map-button img').first();
    await mapImage.scrollIntoViewIfNeeded();
    await expect.poll(() => mapImage.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await title.scrollIntoViewIfNeeded();
  }
});

test('anonymous results render without requesting the private season roster', async ({ page }) => {
  const privateRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/season_driver_assignments')) privateRequests.push(request.url());
  });
  await page.goto('/racing/results?league=rcc&demo=1');
  await expect(page.locator('main iframe')).toHaveCount(0);
  const frame = page;
  await expect(frame.locator('.results-matrix-table tbody tr').first()).toBeVisible();
  await expect(frame.locator('[data-results-retry]')).toHaveCount(0);
  expect(privateRequests).toEqual([]);
});

test('mobile standings expose position, driver and points before optional statistics', async ({ page }, testInfo) => {
  await page.goto('/racing/standings?league=rcc&demo=1');
  await expect(page.locator('main iframe')).toHaveCount(0);
  const frame = page;
  const table = frame.locator('.standings-table');
  await expect(frame.locator('#drivers-standings-body tr').first().locator('td')).toHaveCount(9);
  if (testInfo.project.name === 'mobile') {
    const row = frame.locator('#drivers-standings-body tr').first();
    await expect(row.locator('td').nth(2)).toBeVisible();
    await expect(row.locator('td').nth(8)).toBeVisible();
    await expect(row.locator('td').nth(3)).toBeHidden();
    const size = await table.evaluate((element) => ({ width: element.getBoundingClientRect().width, available: element.parentElement!.clientWidth }));
    expect(size.width).toBeLessThanOrEqual(size.available + 1);
    const toggle = frame.locator('.standings-detail-toggle');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(row.locator('td').nth(3)).toBeVisible();
    await toggle.click();
    await expect(row.locator('td').nth(3)).toBeHidden();
  } else {
    await expect(frame.locator('.standings-detail-toggle')).toBeHidden();
  }
});

test('track map and race detail are independent actions', async ({ page }) => {
  await page.goto('/racing/calendar?league=rcc&demo=1');
  const card = page.locator('.native-calendar .race-card').first();
  await expect(card.locator('.race-detail-link')).toBeVisible();
  await expect(card.locator('a button')).toHaveCount(0);
  const map = card.locator('[data-trackmap-open]');
  await expect(map).toBeVisible();
  await map.click();
  await expect(page.locator('.integrated-track-map')).toBeVisible();
  await expect.poll(() => page.locator('.integrated-track-map img').evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page).toHaveURL(/racing\/calendar/);
  await page.locator('.integrated-track-map button').click();
  await expect(map).toBeFocused();
  await card.locator('.race-detail-link').click();
  await expect(page).toHaveURL(/racing\/races\/detail/);
});

test('landing loads a bounded frame window and no hidden desktop video', async ({ page }, testInfo) => {
  const frames = new Set<string>();
  const videos = new Set<string>();
  page.on('request', (request) => {
    if (/\/frames\/frame-\d+\.webp/.test(request.url())) frames.add(request.url());
    if (/racevora-master-mobile\.mp4/.test(request.url())) videos.add(request.url());
  });
  await page.goto('/');
  await expect(page.locator('.cinematic-story')).toBeVisible();
  await page.waitForTimeout(2000); // Observe delayed preloading, not just DOM readiness.
  if (testInfo.project.name === 'desktop') {
    expect(frames.size).toBeLessThanOrEqual(9);
    expect(videos.size).toBe(0);
    await page.locator('.cinematic-story').evaluate((element) => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY + (element.clientHeight - window.innerHeight) / 2, behavior: 'instant' }));
    await expect.poll(() => frames.size).toBeGreaterThan(5);
    expect(frames.size).toBeLessThan(30);
  } else {
    expect(frames.size).toBe(0);
    expect(videos.size).toBe(1);
  }
});

test('failed results finish loading and can be retried', async ({ page, context }) => {
  let fail = true;
  await context.route('**/rest/v1/race_results?**', async (route) => fail
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary test failure' }) })
    : route.fallback());
  await page.goto('/racing/results?league=rcc&demo=1');
  await expect(page.locator('main iframe')).toHaveCount(0);
  const frame = page;
  const retry = frame.locator('[data-results-retry]');
  await expect(retry).toBeVisible();
  await expect(frame.locator('.results-chart-panel').first()).toBeHidden();
  fail = false;
  await retry.click();
  await expect(frame.locator('.results-matrix-table tbody tr').first()).toBeVisible();
});
