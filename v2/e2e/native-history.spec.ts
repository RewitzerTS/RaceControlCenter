import { test, expect, type Page } from '@playwright/test';
import { installPublicFixture, publicRacingFixture as f } from './public-fixture';

test.beforeEach(async ({ context }) => { await installPublicFixture(context); });
async function native(page: Page, kind: string) {
  await expect(page.locator(`[data-native-racing="${kind}"]`)).toBeVisible();
  await expect(page.locator('main iframe')).toHaveCount(0);
  await expect(page.locator('main')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
test('track hub and profile preserve statistics, seasons, local assets and native driver links', async ({ page }, info) => {
  await page.goto('/racing/tracks?league=rcc&demo=1');
  await expect(page.locator('.history-track-grid li')).toHaveCount(1); await native(page, 'tracks');
  const gridWidth = await page.locator('.history-track-grid').evaluate((el) => el.getBoundingClientRect().width);
  const cardWidth = await page.locator('.history-track-grid li').evaluate((el) => el.getBoundingClientRect().width);
  const viewportWidth = page.viewportSize()!.width;
  if (viewportWidth > 900) expect(cardWidth).toBeLessThan(gridWidth / 2);
  else if (viewportWidth <= 600) expect(cardWidth).toBeCloseTo(gridWidth, 0);
  expect(await page.locator('.history-track-thumbnail').evaluate((el) => el.getBoundingClientRect().height)).toBe(120);
  expect(await page.locator('.profile-stats > div').first().evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
  expect(await page.locator('.history-track-thumbnail').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  if (process.env.RACEVORA_CAPTURE_UI === '1') { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: info.outputPath('tracks.png'), fullPage: true }); }
  await page.locator('.history-track-grid a').click(); await native(page, 'track-profile');
  await expect(page.locator('.profile-identity h2')).toHaveText('Japan GP');
  await expect(page.locator('.native-profile')).toContainText('1:31.000');
  await expect(page.locator('.profile-table-scroll').first().locator('tbody tr')).toHaveCount(2);
  if (process.env.RACEVORA_CAPTURE_UI === '1') { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: info.outputPath('track-profile.png'), fullPage: true }); }
  await page.locator('.profile-controls label').last().locator('select').selectOption(f.season.id);
  await expect(page).toHaveURL(new RegExp(`season=${f.season.id}`));
  await page.goBack(); await expect(page.locator('.profile-controls label').last().locator('select')).toHaveValue('');
  await page.locator('.profile-table-scroll').first().getByRole('link', { name: 'Test Driver 1' }).click(); await native(page, 'driver-profile');
});
test('rules show saved content, retain FAQ toggles and recover from a failed read', async ({ context, page }, info) => {
  let fail = true;
  await context.route('**/rest/v1/leagues*', async (route) => {
    const url = new URL(route.request().url()); if (url.searchParams.get('select') !== 'settings') return route.fallback();
    await route.fulfill({ status: fail ? 503 : 200, json: fail ? { message: 'Test failure' } : { settings: { rules: { ai_strength: '80', fastest_lap_point: 'Ja' }, faqs: [{ question: 'Wie geht der Test?', answer: 'Mit einer gespeicherten Antwort. <script>test</script>' }] } } });
  });
  await page.goto('/racing/rules?league=rcc&demo=1'); await expect(page.locator('.native-profile [role="alert"]')).toContainText('Liga-Regeln');
  fail = false; await page.locator('.native-profile').getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.locator('.history-facts')).toContainText('80'); await native(page, 'rules');
  expect(await page.locator('.history-facts > div').first().evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
  await expect(page.locator('.history-faq details')).not.toHaveAttribute('open', '');
  await page.getByText('Wie geht der Test?', { exact: true }).click(); await expect(page.locator('.history-faq p')).toBeVisible();
  await expect(page.locator('.history-faq script')).toHaveCount(0); await expect(page.locator('.history-faq p')).toContainText('<script>test</script>');
  if (process.env.RACEVORA_CAPTURE_UI === '1') { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: info.outputPath('rules.png'), fullPage: true }); }
});
test('record boards preserve points and link to native team views', async ({ page }, info) => {
  await page.goto('/racing/history?view=records&league=rcc&demo=1'); await expect(page.locator('.history-record-row').first()).toContainText('Test Driver 1'); await native(page, 'records');
  await expect(page.locator('.profile-columns').last()).toContainText('44');
  await expect(page.locator('.section-view-switcher a.active')).toHaveText('Rekorde');
  if (process.env.RACEVORA_CAPTURE_UI === '1') { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: info.outputPath('records.png'), fullPage: true }); }
  await page.locator('.history-record-row a').filter({ hasText: /^Test Team$/ }).first().click(); await native(page, 'team-profile');
});
test('archive retains full official tables, FL and race navigation without stale result versions', async ({ context, page }, info) => {
  await context.route('**/rest/v1/seasons*', async (route) => route.fulfill({ json: [{ ...f.season, is_active: false, archived_at: '2026-09-01', game_label: 'F1 25' }] }));
  await context.route('**/rest/v1/race_results*', async (route) => route.fulfill({ json: [...f.results, { ...f.results[0], id: 'stale', result_version_id: 'old', awarded_points: 999 }] }));
  await page.goto('/racing/history?view=seasons&league=rcc&demo=1'); await expect(page.locator('.history-archive-race')).toHaveCount(1); await native(page, 'archive');
  await expect(page.locator('.profile-table-scroll tbody tr')).toHaveCount(2); await expect(page.locator('.profile-table-scroll')).not.toContainText('999');
  await expect(page.locator('.profile-fastest').last()).toHaveText('26'); await expect(page.locator('.native-profile')).toContainText('F1 25');
  if (process.env.RACEVORA_CAPTURE_UI === '1') { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: info.outputPath('archive.png'), fullPage: true }); }
  await page.locator('.history-archive-race > p a').click(); await native(page, 'race-detail'); await expect(page).toHaveURL(new RegExp(`season=${f.season.id}`));
});
test('hall of fame keeps the rcc archive and accessible celebration', async ({ page }, info) => {
  await page.goto('/racing/history?view=hall-of-fame&league=rcc&demo=1'); await expect(page.locator('.history-champions').first()).toContainText('Richard'); await native(page, 'hall-of-fame');
  await expect(page.locator('.native-profile')).toContainText('Saison 13');
  expect(await page.locator('.history-champions img').first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  if (process.env.RACEVORA_CAPTURE_UI === '1') { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: info.outputPath('hall.png'), fullPage: true }); }
  await page.getByRole('button', { name: 'Champions feiern' }).click(); await expect(page.locator('.history-celebration')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await expect(page.locator('.history-celebration')).toBeHidden();
});
test('invalid and empty history selections do not show unrelated results', async ({ page }) => {
  for (const path of ['tracks?season=missing', 'tracks/profile?track=missing', 'history?view=records&season=missing']) {
    await page.goto(`/racing/${path}&league=rcc&demo=1`); await expect(page.locator('.native-profile')).toContainText('Die angeforderte Auswahl'); await expect(page.locator('.profile-table-scroll tbody tr')).toHaveCount(0);
  }
  await page.goto('/racing/history?view=seasons&league=rcc&demo=1'); await expect(page.locator('.native-profile')).toContainText('Noch keine abgeschlossene Saison');
});
test('every Racing route stays in one shell, preserves league navigation and old URLs redirect', async ({ page }) => {
  const routes = [['calendar', 'calendar'], ['results', 'results'], ['standings', 'standings'], ['grid', 'grid'], ['tracks', 'tracks'], ['rules', 'rules'], ['history?view=records', 'records']];
  for (const [path] of routes) {
    await page.goto(`/racing/${path}${path.includes('?') ? '&' : '?'}league=rcc&demo=1`);
    await expect(page.locator('[data-native-racing]')).toHaveCount(1); await expect(page.locator('main iframe')).toHaveCount(0);
    const links = await page.locator('main > nav.section-navigation a').evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')));
    expect(links.every((href) => href?.includes('league=rcc'))).toBe(true);
  }
  await page.goto('/strecken.html?league=rcc'); await expect(page).toHaveURL(/\/racing\/tracks\?league=rcc/); await expect(page.locator('main iframe')).toHaveCount(0);
});
test('failed track data can be retried without stale content', async ({ context, page }) => {
  let fail = true; await context.route('**/rest/v1/race_results*', async (route) => fail ? route.fulfill({ status: 503, json: { message: 'Unavailable' } }) : route.fallback());
  await page.goto('/racing/tracks?league=rcc&demo=1'); await expect(page.locator('.native-profile [role="alert"]')).toBeVisible();
  fail = false; await page.locator('.native-profile').getByRole('button', { name: 'Erneut versuchen' }).click(); await expect(page.locator('.history-track-grid li')).toHaveCount(1);
});
