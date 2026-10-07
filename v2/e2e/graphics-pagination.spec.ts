import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installPublicFixture, publicRacingFixture as f } from './public-fixture';

for (const count of [20, 22]) test(`season graphics export all ${count} drivers in two PNGs`, async ({ context, page }, info) => {
  await installPublicFixture(context);
  const id = '91000000-0000-4000-8000-000000000099';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = { id, email: 'graphics@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Graphics test', onboarding_complete: true }, created_at: '2026-01-01' };
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', aal: 'aal1', exp })).toString('base64url')}.synthetic-not-a-real-token`;
  await context.addInitScript((value) => {
    localStorage.setItem('racevora.locale', 'de');
    for (const ref of ['nfvwarlowjqphytqqtxz', 'znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`, JSON.stringify(value));
  }, { access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user });
  const result = { id: f.race.current_result_version_id, version: 1, race_id: f.race.id, race_name: 'USA GP', circuit: 'Austin', country_code: 'US', race_date: '2026-10-05', round: 2, rows: [] };
  const workspace = { league: f.league, season: { id: f.season.id, name: 'Season 15' }, latest_result: result, driver_standings: Array.from({ length: count }, (_, i) => ({ position: i + 1, driver: `Pilot ${i + 1}`, points: count - i, wins: 0 })), team_standings: Array.from({ length: count / 2 }, (_, i) => ({ position: i + 1, team: `Team ${i + 1}`, points: count - i, wins: 0 })), latest_achievement: null, recent_renders: [] };
  const renders: any[] = [];
  await context.route('https://*.supabase.co/**', async (route) => {
    const url = new URL(route.request().url()), name = url.pathname.split('/').pop();
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
    if (name === 'get_owner_mfa_status') return route.fulfill({ json: { is_owner: false, verified: false } });
    if (name === 'current_app_role') return route.fulfill({ json: 'league_admin' });
    if (name === 'league_members') return route.fulfill({ json: [{ league_id: f.league.id, role: 'admin' }] });
    if (name === 'get_social_graphics_workspace') return route.fulfill({ json: workspace });
    if (name === 'get_social_graphics_driver_labels') return route.fulfill({ json: [] });
    if (name === 'get_social_graphics_result') return route.fulfill({ json: result });
    if (name === 'record_social_graphic_render') { renders.push(route.request().postDataJSON()); return route.fulfill({ json: 'recorded' }); }
    if (name === 'driver_identities') return route.fulfill({ json: null });
    if (url.pathname.includes('/rpc/')) return route.fulfill({ json: null });
    return route.fallback();
  });
  await page.goto('/admin/graphics?league=rcc');
  await page.locator('.graphics-choice-list label').filter({ hasText: /^Fahrerwertung$/ }).click();
  await expect(page.getByRole('radio', { name: 'Fahrerwertung', exact: true })).toBeChecked();
  await expect(page.locator('.graphics-provenance')).toContainText('Season 15');
  await expect(page.locator('.graphics-provenance')).not.toContainText('USA GP');
  await expect(page.locator('.graphics-page-navigation')).toContainText('Teil 1 von 2');
  await page.locator('.graphics-page-navigation button').last().click();
  await expect(page.locator('.graphics-page-navigation')).toContainText('Teil 2 von 2');
  await expect(page.getByRole('img', { name: /Fahrerwertung/ })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '2 PNGs als ZIP erzeugen und herunterladen' }).click();
  const download = await downloadPromise;
  const bytes = await readFile((await download.path())!);
  expect(bytes.toString('latin1')).toContain('-01.png');
  expect(bytes.toString('latin1')).toContain('-02.png');
  expect(renders[0].p_source_payload.rows).toHaveLength(count);
  expect(renders[0].p_source_payload).not.toHaveProperty('result');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (count === 22) await page.locator('.graphics-preview-panel').screenshot({ path: info.outputPath('standings-page-2.png') });
});
