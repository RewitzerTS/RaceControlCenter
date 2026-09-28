import { expect, test, type BrowserContext } from '@playwright/test';
import { installPublicFixture, publicRacingFixture } from './public-fixture';

async function installGamertagFixture(context: BrowserContext, options: { failSave?: boolean; failLoad?: boolean; missing?: boolean } = {}) {
  await installPublicFixture(context);
  const id = '91000000-0000-4000-8000-000000000075';
  const identityId = '92000000-0000-4000-8000-000000000075';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', aal: 'aal1', exp })).toString('base64url')}.synthetic-not-a-real-token`;
  let saved = 'Raucher7575';
  let failedSave = false;
  let failedLoad = false;
  const writes: unknown[] = [];
  const user = () => ({ id, email: 'gamertag-test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Test Driver', gamertag: saved, onboarding_complete: true, theme_preset: 0 }, created_at: '2026-01-01T00:00:00Z' });
  await context.addInitScript(({ value }) => {
    localStorage.setItem('racevora.locale', 'de');
    for (const ref of ['nfvwarlowjqphytqqtxz', 'znnkwjogtvzwfkwnmawp']) {
      if (!localStorage.getItem(`racevora-v2:${ref}:auth`)) localStorage.setItem(`racevora-v2:${ref}:auth`, JSON.stringify(value));
    }
  }, { value: { access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: user() } });
  await context.route('https://*.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    const name = url.pathname.split('/').pop();
    if (url.pathname === '/auth/v1/user' && route.request().method() === 'GET') return route.fulfill({ json: user() });
    if (name === 'get_owner_mfa_status') return route.fulfill({ json: { is_owner: false, verified: false } });
    if (name === 'current_app_role') return route.fulfill({ json: 'driver' });
    if (name === 'update_my_gamertag') {
      const body = route.request().postDataJSON();
      writes.push(body);
      if (options.failSave && !failedSave) { failedSave = true; return route.fulfill({ status: 503, json: { message: 'Synthetic temporary failure' } }); }
      saved = body.p_gamertag;
      return route.fulfill({ json: saved });
    }
    if (name === 'driver_identities') {
      if (options.failLoad && !failedLoad && url.searchParams.get('select') === 'gamertag') { failedLoad = true; return route.fulfill({ status: 400, json: { message: 'Synthetic load failure' } }); }
      return route.fulfill({ json: options.missing ? null : { id: identityId, profile_number: 75, status: 'active', gamertag: saved } });
    }
    if (name === 'league_members') return route.fulfill({ json: [{ league_id: publicRacingFixture.league.id, role: 'driver' }] });
    if (name === 'driver_identity_links') return route.fulfill({ json: [{ driver_id: publicRacingFixture.drivers[0].id, driver: { league_id: publicRacingFixture.league.id } }] });
    if (url.pathname.includes('/rpc/')) return route.fulfill({ json: null });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.abort('blockedbyclient');
    return route.fallback();
  });
  return { writes };
}

test('profile gamertag correction persists after reload without changing driver links', async ({ page, context }, info) => {
  const fixture = await installGamertagFixture(context);
  await page.goto('/profile');
  const card = page.locator('.profile-gamertag-card');
  const summary = card.locator('summary');
  await expect(summary).toContainText('Raucher7575');
  await summary.focus();
  await page.keyboard.press('Enter');
  const field = page.locator('#profile-gamertag');
  await expect(field).toHaveValue('Raucher7575');
  await expect(card.getByRole('button', { name: 'Gamertag speichern' })).toBeDisabled();
  await field.fill('<bad>');
  await card.getByRole('button', { name: 'Gamertag speichern' }).click();
  await expect(card.getByRole('alert')).toBeVisible();
  expect(fixture.writes).toEqual([]);
  await field.fill('  Ratcher7575  ');
  await card.getByRole('button', { name: 'Gamertag speichern' }).click();
  await expect(card.getByRole('status')).toHaveText('Dein Gamertag wurde gespeichert.');
  expect(fixture.writes).toEqual([{ p_gamertag: 'Ratcher7575' }]);
  await expect(summary).toContainText('Ratcher7575');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('profile-gamertag-saved.png'), fullPage: true });
  await page.reload();
  await expect(card.locator('summary')).toContainText('Ratcher7575');
  await expect(page.locator('.profile-number')).toHaveText('#75');
  await expect(page.locator('.profile-facts')).toContainText('verknüpfter Fahrer');
});

test('profile gamertag failures keep the draft and allow retry', async ({ page, context }) => {
  await installGamertagFixture(context, { failSave: true, failLoad: true });
  await page.goto('/profile');
  const card = page.locator('.profile-gamertag-card');
  await card.locator('summary').click();
  await expect(card.getByRole('alert')).toHaveText('Dein aktueller Gamertag konnte nicht geladen werden.');
  await card.getByRole('button', { name: 'Erneut laden' }).click();
  const field = card.locator('input');
  await expect(field).toHaveValue('Raucher7575');
  await field.fill('Ratcher7575');
  await card.getByRole('button', { name: 'Gamertag speichern' }).click();
  await expect(card.getByRole('alert')).toContainText('nicht gespeichert');
  await expect(field).toHaveValue('Ratcher7575');
  await expect(card.locator('summary')).toContainText('Raucher7575');
  await card.getByRole('button', { name: 'Gamertag speichern' }).click();
  await expect(card.getByRole('status')).toContainText('gespeichert');
});

test('profile gamertag without identity leads to setup instead of a failing save', async ({ page, context }) => {
  await installGamertagFixture(context, { missing: true });
  await page.goto('/profile');
  const card = page.locator('.profile-gamertag-card');
  await card.locator('summary').click();
  await expect(card.getByRole('link', { name: 'Fahrerprofil zuerst einrichten' })).toHaveAttribute('href', '/onboarding');
  await expect(card.locator('input')).toHaveCount(0);
});
