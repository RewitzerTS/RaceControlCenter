import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { installPublicFixture, publicRacingFixture as f, confirmedNameFixture } from './public-fixture';

for (const count of [20, 22]) test(`season graphics export all ${count} drivers in two PNGs`, async ({ context, page }, info) => {
  await installPublicFixture(context);
  await context.addInitScript((multi) => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }: ShareData) => !!files?.length && (multi || files.length === 1) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }: ShareData) => {
      (window as unknown as { graphicShares: unknown[] }).graphicShares ||= [];
      (window as unknown as { graphicShares: unknown[] }).graphicShares.push({ active: navigator.userActivation.isActive, files: files?.map(file => ({ name: file.name, type: file.type, size: file.size })) });
    } });
  }, count === 20);
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
    if (route.request().url().includes('/rpc/get_my_name_settings')) return route.fulfill({ json: confirmedNameFixture });
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
  await page.getByRole('button', { name: 'Dieses Bild teilen', exact: true }).click();
  const shares = await page.evaluate(() => (window as unknown as { graphicShares: { active: boolean; files: { name: string; type: string; size: number }[] }[] }).graphicShares);
  expect(shares[0].active).toBe(true);
  expect(shares[0].files).toHaveLength(1);
  expect(shares[0].files[0].name).toMatch(/-02\.png$/);
  expect(shares[0].files[0].type).toBe('image/png');
  expect(shares[0].files[0].size).toBeGreaterThan(1000);
  if (count === 20) {
    await page.getByRole('button', { name: 'Alle Bilder teilen' }).click();
    expect(await page.evaluate(() => (window as unknown as { graphicShares: { files: unknown[] }[] }).graphicShares[1].files.length)).toBe(2);
  } else {
    await expect(page.getByRole('button', { name: 'Alle Bilder teilen' })).toBeDisabled();
    const singleDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Dieses Bild herunterladen' }).click();
    expect((await singleDownload).suggestedFilename()).toMatch(/-02\.png$/);
  }
  await page.locator('.graphic-share-actions').screenshot({ path: info.outputPath('sharing.png') });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '2 PNGs als ZIP erzeugen und herunterladen' }).click();
  const download = await downloadPromise;
  const bytes = await readFile((await download.path())!);
  expect(bytes.toString('latin1')).toContain('-01.png');
  expect(bytes.toString('latin1')).toContain('-02.png');
  expect(renders[0].p_source_payload.rows).toHaveLength(count);
  expect(renders[0].p_source_payload).not.toHaveProperty('result');
  expect(renders[0].p_source_payload.presentation.theme.primary).toBe('#56a5b8');
  expect(await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let turquoise = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] === 86 && pixels[i + 1] === 165 && pixels[i + 2] === 184 && pixels[i + 3] === 255) turquoise++;
    }
    return turquoise;
  })).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (count === 22) {
    await page.locator('.graphics-preview-panel').screenshot({ path: info.outputPath('standings-page-2.png') });
    const png = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png').split(',')[1]);
    await writeFile(info.outputPath('turquoise-standings.png'), Buffer.from(png, 'base64'));
  }
  if (count === 20) {
    await context.route('https://*.supabase.co/**', async route => {
      const name = new URL(route.request().url()).pathname.split('/').pop();
      if (name === 'current_app_role') return route.fulfill({ json: 'driver' });
      if (name === 'league_members') return route.fulfill({ json: [{ league_id: f.league.id, role: 'driver' }] });
      if (['season_driver_assignments', 'get_league_team_history', 'get_season_championship_roster'].includes(name || '')) return route.fulfill({ json: [] });
      return route.fallback();
    });
    await page.goto('/profile/graphics?league=rcc');
    await page.getByRole('button', { name: 'Teilen', exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as { graphicShares: { files: { name: string }[] }[] }).graphicShares.at(-1)?.files[0].name)).toBe('racevora-race_result-portrait-1.png');
    await page.locator('.graphics-format-list label').filter({ hasText: 'Story · 9:16' }).click();
    await expect(page.getByRole('radio', { name: 'Story · 9:16' })).toBeChecked();
    await page.getByRole('button', { name: 'Teilen', exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as { graphicShares: { files: { name: string }[] }[] }).graphicShares.at(-1)?.files[0].name)).toBe('racevora-race_result-story-1.png');
    await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
    await page.locator('.graphics-format-list label').filter({ hasText: /^1:1$/ }).click();
    await expect(page.locator('.graphic-share-actions')).toContainText('Browser unterstützt das Teilen von Bildern nicht');
    await expect(page.getByRole('button', { name: 'Teilen', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'PNG herunterladen', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.graphics-controls').screenshot({ path: info.outputPath('driver-sharing-fallback.png') });
  }
});
