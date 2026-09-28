import { expect, test, type BrowserContext } from '@playwright/test';
import { installPublicFixture, publicRacingFixture } from './public-fixture';

async function fixture(context: BrowserContext, options: { missing?: boolean; broken?: boolean } = {}) {
  await installPublicFixture(context);
  const id = '91000000-0000-4000-8000-000000000081';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp })).toString('base64url')}.synthetic`;
  let metadata: Record<string, unknown> = { display_name: 'Logo Test Driver', gamertag: 'LogoTest', onboarding_complete: true, theme_preset: 0 };
  const user = () => ({ id, email: 'logo-test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: metadata });
  const writes: { path: string; data: Record<string, unknown> }[] = [];
  const state = { broken: options.broken ?? false, saveFailure: false };
  await context.addInitScript(value => {
    localStorage.setItem('racevora.locale', 'de');
    for (const ref of ['nfvwarlowjqphytqqtxz', 'znnkwjogtvzwfkwnmawp']) if (!localStorage.getItem(`racevora-v2:${ref}:auth`)) localStorage.setItem(`racevora-v2:${ref}:auth`, JSON.stringify(value));
  }, { access_token: token, refresh_token: 'synthetic', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: user() });
  await context.route('**/qa-logo-theme.svg', route => state.broken
    ? route.fulfill({ status: 404, body: 'Synthetic missing image', headers: { 'cache-control': 'no-store' } })
    : route.fulfill({ contentType: 'image/svg+xml', headers: { 'cache-control': 'no-store' }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><path fill="#00dcb4" d="M10 20h70v70H10z"/><path fill="#d282fa" d="M80 20h30v70H80z"/></svg>' }));
  await context.route('https://*.supabase.co/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split('/').pop();
    if (url.pathname === '/auth/v1/user') {
      if (req.method() === 'PUT') {
        const body = req.postDataJSON();
        writes.push({ path: url.pathname, data: body.data });
        if (state.saveFailure) return route.fulfill({ status: 422, json: { code: 'validation_failed', msg: 'Synthetic save failure' } });
        metadata = { ...metadata, ...body.data };
      }
      return route.fulfill({ json: user() });
    }
    if (table === 'get_owner_mfa_status') return route.fulfill({ json: { is_owner: false, verified: false } });
    if (table === 'current_app_role') return route.fulfill({ json: 'driver' });
    if (table === 'driver_identities') return route.fulfill({ json: { id: '92000000-0000-4000-8000-000000000081', profile_number: 81, status: 'active', gamertag: 'LogoTest' } });
    if (table === 'driver_identity_links') return route.fulfill({ json: [] });
    if (table === 'league_members') return route.fulfill({ json: [{ league_id: publicRacingFixture.league.id, role: 'driver' }] });
    if (table === 'leagues') {
      const league = { ...publicRacingFixture.league, logo_url: options.missing ? null : '/qa-logo-theme.svg' };
      return route.fulfill({ json: (req.headers().accept || '').includes('vnd.pgrst.object') ? league : [league] });
    }
    if (url.pathname.includes('/rpc/')) return route.fulfill({ json: null });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) { writes.push({ path: url.pathname, data: req.postDataJSON() }); return route.abort('blockedbyclient'); }
    return route.fallback();
  });
  return { writes, state };
}

async function openCustom(page: import('@playwright/test').Page) {
  await page.goto('/profile');
  await page.getByText('Persönliches Farbthema', { exact: true }).first().click();
  await page.locator('.profile-theme-picker').getByRole('radio', { name: /Individuell/ }).check();
  return page.locator('.profile-custom-theme-editor');
}

test('logo palette is previewed, editable and saved only to the personal account', async ({ page, context }, info) => {
  const { writes } = await fixture(context);
  const editor = await openCustom(page);
  const originalBrand = await page.evaluate(() => document.documentElement.style.getPropertyValue('--brand-primary'));
  await editor.getByRole('button', { name: 'Farben aus Liga-Logo übernehmen' }).click();
  await expect(editor.locator('.profile-logo-theme [role="status"]')).toContainText('Logofarben übernommen');
  const primary = editor.locator('input[type="color"]').nth(0);
  await expect(primary).toHaveValue('#00dcb4');
  expect(writes).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--brand-primary'))).toBe(originalBrand);
  await primary.fill('#43dabc');
  await expect(editor.locator('.profile-logo-theme-sample')).toHaveCSS('background-color', 'rgb(67, 218, 188)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('profile-logo-theme.png'), fullPage: true });
  await editor.getByRole('button', { name: 'Individuelles Theme speichern' }).click();
  await expect(page.getByText('Dein persönliches Farbthema wurde gespeichert.')).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ path: '/auth/v1/user', data: { theme_preset: 12, theme_custom: { primary_color: '#43DABC' } } });
  await page.reload();
  await page.getByText('Persönliches Farbthema', { exact: true }).first().click();
  await expect(page.locator('.profile-custom-theme-editor input[type="color"]').first()).toHaveValue('#43dabc');
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--brand-primary'))).toBe('#43DABC');
});

test('unreadable logos retain the draft and can be retried', async ({ page, context }) => {
  const { writes, state } = await fixture(context, { broken: true });
  const editor = await openCustom(page);
  const primary = editor.locator('input[type="color"]').first();
  const before = await primary.inputValue();
  await editor.getByRole('button', { name: 'Farben aus Liga-Logo übernehmen' }).click();
  await expect(editor.getByRole('alert')).toContainText('Das Logo konnte nicht ausgelesen werden');
  await expect(primary).toHaveValue(before);
  expect(writes).toHaveLength(0);
  state.broken = false;
  await editor.getByRole('button', { name: 'Farben aus Liga-Logo übernehmen' }).click();
  await expect(primary).toHaveValue('#00dcb4');
});

test('missing league logo explains the disabled import without blocking manual colors', async ({ page, context }) => {
  const { writes } = await fixture(context, { missing: true });
  const editor = await openCustom(page);
  await expect(editor.getByText('Die aktive Liga hat kein eigenes Logo hinterlegt.')).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Farben aus Liga-Logo übernehmen' })).toBeDisabled();
  await expect(editor.locator('input[type="color"]').first()).toBeEnabled();
  expect(writes).toHaveLength(0);
});

test('failed personal save retains the extracted draft for retry', async ({ page, context }) => {
  const { writes, state } = await fixture(context);
  const editor = await openCustom(page);
  const originalBrand = await page.evaluate(() => document.documentElement.style.getPropertyValue('--brand-primary'));
  await editor.getByRole('button', { name: 'Farben aus Liga-Logo übernehmen' }).click();
  await expect(editor.locator('input[type="color"]').first()).toHaveValue('#00dcb4');
  state.saveFailure = true;
  await editor.getByRole('button', { name: 'Individuelles Theme speichern' }).click();
  await expect(page.getByRole('alert')).toHaveText('Das Farbthema konnte nicht gespeichert werden.');
  await expect(editor.locator('input[type="color"]').first()).toHaveValue('#00dcb4');
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--brand-primary'))).toBe(originalBrand);
  state.saveFailure = false;
  await editor.getByRole('button', { name: 'Individuelles Theme speichern' }).click();
  await expect(page.getByText('Dein persönliches Farbthema wurde gespeichert.')).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes.every(write => write.path === '/auth/v1/user')).toBe(true);
});
