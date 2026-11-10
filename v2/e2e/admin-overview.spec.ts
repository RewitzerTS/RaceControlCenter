import { expect, test, type BrowserContext } from '@playwright/test';
import { installPublicFixture, publicRacingFixture as f, confirmedNameFixture } from './public-fixture';

async function fixture(context: BrowserContext, options: { complete?: boolean; failCount?: boolean; oldDraft?: boolean } = {}) {
  await installPublicFixture(context);
  const user = { id: '91000000-0000-4000-8000-000000000071', email: 'admin-overview@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { display_name: 'Test Admin', onboarding_complete: true } };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', aal: 'aal1', exp })).toString('base64url')}.synthetic`;
  await context.addInitScript(({ user, token, exp }) => {
    localStorage.setItem('racevora.locale', 'de');
    for (const ref of ['nfvwarlowjqphytqqtxz', 'znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`, JSON.stringify({ user, access_token: token, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer' }));
  }, { user, token, exp });
  const nextId = '30000000-0000-4000-8000-000000000002';
  const races = [{ ...f.race, result_status: 'active', result_count: 20 }, { ...f.race, id: nextId, round_number: 2, grand_prix_name: 'China GP', result_status: options.complete ? 'active' : null, current_result_version_id: null, result_count: options.complete ? 20 : 0 }];
  const reads: string[] = [];
  await context.route('https://*.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), name = url.pathname.split('/').pop();
    reads.push(url.pathname + url.search);
    if (name === 'user') return route.fulfill({ json: user });
    if (name === 'current_app_role') return route.fulfill({ json: 'league_admin' });
    if (name === 'get_my_name_settings') return route.fulfill({ json: confirmedNameFixture });
    if (name === 'get_owner_mfa_status') return route.fulfill({ json: { is_owner: false, verified: false } });
    if (name === 'league_members') return route.fulfill({ json: [{ league_id: f.league.id, role: 'league_admin' }] });
    if (name === 'driver_identities') return route.fulfill({ json: { id: user.id, status: 'active', profile_number: 71 } });
    if (name === 'get_league_admin_workspace') return route.fulfill({ json: { league: f.league, counts: { open_steward_cases: 9 }, recent_audit: [] } });
    if (name === 'get_current_league_join_code') return route.fulfill({ json: '12345' });
    if (name === 'get_league_race_admin_workspace') return route.fulfill({ json: { league: f.league, seasons: [f.season], races, driver_standings: [], team_standings: [] } });
    if (name === 'get_league_driver_admin_workspace') return route.fulfill({ json: { league: f.league, drivers: f.drivers, counts: { total: 2, active: 2, linked: 2 } } });
    if (name === 'get_season_setup_workspace') return route.fulfill({ json: { league: f.league, games: [], active_season: { ...f.season, calendar: races.map(r => ({ date: r.race_date, time: '20:00', track_key: 'japan', weather: 'dynamic', has_sprint: false })) } } });
    if (name === 'get_league_member_admin_workspace') return route.fulfill({ json: { league: f.league, members: [], join_requests: [] } });
    if (name === 'get_league_configuration_workspace') return route.fulfill({ json: { league: f.league, rules: {}, faqs: [], audit: [], result_drafts: options.oldDraft ? [{ id: 'old', race_id: 'old-race', status: 'draft' }] : [] } });
    if (name === 'get_league_team_manager') return route.fulfill({ json: { mode: 'current', season: f.season, view_round: 2, revision: 'test', races: [], profiles: [], teams: [] } });
    if (request.method() === 'HEAD' && ['races', 'steward_cases'].includes(name ?? '')) {
      if (options.failCount) return route.fulfill({ status: 503 });
      return route.fulfill({ status: 200, headers: { 'content-range': `*/${name === 'races' ? 2 : 0}`, 'access-control-expose-headers': 'content-range' }, body: '' });
    }
    if (name === 'races') return route.fulfill({ json: races });
    if (url.pathname.includes('/rpc/')) return route.fulfill({ json: null });
    return route.fallback();
  });
  return { reads, nextId, races };
}

test('reverse grid shows every seat, switches source and clears stale rows on errors', async ({ page, context }, info) => {
  await fixture(context);
  const drivers = Array.from({ length: 22 }, (_, i) => ({ id: String(i), display_name: `Driver ${String(i).padStart(2, '0')}`, gamertag: `Tag_${i}`, is_active: true, league_team: '', car_name: 'Car' }));
  let fail = false;
  await context.route('**/rpc/get_reverse_grid_workspace', route => {
    if (fail) return route.fulfill({ status: 409, json: { message: 'PREVIEW_DRAFT_STALE' } });
    const drafts = route.request().postDataJSON().p_include_drafts;
    return route.fulfill({ json: { generatedAt: new Date().toISOString(),
      data: { season: f.season, drivers, assignments: [], results: [], races: [], currentRoster: drivers.map(d => ({ driver_id: d.id, team_name: null, car_name: 'Car' })) },
      seats: drivers.map(d => ({ driverId: d.id, aiName: `AI ${d.id}`, gamertag: d.gamertag, isAi: false })), drafts: [], sourceRequested: drafts } });
  });
  await page.goto('/admin/reverse-grid');
  await expect(page.locator('main h1')).toHaveText('Reversegrid-Aufstellung');
  await expect(page.locator('.reverse-grid-table tbody tr')).toHaveCount(22);
  await expect(page.locator('.reverse-grid-table tbody tr').first()).toContainText('Tag_21');
  await expect(page.locator('.reverse-grid-table tbody tr').last()).toContainText('Tag_0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('reverse-grid.png'), fullPage: true });
  await expect(page.locator('.reverse-grid-summary')).toContainText('Vorläufig');
  await page.getByLabel('Wertungsstand').selectOption('official');
  await expect(page.locator('.reverse-grid-summary')).toContainText('Offiziell');
  fail = true;
  await page.getByRole('button', { name: 'Aktualisieren', exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toBeVisible();
  await expect(page.locator('.reverse-grid-table')).toHaveCount(0);
});

test('annulment requires a reason, preserves input on stale data and leaves the other race untouched', async ({ page, context }, info) => {
  const state = await fixture(context);
  const races = state.races.map(r => ({ ...r, status: 'completed', updated_at: '2026-11-10T12:00:00Z', annulment: null as null | { reason: string; annulled_at: string } }));
  const following = JSON.stringify(races[1]);
  await context.route('**/rpc/get_league_race_admin_workspace', route => route.fulfill({ json: { league: f.league, seasons: [f.season], races, driver_standings: [], team_standings: [] } }));
  let calls = 0;
  await context.route('**/rpc/annul_league_race', route => {
    calls++;
    if (calls === 1) return route.fulfill({ status: 409, json: { message: 'ANNUL_STALE' } });
    const args = route.request().postDataJSON();
    expect(args.p_race_id).toBe(races[0].id);
    expect(args.p_expected_updated_at).toBe(races[0].updated_at);
    races[0] = { ...races[0], status: 'cancelled', current_result_version_id: null, result_status: '', result_count: 0, annulment: { reason: args.p_reason, annulled_at: '2026-11-10T12:10:00Z' } };
    return route.fulfill({ json: { raceId: races[0].id, status: 'cancelled' } });
  });
  await page.goto('/admin/races');
  await page.getByRole('button', { name: 'Rennen annullieren', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Rennen endgültig annullieren' })).toBeDisabled();
  await dialog.getByLabel('Begründung').fill('Gemeinsam beschlossen, nicht zu werten.');
  await page.screenshot({ path: info.outputPath('annul-race.png'), fullPage: false });
  expect(await dialog.evaluate(el => el.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Rennen endgültig annullieren' }).click();
  await expect(dialog.getByRole('alert')).toContainText('inzwischen geändert');
  await expect(dialog.getByLabel('Begründung')).toHaveValue('Gemeinsam beschlossen, nicht zu werten.');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  expect(calls).toBe(1);
  await page.getByRole('button', { name: 'Rennen annullieren', exact: true }).first().click();
  await dialog.getByLabel('Begründung').fill('Gemeinsam beschlossen, nicht zu werten.');
  await dialog.getByRole('button', { name: 'Rennen endgültig annullieren' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('main .admin-status:visible').filter({ hasText: /^Annulliert$/ })).toBeVisible();
  expect(JSON.stringify(races[1])).toBe(following);
});

test('overview groups a race day and opens the correct race import; navigation stays available', async ({ page, context }, info) => {
  const state = await fixture(context);
  await page.goto('/admin');
  await expect(page.locator('main h1')).toHaveText('Ligaleitung');
  await expect(page.getByText('12345', { exact: true })).toBeVisible();
  await expect(page.locator('.admin-task-list')).toContainText('1Ergebnisse nachtragen');
  await expect(page.locator('.admin-race-list li')).toHaveCount(2);
  await expect(page.locator('.admin-season-ready')).toHaveCount(0);
  await expect(page.locator('main').getByRole('link', { name: 'Neue Liga erstellen' })).toHaveCount(0);
  await expect(page.locator('.admin-overview-warning')).toHaveCount(0);
  const detail = page.locator('.admin-race-list').getByRole('link', { name: 'Ergebnis ansehen' });
  await expect(detail).toHaveAttribute('href', new RegExp(`season=${f.season.id}&round=1`));
  expect(state.reads.some(url => url.includes('steward_cases') && url.includes('races.season_id=eq.' + f.season.id))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('admin-overview.png'), fullPage: true });
  await page.locator('.admin-race-list').getByRole('link', { name: 'Ergebnis importieren' }).click();
  await expect(page.locator('.result-import-race-row select')).toHaveValue(state.nextId);
  const nav = page.getByRole('navigation', { name: 'Bereich der Ligaleitung' });
  if (info.project.name === 'mobile') {
    await expect(nav.getByRole('combobox')).toHaveValue('/admin/races');
    await nav.getByRole('combobox').selectOption('/admin/users');
  } else {
    const section = nav.getByRole('button', { name: 'Saison & Rennen', exact: true });
    await expect(section).toHaveAttribute('aria-expanded', 'true');
    const children = page.locator('#admin-subnav-season');
    await expect(children.getByRole('link', { name: 'Import', exact: true })).toHaveAttribute('aria-current', 'page');
    await section.click();
    await expect(children).toBeHidden();
    await expect(page).toHaveURL(/\/admin\/results\/import/);
    await section.press('Enter');
    await expect(children).toBeVisible();
    const group = section.locator('..');
    await expect(group.locator('.admin-section-links')).toHaveCount(1);
    await expect(group.locator('.admin-section-links')).toBeVisible();
    await page.screenshot({ path: info.outputPath('admin-nested-navigation.png'), fullPage: true });
    await nav.getByRole('link', { name: 'Mitglieder & Rechte' }).click();
  }
  await expect(page).toHaveURL(/\/admin\/users/);
  await expect(page.locator('main')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('completion is compact and ignores historical drafts and historical case totals', async ({ page, context }) => {
  await fixture(context, { complete: true, oldDraft: true });
  await page.goto('/admin');
  await expect(page.locator('.admin-season-ready')).toBeVisible();
  await expect(page.getByText('Aktuell nichts zu erledigen.')).toBeVisible();
  await expect(page.locator('.admin-task-list')).toHaveCount(0);
});

test('incomplete count loading never suggests closure or claims everything is done', async ({ page, context }) => {
  await fixture(context, { complete: true, failCount: true });
  await page.goto('/admin');
  await expect(page.locator('.admin-overview-warning')).toContainText('möglicherweise unvollständig');
  await expect(page.locator('.admin-season-ready')).toHaveCount(0);
  await expect(page.getByText('Aktuell nichts zu erledigen.')).toHaveCount(0);
});
