import { expect, test } from '@playwright/test';
import { installPublicFixture, publicRacingFixture as f } from './public-fixture';

test('stewards select both elapsed races without published results and submit the selected race', async ({ page, context }) => {
  await installPublicFixture(context);
  const user = { id: '91000000-0000-4000-8000-000000000091', email: 'steward@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { onboarding_complete: true, display_name: 'Test Steward' } };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', aal: 'aal1', exp })).toString('base64url')}.synthetic`;
  await context.addInitScript(({ user, token, exp }) => {
    localStorage.setItem('racevora.locale', 'de');
    for (const ref of ['nfvwarlowjqphytqqtxz', 'znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`, JSON.stringify({ user, access_token: token, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer' }));
  }, { user, token, exp });
  const races = [
    { ...f.race, id: 'race-1', round_number: 1, grand_prix_name: 'Japan GP', race_date: '2026-10-05', race_time: '20:00', race_start_at: '2026-10-05T18:00:00Z', status: 'upcoming', current_result_version_id: null },
    { ...f.race, id: 'race-2', round_number: 2, grand_prix_name: 'USA GP', race_date: '2026-10-05', race_time: '21:00', race_start_at: '2026-10-05T19:00:00Z', status: 'upcoming', current_result_version_id: null },
    { ...f.race, id: 'future', round_number: 3, race_date: '2026-10-12', race_start_at: '2026-10-12T18:00:00Z', status: 'upcoming', current_result_version_id: null },
    { ...f.race, id: 'cancelled', round_number: 4, status: 'cancelled' },
  ];
  const submitted: Record<string, unknown>[] = [];
  await context.route('https://*.supabase.co/**', async (route) => {
    const request = route.request(), url = new URL(request.url()), table = url.pathname.split('/').pop();
    if (table === 'user') return route.fulfill({ json: user });
    if (table === 'current_app_role') return route.fulfill({ json: 'steward' });
    if (table === 'get_owner_mfa_status') return route.fulfill({ json: { is_owner: false, verified: false } });
    if (table === 'league_members') return route.fulfill({ json: [{ league_id: f.league.id, role: 'steward' }] });
    if (table === 'driver_identities') return route.fulfill({ json: { id: user.id, status: 'active', profile_number: 91 } });
    if (table === 'driver_identity_links') return route.fulfill({ json: [] });
    if (table === 'seasons') return route.fulfill({ json: (request.headers().accept || '').includes('vnd.pgrst.object') ? f.season : [f.season] });
    if (table === 'steward_cases') return route.fulfill({ json: [] });
    if (table === 'races') {
      const rows = url.searchParams.has('current_result_version_id') ? [] : url.searchParams.get('season_id') === `eq.${f.season.id}` ? races : [];
      return route.fulfill({ json: rows });
    }
    if (table === 'create_steward_case') {
      submitted.push(request.postDataJSON());
      return route.fulfill({ json: { id: 'case-1', case_number: 'TEST-1', status: 'under_review' } });
    }
    if (url.pathname.includes('/rpc/')) return route.fulfill({ json: [] });
    return route.fallback();
  });
  await page.clock.setFixedTime(new Date('2026-10-06T00:00:00+02:00'));
  await page.goto('/stewarding?league=rcc');
  await page.locator('.steward-heading button').click();
  const form = page.locator('.steward-form--create');
  const select = form.locator('select[name="race"]');
  await expect(select.locator('option')).toHaveText(['1. Japan GP', '2. USA GP']);
  await select.selectOption('race-2');
  await form.locator('[name="accused"]').selectOption(f.drivers[0].id);
  await form.locator('[name="title"]').fill('Test einer Rennzuordnung');
  await form.locator('[name="description"]').fill('Dieser vollständig simulierte Test legt keinen echten Steward-Fall an.');
  await form.locator('[name="ruleCode"]').fill('TEST-1');
  await form.locator('[name="ruleVersion"]').fill('2026');
  await form.locator('button[type="submit"]').click();
  await expect(form).toHaveCount(0);
  expect(submitted).toHaveLength(1);
  expect(submitted[0].p_race_id).toBe('race-2');
  expect(submitted[0].p_accused_driver_id).toBe(f.drivers[0].id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
