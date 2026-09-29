import { expect, test, type BrowserContext } from '@playwright/test';
import { installPublicFixture, publicRacingFixture } from './public-fixture';

async function fixture(context: BrowserContext, options: { error?: string; noSeason?: boolean; empty?: boolean; loadError?: boolean } = {}) {
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
  const profiles = options.empty ? [] : drivers.map((d, i) => ({ id: d.id, display_name: d.display_name, gamertag: d.gamertag, is_active: true, team_name: i === 0 ? 'RCC Racing' : 'Junior', car_name: i === 0 ? 'Mercedes W16' : 'Red Bull RB21' }));
  const managerTeams = options.empty ? [] : [{ name: 'RCC Racing' }, { name: 'Junior' }];
  let failure = options.error;
  let loadFailure = options.loadError;
  const manager = (mode: string, round: number | null) => ({ mode, revision: 'test-revision', season: options.noSeason ? null : { id: 'season', name: 'Saison 2026' }, view_round: round ?? 2,
    profiles, teams: managerTeams, races: options.noSeason ? [] : [{ id: 'old', round: 1, name: 'Bahrain', locked: true }, { id: 'next', round: 2, name: 'Monaco', locked: false }] });
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
    if (name === 'get_league_team_manager') {
      if (loadFailure) { loadFailure = false; return route.fulfill({ status: 503, json: { message: 'Unavailable' } }); }
      const body = route.request().postDataJSON(); return route.fulfill({ json: manager(body.p_mode, body.p_round) });
    }
    if (name === 'save_league_team_lineup') {
      const body = route.request().postDataJSON(); writes.push({ name, body });
      if (failure) { const message = failure; failure = undefined; return route.fulfill({ status: 400, json: { message } }); }
      if (!managerTeams.some(t => t.name === body.p_name)) managerTeams.push({ name: body.p_name });
      for (const p of profiles) {
        if (body.p_driver_ids.includes(p.id)) p.team_name = body.p_name;
        const departure = body.p_departures.find((d: { driver_id: string }) => d.driver_id === p.id);
        if (departure) p.team_name = departure.team_name;
      }
      return route.fulfill({ json: manager(body.p_mode, body.p_round) });
    }
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

test('creates a complete independent lineup from an explicitly selected race', async ({ page, context }, info) => {
  const state = await fixture(context);
  await page.goto('/admin/teams');
  await expect(page.getByRole('heading', { name: 'Liga-Teams', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'RCC Racing', exact: true })).toContainText('Mercedes W16');
  await expect(page.getByRole('button', { name: 'Team erstellen', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Änderungen gültig ab')).toHaveValue('');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `.impeccable/review/team-manager-${info.project.name}.png`, fullPage: true });
  await page.getByLabel('Änderungen gültig ab').selectOption('2');
  await page.getByRole('button', { name: 'Team erstellen', exact: true }).click();
  await page.getByLabel('Teamname', { exact: true }).fill('Hobbyracer');
  await page.getByRole('combobox', { name: 'Fahrer 1', exact: true }).selectOption(state.drivers[0].id);
  await page.getByRole('combobox', { name: 'Fahrer 2', exact: true }).selectOption(state.drivers[1].id);
  await expect(page.getByRole('combobox', { name: 'Fahrer 2', exact: true }).locator(`option[value="${state.drivers[0].id}"]`)).toHaveAttribute('disabled', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Teamname', { exact: true }).focus();
  await page.keyboard.press('Tab');
  const contrast = await page.evaluate(() => {
    const input = document.querySelector('.team-lineup-editor input')!;
    const focused = getComputedStyle(document.activeElement!);
    const selection = getComputedStyle(input, '::selection');
    const luminance = (color: string) => {
      const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    const ratio = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    return { focus: ratio(focused.outlineColor, focused.backgroundColor), selection: ratio(selection.color, selection.backgroundColor) };
  });
  expect(contrast.focus).toBeGreaterThanOrEqual(3);
  expect(contrast.selection).toBeGreaterThanOrEqual(4.5);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `.impeccable/review/team-manager-editor-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Besetzung speichern', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Team-Besetzung gespeichert');
  expect(state.writes).toEqual([{ name: 'save_league_team_lineup', body: { p_mode: 'current', p_round: 2, p_original_name: null, p_name: 'Hobbyracer', p_driver_ids: state.drivers.map(d => d.id), p_departures: [], p_revision: 'test-revision' } }]);
  await expect(page.getByRole('article', { name: 'Hobbyracer', exact: true })).toContainText('Mercedes W16');
  await expect(page.getByRole('article', { name: 'Hobbyracer', exact: true })).toContainText('Red Bull RB21');
});

test('outgoing driver requires a destination; failed save preserves choices', async ({ page, context }) => {
  const state = await fixture(context, { error: 'TEAM_FULL' });
  await page.goto('/admin/teams');
  await page.getByLabel('Änderungen gültig ab').selectOption('2');
  await page.getByRole('article', { name: 'RCC Racing', exact: true }).getByRole('button', { name: 'Besetzung bearbeiten' }).click();
  await page.getByRole('combobox', { name: 'Fahrer 1', exact: true }).selectOption(state.drivers[1].id);
  await expect(page.getByRole('button', { name: 'Besetzung speichern' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Neues Team für Test Driver 1', exact: true }).selectOption('Junior');
  await page.getByRole('button', { name: 'Besetzung speichern' }).click();
  await expect(page.getByRole('alert')).toContainText('mehr als zwei Fahrer');
  await expect(page.getByRole('combobox', { name: 'Fahrer 1', exact: true })).toHaveValue(state.drivers[1].id);
  await page.getByRole('button', { name: 'Besetzung speichern' }).click();
  await expect(page.getByRole('status')).toContainText('gespeichert');
  expect(state.writes.at(-1)?.body.p_departures).toEqual([{ driver_id: state.drivers[0].id, team_name: 'Junior' }]);
});

test('stale edit requires explicit reload without writing again', async ({ page, context }) => {
  const state = await fixture(context, { error: 'TEAM_STATE_CHANGED' });
  await page.goto('/admin/teams');
  await page.getByLabel('Änderungen gültig ab').selectOption('2');
  await page.getByRole('article', { name: 'RCC Racing', exact: true }).getByRole('button', { name: 'Besetzung bearbeiten' }).click();
  await page.getByRole('button', { name: 'Besetzung speichern' }).click();
  await expect(page.getByRole('alert')).toContainText('zwischenzeitlich geändert');
  await expect(page.getByRole('button', { name: 'Besetzung speichern' })).toBeDisabled();
  await page.getByRole('button', { name: 'Aktuellen Stand laden' }).click();
  await expect(page.getByLabel('Änderungen gültig ab')).toHaveValue('');
  expect(state.writes).toHaveLength(1);
});

test('empty league retries loading and can prepare teams without a current season', async ({ page, context }) => {
  const state = await fixture(context, { noSeason: true, empty: true, loadError: true });
  await page.goto('/admin/teams');
  await expect(page.getByRole('alert')).toContainText('Teams konnten nicht geladen werden');
  await page.getByRole('button', { name: 'Erneut laden', exact: true }).click();
  await expect(page.getByText('Keine laufende Saison.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Nächste Saison', exact: true }).click();
  await page.getByRole('button', { name: 'Team erstellen', exact: true }).click();
  await page.getByLabel('Teamname', { exact: true }).fill('Nächstes Team');
  await page.getByRole('button', { name: 'Besetzung speichern' }).click();
  await expect(page.getByRole('status')).toContainText('gespeichert');
  expect(state.writes.at(-1)?.body).toMatchObject({ p_mode: 'next', p_round: null, p_driver_ids: [] });
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
