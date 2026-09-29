import { expect, test, type BrowserContext } from '@playwright/test';
import { installPublicFixture, publicRacingFixture } from './public-fixture';

async function fixture(context: BrowserContext) {
  await installPublicFixture(context);
  const user = { id: '91000000-0000-4000-8000-000000000075', email: 'league-admin@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { onboarding_complete: true, display_name: 'Test Admin' } };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', aal: 'aal1', exp })).toString('base64url')}.synthetic`;
  await context.addInitScript(({ user, token, exp }) => {
    localStorage.setItem('racevora.locale', 'de');
    for (const ref of ['nfvwarlowjqphytqqtxz', 'znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`, JSON.stringify({ user, access_token: token, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer' }));
  }, { user, token, exp });
  const writes: Array<{ name: string; body: any }> = [];
  const teams = [{ id: '70000000-0000-4000-8000-000000000001', name: 'RCC Racing' }];
  const preferences: Array<{ driver_id: string; team_id: string }> = [];
  const drivers = publicRacingFixture.drivers.map(d => ({ ...d, ai_driver_reference: null, identity_linked: true, result_count: 12 }));
  await context.route('https://*.supabase.co/**', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    if (name === 'user') return route.fulfill({ json: user });
    if (name === 'current_app_role') return route.fulfill({ json: 'league_admin' });
    if (name === 'get_owner_mfa_status') return route.fulfill({ json: { is_owner: false, verified: false } });
    if (name === 'league_members') return route.fulfill({ json: [{ league_id: publicRacingFixture.league.id, role: 'league_admin' }] });
    if (name === 'driver_identities') return route.fulfill({ json: { id: user.id, status: 'active', profile_number: 75 } });
    if (name === 'get_league_driver_admin_workspace') return route.fulfill({ json: { league: publicRacingFixture.league, drivers, counts: { total: 2, active: 2, linked: 2 }, active_season: null, ai_drivers: [], ai_assignments: [] } });
    if (name === 'get_league_roster_workspace') return route.fulfill({ json: { season_id: null, races: [], vehicles: [], substitutions: [] } });
    if (name === 'get_league_team_directory') return route.fulfill({ json: { teams, preferences, profiles: drivers.map(({ id, display_name, gamertag, is_active }) => ({ id, display_name, gamertag, is_active })) } });
    if (name === 'create_league_team') { const body = route.request().postDataJSON(); writes.push({ name, body }); const team = { id: '70000000-0000-4000-8000-000000000002', name: body.p_name }; teams.push(team); return route.fulfill({ json: team.id }); }
    if (name === 'assign_league_driver_team') { const body = route.request().postDataJSON(); writes.push({ name, body }); preferences.push({ driver_id: body.p_driver_id, team_id: body.p_team_id }); return route.fulfill({ json: {} }); }
    if (name === 'start_league_season_from_profiles') { writes.push({ name, body: route.request().postDataJSON() }); return route.fulfill({ json: { season: { id: 'season', name: 'Test', slug: 'test' }, players: 1, ai_drivers: 1, races: 3, started: true } }); }
    if (name === 'get_season_setup_workspace') return route.fulfill({ json: {
      league: publicRacingFixture.league, active_season: null, games: [{ key: 'f1_25', label: 'F1 25', roster: [
        { seat_code: 'mercedes-russell', ai_driver_name: 'George Russell', number: 63, nationality_code: 'GB', team_name: 'Mercedes', car_name: 'Mercedes W16' },
        { seat_code: 'mercedes-antonelli', ai_driver_name: 'Kimi Antonelli', number: 12, nationality_code: 'IT', team_name: 'Mercedes', car_name: 'Mercedes W16' },
      ], tracks: ['bahrain', 'monaco', 'belgium'].map(key => ({ key, grand_prix_name: key, circuit_name: key, country_code: 'DE' })) }]
    } });
    if (route.request().url().includes('/rpc/')) return route.fulfill({ json: null });
    return route.fallback();
  });
  return { writes, teams, drivers };
}

test('league driver directory remains usable on desktop and mobile', async ({ page, context }, info) => {
  await fixture(context);
  await page.goto('/admin/drivers');
  await expect(page.getByRole('heading', { name: /Fahrer/ }).first()).toBeVisible();
  await expect(page.getByText('Test Driver 1', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.impeccable/review/driver-teams-${process.env.RACEVORA_BASELINE ? 'before-' : ''}${info.project.name}.png`, fullPage: true });
});

test('creates an independent team and assigns an existing profile', async ({ page, context }, info) => {
  const state = await fixture(context);
  await page.goto('/admin/teams');
  await expect(page.getByRole('heading', { name: 'Eigene Liga-Teams' })).toBeVisible();
  await page.getByLabel('Neuer Teamname').fill('RCC Junior');
  await page.getByRole('button', { name: 'Team erstellen', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Liga-Team angelegt');
  await page.getByRole('combobox', { name: 'Fahrerprofil', exact: true }).selectOption(state.drivers[0].id);
  await page.getByRole('combobox', { name: 'Liga-Team', exact: true }).selectOption('70000000-0000-4000-8000-000000000002');
  await page.getByRole('button', { name: 'Team zuordnen', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('laufende Saison bleibt unverändert');
  expect(state.writes.at(-1)).toEqual({ name: 'assign_league_driver_team', body: { p_driver_id: state.drivers[0].id, p_team_id: '70000000-0000-4000-8000-000000000002', p_effective_from_round: null } });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `.impeccable/review/teams-${info.project.name}.png`, fullPage: true });
});

test('selects existing profiles and schedules two races per Monday', async ({ page, context }, info) => {
  const state = await fixture(context);
  await page.goto('/admin/season/setup');
  await page.getByRole('button', { name: 'Starterfeld einrichten' }).click();
  await page.getByRole('checkbox', { name: 'Spieler zuordnen' }).nth(0).check();
  await page.getByLabel('Fahrerprofil für George Russell').selectOption(state.drivers[0].id);
  await page.getByLabel('Liga-Team für George Russell').selectOption(state.teams[0].id);
  await page.getByRole('checkbox', { name: 'Spieler zuordnen' }).nth(1).check();
  await expect(page.getByLabel('Fahrerprofil für Kimi Antonelli').locator(`option[value="${state.drivers[0].id}"]`)).toHaveAttribute('disabled', '');
  await page.getByRole('checkbox', { name: 'Spieler zuordnen' }).nth(1).uncheck();
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: `.impeccable/review/season-profiles-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Rennkalender einrichten' }).click();
  await page.getByLabel('Rennen pro Renntag', { exact: false }).fill('2');
  await page.getByLabel('Erster Renntag').fill('2026-09-28');
  await page.getByRole('checkbox', { name: 'So', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Mo', exact: true }).check();
  await page.getByRole('button', { name: 'Kalender erstellen / neu mischen' }).click();
  await expect(page.getByLabel('Datum Rennen 1')).toHaveValue('2026-09-28');
  await expect(page.getByLabel('Datum Rennen 2')).toHaveValue('2026-09-28');
  await expect(page.getByLabel('Datum Rennen 3')).toHaveValue('2026-10-05');
  await page.getByLabel('Startzeit Rennen 2').fill('21:00');
  await page.getByRole('radio', { name: /^Nein/ }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); document.querySelector('.season-calendar-table-wrap')?.scrollTo(0, 0); window.scrollTo(0, 0); });
  await page.screenshot({ path: `.impeccable/review/season-calendar-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Kalender prüfen' }).click();
  await page.getByRole('button', { name: 'Saison starten', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].body.p_assignments).toEqual([{ seat_code: 'mercedes-russell', driver_id: state.drivers[0].id, team_id: state.teams[0].id }]);
  expect(state.writes[0].body.p_calendar[1]).toMatchObject({ date: '2026-09-28', time: '21:00' });
});
