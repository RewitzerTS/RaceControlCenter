import { expect, test } from '@playwright/test';
test.beforeEach(async ({ context }) => { await context.route('https://*.supabase.co/**', (route) => route.abort()); });
test('select, confirm and refresh the exact member without horizontal overflow', async ({ page }, info) => {
  await page.goto('/qa/member-link.html');
  await page.getByRole('button', { name: 'Fahrer verknüpfen', exact: true }).click();
  await page.getByLabel('Bestehender Fahrer').selectOption('qa-driver');
  await expect(page.getByText(/Du verknüpfst/)).toContainText('fahrer.mit.langem.namen@example.test');
  const contrast = await page.getByRole('button', { name: 'Verknüpfung bestätigen' }).evaluate((button) => {
    const style = getComputedStyle(button);
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const a = luminance(style.color), b = luminance(style.backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: `../.impeccable/review/member-link-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => [...document.querySelectorAll('main *')].filter((element) => element.getBoundingClientRect().right > innerWidth + 1).map((element) => `${element.tagName}.${element.className}`))).toEqual([]);
  await page.getByRole('button', { name: 'Verknüpfung bestätigen' }).click();
  await expect(page.getByText('RCC Fahrer mit langem Anzeigenamen', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fahrer verknüpfen', exact: true })).toHaveCount(0);
});
test('conflict explains recovery without clearing selection', async ({ page }) => {
  await page.goto('/qa/member-link.html?conflict=1');
  await page.getByRole('button', { name: 'Fahrer verknüpfen', exact: true }).click();
  await page.getByLabel('Bestehender Fahrer').selectOption('qa-driver');
  await page.getByRole('button', { name: 'Verknüpfung bestätigen' }).click();
  await expect(page.getByRole('alert')).toContainText('anderen Konto');
  await expect(page.getByLabel('Bestehender Fahrer')).toHaveValue('qa-driver');
  await page.getByRole('button', { name: 'Auswahl neu laden' }).click();
  await expect(page.getByLabel('Bestehender Fahrer')).toHaveValue('');
});
test('empty selection can be cancelled with keyboard focus restored', async ({ page }) => {
  await page.goto('/qa/member-link.html?empty=1');
  await page.getByRole('button', { name: 'Fahrer verknüpfen', exact: true }).click();
  await expect(page.getByText('Keine unverknüpften Fahrer in dieser Liga vorhanden.')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fahrer verknüpfen', exact: true })).toBeFocused();
});
