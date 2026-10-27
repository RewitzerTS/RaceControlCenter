import { expect, test, type BrowserContext } from '@playwright/test';
import { installPublicFixture, publicRacingFixture } from './public-fixture';

async function entryFixture(context: BrowserContext, options: { admin?: boolean; pending?: boolean; failSave?: boolean } = {}) {
  await installPublicFixture(context);
  const id = '91000000-0000-4000-8000-000000000098';
  const identity = '92000000-0000-4000-8000-000000000098';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', aal: 'aal1', exp })).toString('base64url')}.synthetic-not-a-real-token`;
  const metadata = { display_name: '', gamertag: '', onboarding_complete: false, theme_preset: 0 };
  const user = () => ({ id, email: 'entry-test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: metadata, created_at: '2026-01-01T00:00:00Z' });
  const session = () => ({ access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: user() });
  let entry = { identity_id: identity, racevora_id: 'RV-100098', display_name: '', real_name: '', public_name_mode: 'gamertag', gamertag: '', step: 1, profile_complete: false };
  let pending = options.pending ?? false;
  let failed = false;
  let reviewed = false;
  const writes: { rpc: string; body: Record<string, unknown> }[] = [];
  await context.addInitScript(value => {
    localStorage.setItem('racevora.locale', 'de');
    for (const ref of ['nfvwarlowjqphytqqtxz', 'znnkwjogtvzwfkwnmawp']) {
      if (!localStorage.getItem(`racevora-v2:${ref}:auth`)) localStorage.setItem(`racevora-v2:${ref}:auth`, JSON.stringify(value));
    }
  }, session());
  await context.route('https://*.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    const name = url.pathname.split('/').pop() ?? '';
    if (url.pathname === '/auth/v1/user') {
      if (route.request().method() === 'PUT') Object.assign(metadata, route.request().postDataJSON().data);
      return route.fulfill({ json: user() });
    }
    if (url.pathname === '/auth/v1/token') return route.fulfill({ json: session() });
    if (name === 'get_owner_mfa_status') return route.fulfill({ json: { is_owner: false, verified: false } });
    if (name === 'current_app_role') return route.fulfill({ json: options.admin ? 'league_admin' : 'driver' });
    if (name === 'driver_identities') return route.fulfill({ json: { id: identity, profile_number: 98, racevora_number: 100098, status: 'active', gamertag: entry.gamertag } });
    if (name === 'league_members') return route.fulfill({ json: options.admin ? [{ league_id: publicRacingFixture.league.id, role: 'league_admin' }] : [] });
    if (name === 'driver_identity_links') return route.fulfill({ json: [] });
    if (name === 'get_my_entry_state') return route.fulfill({ json: entry });
    if (name === 'get_my_league_join_requests') return route.fulfill({ json: pending ? [{ id: 'request', league_id: publicRacingFixture.league.id, league_name: 'Monday Night Racing', league_slug: publicRacingFixture.league.slug, status: 'pending', requested_at: '2026-10-18T12:00:00Z', reviewed_at: null }] : [] });
    if (name === 'get_driver_gamertags') return route.fulfill({ json: { main: entry.gamertag, aliases: [] } });
    if (name === 'get_league_member_admin_workspace') return route.fulfill({ json: { league: publicRacingFixture.league, members: [], join_requests: reviewed ? [] : [{ id: 'request', user_id: id, email: 'entry-test@example.invalid', display_name: 'Racer', gamertag: 'Darkqz', requested_at: '2026-10-18T12:00:00Z', status: 'pending' }] } });
    if (name === 'get_join_request_driver_candidates') return route.fulfill({ json: [{ id: 'existing-driver', display_name: 'Aaron', gamertag: 'Darkqz', matched: true, is_active: true, number: 27 }] });
    if (['save_my_entry_names', 'advance_my_entry', 'request_my_entry_league', 'review_league_join_request_explicit'].includes(name)) {
      const body = route.request().postDataJSON(); writes.push({ rpc: name, body });
      if (name === 'save_my_entry_names') {
        if (options.failSave && !failed) { failed = true; return route.fulfill({ status: 400, json: { message: 'Synthetic failure' } }); }
        entry = { ...entry, display_name: body.p_name, real_name: body.p_name, public_name_mode: body.p_public_name_mode, gamertag: body.p_gamertag, step: 2, profile_complete: true };
        Object.assign(metadata, { display_name: entry.display_name, gamertag: entry.gamertag });
      }
      if (name === 'advance_my_entry') {
        if (body.p_finish) metadata.onboarding_complete = true;
        else entry.step = body.p_step;
      }
      if (name === 'request_my_entry_league') {
        if (body.p_code === '00000') return route.fulfill({ status: 400, json: { message: 'ENTRY_CODE' } });
        pending = true; return route.fulfill({ json: { league_name: 'Monday Night Racing', request_status: 'pending' } });
      }
      if (name === 'review_league_join_request_explicit') reviewed = true;
      return route.fulfill({ json: entry });
    }
    if (url.pathname.includes('/rpc/')) return route.fulfill({ json: null });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.abort('blockedbyclient');
    return route.fallback();
  });
  return { writes };
}

test('entry saves independently, resumes after reload and confirms a league request', async ({ page, context }, info) => {
  await entryFixture(context, { failSave: true });
  await page.goto('/onboarding');
  await expect(page.getByText('RV-100098')).toBeVisible();
  await page.getByLabel('Name / Vorname', { exact: true }).fill('Racer');
  await page.getByRole('textbox', { name: 'Haupt-Gamertag', exact: true }).fill('Darkqz');
  await page.getByRole('button', { name: 'Speichern und weiter' }).click();
  await expect(page.getByRole('alert')).toContainText('bereits gespeicherten');
  await expect(page.getByRole('textbox', { name: 'Haupt-Gamertag', exact: true })).toHaveValue('Darkqz');
  await page.getByRole('button', { name: 'Speichern und weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Dein Racing. Deine Farben.' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dein Racing. Deine Farben.' })).toBeVisible();
  await page.locator('.entry-themes input').nth(1).click();
  await expect(page.locator('.entry-themes input').nth(1)).toBeChecked();
  await expect(page.getByText('Farbthema gespeichert.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-league-theme', '1');
  await page.screenshot({ path: info.outputPath('entry-theme.png'), fullPage: true });
  await page.getByRole('button', { name: 'Weiter zur Liga' }).click();
  await page.getByLabel('5-stelliger Beitrittscode').fill('00000');
  await page.getByRole('button', { name: 'Beitritt anfragen' }).click();
  await expect(page.getByRole('alert')).toContainText('Beitrittscode wurde nicht gefunden');
  await page.getByLabel('5-stelliger Beitrittscode').fill('12345');
  await page.getByRole('button', { name: 'Beitritt anfragen' }).click();
  await expect(page.getByRole('status')).toContainText('Monday Night Racing');
  await page.getByRole('button', { name: 'Zu Home' }).click();
  await expect(page.getByRole('heading', { name: 'Dein Fahrerprofil ist bereit.' })).toBeVisible();
  await expect(page.locator('.join-request-status')).toContainText('Monday Night Racing');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('entry-home-pending.png'), fullPage: true });
});

test('entry can be skipped, resumed, and does not capture password recovery', async ({ page, context }, info) => {
  await entryFixture(context);
  await page.goto('/onboarding');
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Später fortsetzen' }).click();
  await expect(page).toHaveURL(/\/home/);
  await page.getByRole('link', { name: 'Einrichtung fortsetzen' }).click();
  await expect(page.getByLabel('Name / Vorname', { exact: true })).toHaveValue('');
  await page.screenshot({ path: info.outputPath('entry-320.png'), fullPage: true });
  await page.goto('/auth/reset');
  await expect(page).toHaveURL(/\/auth\/reset/);
});

test('league approval never preselects even an exact gamertag match', async ({ page, context }, info) => {
  const fixture = await entryFixture(context, { admin: true });
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Beitritt prüfen', exact: true }).click();
  const form = page.getByRole('form', { name: 'Beitritt von Racer prüfen' });
  await expect(form.getByLabel('Fahrerzuordnung')).toHaveValue('');
  const confirm = form.getByRole('button', { name: 'Beitritt und Zuordnung bestätigen' });
  await expect(confirm).toBeDisabled();
  await form.getByLabel('Fahrerzuordnung').selectOption('existing-driver');
  await expect(form).toContainText('behält seine Ergebnisse');
  await page.screenshot({ path: info.outputPath('entry-admin-confirm.png'), fullPage: true });
  await confirm.click();
  await expect(page.getByText('Keine offenen Anfragen')).toBeVisible();
  expect(fixture.writes).toEqual([{ rpc: 'review_league_join_request_explicit', body: { p_request_id: 'request', p_decision: 'approved', p_driver_id: 'existing-driver', p_create_driver: false } }]);
});
