import { expect, test, type BrowserContext } from '@playwright/test';
import { installPublicFixture } from './public-fixture';

// Synthetic sessions and QR only: never enroll a real user in browser tests.
async function installMfaFixture(context: BrowserContext, existing = false) {
  await installPublicFixture(context);
  const id = '90000000-0000-4000-8000-000000000001';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = (aal: string) => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', aal, exp, iat: exp - 3600 })).toString('base64url')}.test-signature-not-valid`;
  let verified = existing;
  let elevated = false;
  const user = () => ({ id, email: 'mfa-test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', factors: verified ? [{ id: 'test-factor', factor_type: 'totp', status: 'verified', friendly_name: 'Test authenticator' }] : [] });
  const session = (aal: string) => ({ access_token: token(aal), refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: user() });
  await context.addInitScript(({ value }) => {
    localStorage.setItem('racevora.locale', 'de');
    localStorage.setItem('racevora-v2:nfvwarlowjqphytqqtxz:auth', JSON.stringify(value));
  }, { value: session('aal1') });
  await context.route('https://*.supabase.co/auth/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/user')) return route.fulfill({ json: user() });
    if (path.endsWith('/factors') && route.request().method() === 'POST') return route.fulfill({ json: { id: 'test-factor', type: 'totp', totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="white"/><text x="25" y="100" fill="black">SYNTHETIC TEST QR</text></svg>', secret: 'TESTKEYNOTAREALSECRET', uri: 'otpauth://totp/TEST-ONLY' } } });
    if (path.endsWith('/challenge')) return route.fulfill({ json: { id: 'test-challenge', type: 'totp', expires_at: exp } });
    if (path.endsWith('/verify')) {
      if (route.request().postDataJSON()?.code !== '123456') return route.fulfill({ status: 422, json: { code: 'mfa_verification_failed', msg: 'Invalid code' } });
      elevated = true; verified = true;
      return route.fulfill({ json: session('aal2') });
    }
    if (path.endsWith('/logout')) return route.fulfill({ status: 204 });
    return route.abort('blockedbyclient');
  });
  await context.route('**/rest/v1/rpc/**', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    if (name === 'get_owner_mfa_status') return route.fulfill({ json: { is_owner: true, verified: elevated } });
    if (name === 'current_app_role') return route.fulfill({ json: elevated ? 'owner' : null });
    return route.fulfill({ json: null });
  });
}

test('owner enrollment, wrong code and confirmed second factor', async ({ page, context }, testInfo) => {
  await installMfaFixture(context);
  await page.goto('/owner');
  await expect(page.getByRole('heading', { name: 'Owner-Konto schützen' })).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveCount(0);
  await page.getByRole('button', { name: 'Authenticator einrichten', exact: true }).click();
  const qr = page.getByAltText('Privater QR-Code für die Authenticator-Einrichtung');
  await expect(qr).toBeVisible();
  expect(await qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const originalViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: originalViewport.height });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize(originalViewport);
  await page.screenshot({ path: testInfo.outputPath('owner-mfa-setup.png'), fullPage: true });
  await page.getByText('Einrichtungsschlüssel anzeigen', { exact: true }).click();
  await expect(page.getByText('TESTKEYNOTAREALSECRET')).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('checkbox').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Authenticator-Code', { exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('checkbox')).toBeFocused();
  await expect(page.getByRole('checkbox')).toHaveCSS('outline-color', 'rgb(244, 247, 255)');
  await page.getByLabel('Authenticator-Code', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'Code bestätigen' }).click();
  await expect(page.getByRole('alert')).toContainText('Code konnte nicht');
  await expect(page.locator('.app-shell')).toHaveCount(0);
  await page.getByLabel('Authenticator-Code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Code bestätigen' }).click();
  await expect(page.locator('.owner-mfa')).toHaveCount(0);
  await expect(page.locator('.app-shell')).toBeVisible();
});

test('returning owner receives a compact code challenge', async ({ page, context }, testInfo) => {
  await installMfaFixture(context, true);
  await page.goto('/owner');
  await expect(page.getByRole('heading', { name: 'Zweiter Faktor', exact: true })).toBeVisible();
  await expect(page.getByLabel('Authenticator-Code', { exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt springen' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Authenticator-Code', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Authenticator-Code', { exact: true })).toHaveCSS('outline-color', 'rgb(244, 247, 255)');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Code bestätigen' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Code bestätigen' })).toHaveCSS('outline-color', 'rgb(244, 247, 255)');
  await page.keyboard.press('Tab');
  await expect(page.locator('.owner-mfa-recovery summary')).toBeFocused();
  await expect(page.locator('.owner-mfa-recovery summary')).toHaveCSS('outline-color', 'rgb(244, 247, 255)');
  await page.getByLabel('Authenticator-Code', { exact: true }).focus();
  await expect(page.getByRole('button', { name: 'Authenticator einrichten', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('owner-mfa-challenge.png'), fullPage: true });
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page.locator('.owner-mfa')).toHaveCount(0);
});
