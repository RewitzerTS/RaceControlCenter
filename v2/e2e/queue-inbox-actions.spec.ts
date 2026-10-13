import { expect, test, type BrowserContext } from '@playwright/test';
import { installPublicFixture, publicRacingFixture as f } from './public-fixture';

async function signedIn(context: BrowserContext) {
  await installPublicFixture(context);
  const user = { id: '91000000-0000-4000-8000-000000000096', email: 'queue@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { onboarding_complete: true, display_name: 'Test Steward' } };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', aal: 'aal1', exp })).toString('base64url')}.synthetic`;
  await context.addInitScript(({ user, token, exp }) => {
    localStorage.setItem('racevora.locale', 'de');
    for (const ref of ['nfvwarlowjqphytqqtxz', 'znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`, JSON.stringify({ user, access_token: token, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer' }));
  }, { user, token, exp });
  await context.route('https://*.supabase.co/**', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    if (name === 'user') return route.fulfill({ json: user });
    if (name === 'current_app_role') return route.fulfill({ json: 'steward' });
    if (name === 'get_owner_mfa_status') return route.fulfill({ json: { is_owner: false, verified: false } });
    if (name === 'league_members') return route.fulfill({ json: [{ league_id: f.league.id, role: 'steward' }] });
    if (name === 'driver_identities') return route.fulfill({ json: { id: user.id, status: 'active', profile_number: 96 } });
    if (name === 'driver_identity_links') return route.fulfill({ json: [] });
    if (name === 'seasons') return route.fulfill({ json: (route.request().headers().accept || '').includes('vnd.pgrst.object') ? f.season : [f.season] });
    return route.fallback();
  });
}

test('race queue excludes previous seasons, filters before paging, clears stale details and retries', async ({ page, context }, info) => {
  await signedIn(context);
  const races = [f.race, { ...f.race, id: 'italy', round_number: 2, grand_prix_name: 'Italien GP' }, { ...f.race, id: 'archive', season_id: 'old-season', grand_prix_name: 'Großbritannien GP · Historisches Rennen', race_date: '2025-07-01' }, { ...f.race, id: 'empty', round_number: 4, grand_prix_name: 'Leeres Rennen' }];
  const cases = Array.from({ length: 28 }, (_, i) => ({ id: `case-${i}`, race_id: i === 27 ? 'archive' : i === 26 ? f.race.id : 'italy', case_number: `RV-${i}`, title: `Fall ${i}: Berührung nach dem Start`, description: 'Synthetische Testdaten, keine echte Entscheidung.', status: 'closed', created_at: '2026-10-13T12:00:00Z', reported_driver_id: f.drivers[0].id, accused_driver_id: f.drivers[1].id, current_decision_version: null }));
  let fail = false, delay = false;
  let release: (() => void) | undefined;
  await context.route('https://*.supabase.co/rest/v1/**', async route => {
    const url = new URL(route.request().url()), name = url.pathname.split('/').pop();
    if (name === 'races') return route.fulfill({ json: races.filter(race => !url.searchParams.has('season_id') || `eq.${race.season_id}` === url.searchParams.get('season_id')) });
    if (name === 'steward_cases') {
      const filter = url.searchParams.get('race_id')?.slice(3);
      if (fail) return route.fulfill({ status: 503, json: { message: 'Synthetic outage' } });
      expect(url.searchParams.get('select')).toContain('races!inner(season_id)');
      expect(url.searchParams.get('races.season_id')).toBe(`eq.${f.season.id}`);
      const rows = cases.filter(c => (!filter || c.race_id === filter) && races.some(race => race.id === c.race_id && `eq.${race.season_id}` === url.searchParams.get('races.season_id')));
      if (delay && filter === f.race.id) { delay = false; await new Promise<void>(resolve => { release = resolve; }); }
      const start = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 25);
      return route.fulfill({ json: rows.slice(start, start + limit) });
    }
    return route.fallback();
  });
  await page.goto('/stewarding?league=rcc');
  const filter = page.getByLabel('Nach Rennen filtern');
  await expect(page.locator('.case-row')).toHaveCount(25);
  await expect(filter.locator('option[value="archive"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.locator('.case-row')).toHaveCount(2);
  await expect(page.locator('.case-row').filter({ hasText: 'Fall 27:' })).toHaveCount(0);
  await filter.selectOption(f.race.id);
  await expect(page.locator('.case-row')).toHaveCount(1);
  await expect(page.locator('.case-detail h2')).toContainText('Fall 26');
  await filter.selectOption('italy');
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.locator('.case-row')).toHaveCount(1);
  await expect(page.locator('.case-row')).toContainText('Fall 25');
  await filter.selectOption('empty');
  await expect(page.locator('.case-queue')).toContainText('Für dieses Rennen sind keine Fälle vorhanden');
  await expect(page.locator('.case-detail')).toHaveCount(0);
  fail = true;
  await filter.selectOption(f.race.id);
  await expect(page.locator('.case-queue [role="alert"]')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Erneut laden' }).click();
  await expect(page.locator('.case-detail h2')).toContainText('Fall 26');
  await filter.selectOption('italy');
  await expect(page.locator('.case-row')).toHaveCount(25);
  delay = true;
  await filter.selectOption(f.race.id);
  await expect.poll(() => Boolean(release)).toBe(true);
  await filter.selectOption('italy');
  await expect(page.locator('.case-detail h2')).toContainText('Fall 0:');
  release!();
  await expect(filter).toHaveValue('italy');
  await expect(page.locator('.case-detail h2')).toContainText('Fall 0:');
  await filter.selectOption('');
  await expect(page.locator('.case-row')).toHaveCount(25);
  await filter.selectOption(f.race.id);
  await expect(page.locator('.case-detail h2')).toContainText('Fall 26');
  await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: info.outputPath('steward-filter.png'), fullPage: true });
  if (info.project.name === 'desktop') {
    await page.setViewportSize({ width: 1235, height: 884 });
    await page.screenshot({ path: info.outputPath('steward-filter-user.png'), fullPage: true });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('inbox bulk read retries safely, clears the bell, persists and removes its eyebrow', async ({ page, context }, info) => {
  await signedIn(context);
  let unread = 61, attempts = 0;
  const stamp = '2026-10-13T13:00:00Z';
  await context.route('https://*.supabase.co/**', async route => {
    const request = route.request(), name = new URL(request.url()).pathname.split('/').pop();
    if (name === 'user_notifications') {
      if (request.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `*/${unread}`, 'access-control-expose-headers': 'content-range' }, body: '' });
      return route.fulfill({ json: Array.from({ length: 3 }, (_, i) => ({ id: `notice-${i}`, notification_kind: 'system', title_key: 'notification.levelUp.title', body_key: 'notification.levelUp.body', payload: { event_type: 'career.level_up', level: i + 5 }, created_at: '2026-10-13T12:00:00Z', read_at: unread ? null : stamp })) });
    }
    if (name === 'mark_all_notifications_read') {
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 503, json: { message: 'Synthetic failure' } });
      unread = 0;
      return route.fulfill({ json: stamp });
    }
    return route.fallback();
  });
  await page.goto('/notifications?league=rcc');
  await expect(page.getByText('In-App Inbox', { exact: true })).toHaveCount(0);
  const button = page.getByRole('button', { name: 'Alle als gelesen markieren' });
  await expect(button).toBeEnabled();
  await page.screenshot({ path: info.outputPath('notification-actions.png'), fullPage: true });
  if (info.project.name === 'desktop') {
    await page.setViewportSize({ width: 1235, height: 884 });
    await page.screenshot({ path: info.outputPath('notification-actions-user.png'), fullPage: true });
  }
  await button.click();
  await expect(page.getByRole('alert')).toContainText('Bitte erneut versuchen');
  await expect(page.locator('.notification-unread')).toHaveCount(3);
  await button.click();
  await expect(page.getByRole('status')).toContainText('Alle bisherigen Benachrichtigungen');
  await expect(page.locator('.notification-unread')).toHaveCount(0);
  await expect(page.locator('.notification-count')).toHaveCount(0);
  await expect(button).toBeDisabled();
  await page.reload();
  await expect(button).toBeDisabled();
  await expect(page.locator('.notification-unread')).toHaveCount(0);
  expect(attempts).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
