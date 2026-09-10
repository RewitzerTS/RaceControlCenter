import { expect, test } from '@playwright/test';
test.beforeEach(async ({ context }) => { await context.route('https://*.supabase.co/**', (route) => route.abort()); });
test('members and owner use the available width without overflowing controls', async ({ page }, info) => {
  for (const view of ['members', 'owner']) {
    await page.goto('/qa/beta-responsive.html?view=' + view);
    await expect(page.locator('.responsive-table--records tbody tr').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('main').evaluate(el => el.getBoundingClientRect().width / innerWidth)).toBeGreaterThan(.85);
    if (info.project.name === 'mobile') {
      expect(await page.locator('main button').evaluateAll(els => els.every(el => el.getBoundingClientRect().right <= innerWidth))).toBe(true);
    }
    await page.screenshot({ path: '../.impeccable/review/beta-' + view + '-' + info.project.name + '.png', fullPage: true });
  }
});
test('personal theme collapses and reopens with keyboard', async ({ page }, info) => {
  await page.goto('/qa/beta-responsive.html?view=profile');
  const section = page.locator('details.profile-personalization');
  const deletion = page.locator('details.profile-delete-account');
  await expect(deletion.locator('.profile-delete-confirmation')).toBeHidden();
  await deletion.locator(':scope > summary').click();
  await expect(deletion.locator('.profile-delete-confirmation')).toBeVisible();
  await expect(deletion.locator('#profile-delete-email')).toBeHidden();
  await deletion.locator(':scope > summary').click();
  const summaryLayout = await section.locator('summary').evaluate(el => ({ display: getComputedStyle(el).display, markerColumn: getComputedStyle(el, '::after').gridColumnStart }));
  expect(summaryLayout).toEqual({ display: 'grid', markerColumn: '2' });
  await expect(section.locator('fieldset')).toBeHidden();
  await section.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(section.locator('fieldset')).toBeVisible();
  await expect(page.locator('.profile-theme-preview')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../.impeccable/review/beta-profile-' + info.project.name + '.png', fullPage: true });
  await section.locator('summary').click();
  await expect(page.locator('.profile-theme-preview')).toBeHidden();
});
test('tablet league options remain inside the scrollable menu', async ({ page }, info) => {
  test.skip(info.project.name !== 'tablet');
  await page.goto('/qa/beta-responsive.html');
  await page.getByRole('button', { name: 'Menü öffnen' }).click();
  await page.locator('.league-switcher__trigger').click();
  await expect(page.locator('.league-switcher__indicator')).toBeVisible();
  const options = page.locator('.league-switcher__options');
  await expect(options).toBeVisible();
  const box = await options.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  expect(await options.evaluate(el => getComputedStyle(el).position)).toBe('static');
  await page.screenshot({ path: '../.impeccable/review/beta-menu-tablet.png' });
  await page.keyboard.press('Escape');
  await expect(options).toHaveCount(0);
});
