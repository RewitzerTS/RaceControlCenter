import { expect, test } from '@playwright/test';
import { installPublicFixture } from './public-fixture';

test.beforeEach(async ({ context }) => { await installPublicFixture(context); });

test('native calendar has one page, no old document request, and working back navigation', async ({ page }, info) => {
  const oldDocuments: string[] = [];
  page.on('request', (request) => { if (request.resourceType() === 'document' && /\/kalender(?:\.html)?(?:\?|$)/.test(request.url())) oldDocuments.push(request.url()); });
  await page.goto('/racing/calendar?league=rcc&demo=1');
  await expect(page.locator('.native-calendar .race-card')).toBeVisible();
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('iframe')).toHaveCount(0);
  const map = page.locator('.native-calendar [data-trackmap-open]');
  const metadata = await page.locator('.native-calendar .race-meta:visible').boundingBox();
  const graphic = await map.boundingBox();
  if (page.viewportSize()!.width > 480) expect(graphic!.x).toBeGreaterThanOrEqual(metadata!.x + metadata!.width);
  else expect(graphic!.y).toBeGreaterThanOrEqual(metadata!.y + metadata!.height);
  expect(await map.evaluate((el) => getComputedStyle(el).paddingTop)).toBe('4px');
  if (process.env.RACEVORA_CAPTURE_UI === '1') await page.screenshot({ path: info.outputPath('calendar.png'), fullPage: true });
  await map.click();
  await page.keyboard.press('Escape');
  await expect(map).toBeFocused();
  await page.locator('.native-calendar .race-detail-link').click();
  await expect(page).toHaveURL(/racing\/races\/detail.*season=/);
  await page.goBack();
  await expect(page.locator('.native-calendar .race-card')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(oldDocuments).toEqual([]);
});

test('calendar failure can be retried while archive remains usable', async ({ page, context }) => {
  let fail = true;
  await context.route('**/rest/v1/races?**', (route) => fail ? route.fulfill({ status: 403, json: { message: 'Synthetic calendar error' } }) : route.fallback());
  await page.goto('/racing/calendar?league=rcc&demo=1');
  await expect(page.locator('#calendar-upcoming [role="alert"]')).toContainText('Die Rennen konnten nicht geladen werden.');
  await page.getByRole('button', { name: 'Archiv', exact: true }).click();
  await expect(page.locator('#calendar-archive')).toBeVisible();
  await page.getByRole('button', { name: 'Nächste Rennen', exact: true }).click();
  fail = false;
  await page.locator('#calendar-upcoming').getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.locator('#calendar-completed .race-card')).toBeVisible();
  await expect(page.locator('.native-calendar [role="alert"]')).toHaveCount(0);
});

test('archive selection is restored and uses the app route with league and season', async ({ page, context }) => {
  await context.route('**/rest/v1/seasons?**', (route) => new URL(route.request().url()).searchParams.get('is_active') === 'eq.false'
    ? route.fulfill({ json: [{ id: 'archive-season-2025', name: 'QA Archive Season', game_key: 'f1_25', game_label: 'F1 25', is_active: false, archived_at: '2025-12-01T00:00:00Z' }] }) : route.fallback());
  await page.goto('/racing/calendar?league=rcc&demo=1');
  await page.getByRole('button', { name: 'Archiv', exact: true }).click();
  const select = page.locator('#archive-season-select');
  await expect(select).toBeVisible();
  await select.selectOption('archive-season-2025');
  await expect(page.locator('#calendar-archive [role="status"]')).toContainText('QA Archive Season');
  await page.reload();
  await expect(select).toHaveValue('archive-season-2025');
  await page.getByRole('button', { name: 'Archiv öffnen', exact: true }).click();
  await expect(page).toHaveURL(/\/racing\/history\?league=rcc&view=seasons&season=archive-season-2025/);
});

test('an empty season does not show another seasons races and tolerates unavailable session storage', async ({ page, context }) => {
  await context.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }); });
  let raceReads = 0;
  page.on('request', (request) => { if (request.url().includes('/rest/v1/races?')) raceReads += 1; });
  await context.route('**/rest/v1/seasons?**', (route) => route.fulfill({ json: new URL(route.request().url()).searchParams.get('is_active') === 'eq.false' ? [] : null }));
  await page.goto('/racing/calendar?league=rcc&demo=1');
  await expect(page.locator('#calendar-upcoming')).toContainText('Keine kommenden Rennen vorhanden.');
  await expect(page.locator('.native-calendar .race-card')).toHaveCount(0);
  expect(raceReads).toBe(0);
  await page.getByRole('button', { name: 'Archiv', exact: true }).click();
  await expect(page.locator('#calendar-archive')).toContainText('Sobald eine Saison abgeschlossen ist');
});

test('a deep-linked race is selected and long names do not create horizontal page scrolling', async ({ page, context }, testInfo) => {
  await context.route('**/rest/v1/races?**', (route) => route.fulfill({ json: [{ id: 'long-name-race', season_id: '20000000-0000-4000-8000-000000000001', round_number: 22, grand_prix_name: 'Ein-sehr-langer-Rennname-mit-mehr-als-neunzig-Zeichen-für-die-Prüfung-auf-einem-kleinen-Handybildschirm', circuit_name: 'Suzuka International Racing Course', race_date: '2026-08-01', race_time: '20:00', status: 'completed', weather: 'Dynamisch' }] }));
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/racing/calendar?league=rcc&demo=1&round=22');
  await expect(page.locator('#calendar-completed .race-card')).toBeVisible();
  await expect(page.locator('.calendar-toggle[aria-pressed="true"]')).toContainText('Gefahrene Rennen');
  const size = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(size.content).toBeLessThanOrEqual(size.viewport);
});
