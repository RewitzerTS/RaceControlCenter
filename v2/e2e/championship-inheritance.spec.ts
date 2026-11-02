import { expect, test, type BrowserContext } from '@playwright/test';
import { installPublicFixture, publicRacingFixture as f, confirmedNameFixture } from './public-fixture';

async function fixture(context: BrowserContext) {
  await installPublicFixture(context);
  const user = { id: '91000000-0000-4000-8000-000000000098', email: 'wm-test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { onboarding_complete: true } };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', aal: 'aal1', exp })).toString('base64url')}.synthetic`;
  await context.addInitScript(({ user, token, exp }) => {
    localStorage.setItem('racevora.locale', 'de');
    for (const ref of ['nfvwarlowjqphytqqtxz', 'znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`, JSON.stringify({ user, access_token: token, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer' }));
  }, { user, token, exp });
  const drivers = Array.from({ length: 20 }, (_, i) => ({ ...f.drivers[0], id: `driver-${i}`, display_name: i === 0 ? 'alpine_wolf' : i === 1 ? 'Fabi241299' : `Driver ${i}`,
    public_name: i === 0 ? 'MuirecoX' : i === 1 ? 'Fabi241299' : `Driver ${i}`, gamertag: i === 0 ? 'alpine_wolf' : `Tag${i}`,
    gamertag_aliases: i === 0 ? ['alpine_wolf', 'MuirecoX'] : [], identity_linked: true, result_count: 0 }));
  const extra = [
    { ...drivers[0], id: 'gasly', display_name: 'Pierre Gasly', public_name: 'Pierre Gasly', gamertag: null, gamertag_aliases: [], identity_linked: false },
    { ...drivers[0], id: 'albon', display_name: 'Alexander Albon', public_name: 'Alexander Albon', gamertag: null, gamertag_aliases: [], identity_linked: false },
    { ...drivers[0], id: 'unused', display_name: 'Robin S', public_name: 'Robin S', gamertag: 'MuirecoX', gamertag_aliases: [], identity_linked: false, is_active: false },
  ];
  const assignments = ['gasly', 'albon'].map((ai_driver_id, i) => ({ ai_driver_id, human_driver_id: drivers[i].id, effective_from_round: 9, effective_to_round: null }));
  const next = { ...f.race, id: 'next-race', grand_prix_name: 'China GP', round_number: 9, status: 'upcoming', current_result_version_id: null };
  let tag = 'Muirecox';
  const saved: any[] = [];
  await context.route('https://*.supabase.co/**', async route => {
    const url = new URL(route.request().url()), name = url.pathname.split('/').pop();
    if (name === 'user') return route.fulfill({ json: user });
    if (name === 'current_app_role') return route.fulfill({ json: 'league_admin' });
    if (name === 'get_my_name_settings') return route.fulfill({ json: confirmedNameFixture });
    if (name === 'get_owner_mfa_status') return route.fulfill({ json: { is_owner: false, verified: false } });
    if (name === 'league_members') return route.fulfill({ json: [{ league_id: f.league.id, role: 'league_admin' }] });
    if (name === 'driver_identities') return route.fulfill({ json: { id: user.id, status: 'active', profile_number: 98 } });
    if (name === 'drivers') return route.fulfill({ json: [...drivers, ...extra] });
    if (name === 'races') return route.fulfill({ json: [f.race, next] });
    if (name === 'race_results') return route.fulfill({ json: [
      { ...f.results[0], driver_id: 'gasly', awarded_points: 6 }, { ...f.results[1], driver_id: 'albon', awarded_points: 0 },
    ] });
    if (name === 'get_season_championship_roster') return route.fulfill({ json: drivers.map(driver => ({ driver_id: driver.id, team_name: 'Test Team', car_name: 'Test Car' })) });
    if (name === 'get_season_championship_ai_assignments') return route.fulfill({ json: assignments });
    if (name === 'season_driver_assignments' || name === 'get_league_team_labels') return route.fulfill({ json: [] });
    if (name === 'get_league_race_admin_workspace') return route.fulfill({ json: { league: f.league, seasons: [f.season], races: [f.race, next], driver_standings: [], team_standings: [] } });
    if (name === 'get_league_driver_admin_workspace') return route.fulfill({ json: { league: f.league, drivers: [...drivers, ...extra], active_season: f.season, ai_assignments: assignments, counts: { total: 23, active: 22, linked: 20 } } });
    if (name === 'get_league_configuration_workspace') return route.fulfill({ json: { league: f.league, rules: {}, faqs: [], audit: [], result_drafts: [] } });
    if (url.pathname.includes('/storage/v1/object/sign/')) return route.fulfill({ json: { signedURL: '/object/sign/synthetic-image?token=test' } });
    if (url.pathname.includes('/storage/v1/object/')) return route.fulfill({ json: { Key: 'synthetic-image' } });
    if (name === 'analyze-race-result-images') return route.fulfill({ json: { rows: [{ driver: tag, position: 1, grid_position: 1, pit_stops: 1, fastest_lap: '1:30.000', race_time: '20:00.000', confidence: .99 }], warnings: [] } });
    if (name === 'create_league_result_draft') { saved.push(route.request().postDataJSON()); return route.fulfill({ json: { id: 'draft' } }); }
    if (url.pathname.includes('/rpc/')) return route.fulfill({ json: null });
    return route.fallback();
  });
  return { saved, setTag: (value: string) => { tag = value; } };
}

test('shows 20 current drivers and Robin inherits Gasly points without duplicate AI rows', async ({ page, context }, info) => {
  await fixture(context);
  await page.goto('/racing/standings?league=rcc');
  const rows = page.locator('#drivers-standings-body tr');
  await expect(rows).toHaveCount(20);
  await expect(rows.first()).toContainText('MuirecoX');
  await expect(rows.first().locator('td').last()).toHaveText('6');
  await expect(page.locator('#drivers-standings-body')).not.toContainText('Pierre Gasly');
  await expect(page.locator('#drivers-standings-body')).not.toContainText('Alexander Albon');
  await expect(page.getByRole('link', { name: 'Fabi241299', exact: true })).toHaveCount(1);
  await page.reload();
  await expect(rows).toHaveCount(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('inherited-standings.png'), fullPage: true });
});

test('both image-import aliases resolve to the confirmed race driver, not the unused duplicate', async ({ page, context }) => {
  const { saved, setTag } = await fixture(context);
  await page.goto('/admin/results/import?league=rcc');
  await page.locator('.result-import-race-row select').selectOption('next-race');
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600; return canvas.toDataURL('image/png').split(',')[1]; });
  await page.locator('input[type="file"][accept*="image/jpeg"]').setInputFiles({ name: 'test-result.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  for (const tag of ['Muirecox', 'alpine_wolf']) {
    setTag(tag);
    await page.getByRole('button', { name: 'Bilder auslesen', exact: true }).click();
    const save = page.getByRole('button', { name: 'Entwurf speichern', exact: true });
    await expect(save).toBeEnabled();
    await expect(page.locator('.result-review-editor')).toContainText(tag);
    await save.click();
    await expect.poll(() => saved.length).toBe(tag === 'Muirecox' ? 1 : 2);
    expect(JSON.stringify(saved.at(-1))).toContain('driver-0');
    expect(JSON.stringify(saved.at(-1))).not.toContain('unused');
  }
});
