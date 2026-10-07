import { expect, test } from '@playwright/test';
import { installPublicFixture, publicRacingFixture as f } from './public-fixture';

for (const mode of ['draft','time_penalty','time_credit','grid_penalty','no_action','retry','self_credit','self_draft'] as const) test(`simplified steward workflow: ${mode}`, async ({ page, context }, testInfo) => {
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
    if (table === 'record_steward_decision') {
      submitted.push(request.postDataJSON());
      if (mode === 'retry' && submitted.length === 1) return route.fulfill({ status: 503, json: { message: 'Synthetic response interruption' } });
      return route.fulfill({ json: { id:'decision-1',case_id:'case-1',result_version_id:null } });
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
  await form.locator('[name="reporter"]').selectOption(f.drivers[mode.startsWith('self_') ? 0 : 1].id);
  await form.locator('[name="title"]').fill('Test einer Rennzuordnung');
  await form.locator('[name="reasoning"]').fill('Dieser vollständig simulierte Test legt keinen echten Steward-Fall an.');
  await expect(form.locator('[name="ruleCode"]')).toHaveCount(0);
  await expect(page.getByText('Stimme abgeben', { exact:true })).toHaveCount(0);
  if (mode === 'draft' || mode === 'self_draft') await form.getByRole('button', { name: 'Als offenen Fall speichern' }).click();
  else {
    await form.locator('[name="penaltyType"]').selectOption(mode === 'retry' ? 'time_penalty' : mode === 'self_credit' ? 'time_credit' : mode);
    if (mode === 'grid_penalty') await expect(form).toContainText('3.');
    if (mode.startsWith('time_')) await expect(form).toContainText('vorgemerkt');
    if (mode !== 'no_action') await form.locator('[name="amount"]').fill(mode === 'self_credit' ? '10' : '5');
    await form.locator('[name="confirmed"]').check();
    if (mode === 'time_penalty') {
      await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0,0); });
      await page.screenshot({ path:testInfo.outputPath('steward-form.png'),fullPage:true });
    }
    await form.getByRole('button', { name:'Entscheidung veröffentlichen' }).click();
    if (mode === 'retry') {
      await expect(page.getByRole('alert')).toContainText('nicht gespeichert');
      await form.getByRole('button', { name:'Entscheidung veröffentlichen' }).click();
      expect(submitted[0].p_idempotency_key).toBe(submitted[1].p_idempotency_key);
    }
  }
  await expect(form).toHaveCount(0);
  expect(submitted).toHaveLength(mode === 'retry' ? 2 : 1);
  expect(submitted[0].p_race_id).toBe('race-2');
  expect(submitted[0].p_accused_driver_id).toBe(f.drivers[0].id);
  expect(submitted[0].p_reported_driver_id).toBe(f.drivers[mode.startsWith('self_') ? 0 : 1].id);
  if (mode !== 'draft' && mode !== 'self_draft') {
    expect(submitted[0].p_penalty_type).toBe(mode === 'retry' ? 'time_penalty' : mode === 'self_credit' ? 'time_credit' : mode);
    expect(submitted[0].p_target_race_id).toBe(mode === 'grid_penalty' ? 'future' : null);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('case deletion confirms effects, preserves failed input, and removes the case after retry', async ({ page, context }, testInfo) => {
  await installPublicFixture(context);
  const user = { id: '91000000-0000-4000-8000-000000000091', email: 'steward@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { onboarding_complete: true } };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub:user.id,role:'authenticated',aal:'aal1',exp })).toString('base64url')}.synthetic`;
  await context.addInitScript(({ user,token,exp }) => {
    localStorage.setItem('racevora.locale','de');
    for (const ref of ['nfvwarlowjqphytqqtxz','znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`,JSON.stringify({ user,access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer' }));
  },{user,token,exp});
  const item = { id:'case-delete',race_id:f.race.id,case_number:'TEST-DELETE',title:'Falsche Spielstrafe',description:'Zehn Sekunden zu Unrecht im Spiel erhalten.',status:'closed',reported_driver_id:f.drivers[0].id,accused_driver_id:f.drivers[0].id,current_decision_version:1,created_at:'2026-10-06T12:00:00Z',closed_at:'2026-10-06T12:00:00Z' };
  let removed = false;
  const submitted: unknown[] = [];
  await context.route('https://*.supabase.co/**',async route => {
    const request=route.request(), url=new URL(request.url()), table=url.pathname.split('/').pop();
    if(table==='user') return route.fulfill({json:user});
    if(table==='current_app_role') return route.fulfill({json:'steward'});
    if(table==='get_owner_mfa_status') return route.fulfill({json:{is_owner:false,verified:false}});
    if(table==='league_members') return route.fulfill({json:[{league_id:f.league.id,role:'steward'}]});
    if(table==='driver_identities') return route.fulfill({json:{id:user.id,status:'active',profile_number:91}});
    if(table==='driver_identity_links') return route.fulfill({json:[]});
    if(table==='steward_cases') return route.fulfill({json:removed?[]:[item]});
    if(table==='steward_decision_versions') return route.fulfill({json:[{id:'decision-delete',case_id:item.id,version_number:1,outcome:'penalty',reasoning:item.description,finalized_at:item.closed_at,result_version_id:null}]});
    if(table==='steward_penalties') return route.fulfill({json:[{id:'penalty-delete',decision_version_id:'decision-delete',penalty_type:'time_credit',time_delta_ms:-10000,reason:item.description}]});
    if(table==='delete_steward_case') {
      submitted.push(request.postDataJSON());
      if(submitted.length===1) return route.fulfill({status:503,json:{message:'Synthetic network interruption'}});
      removed=true; return route.fulfill({json:{id:item.id,deleted:true,result_version_id:'corrected-result'}});
    }
    if(url.pathname.includes('/rpc/')) return route.fulfill({json:[]});
    return route.fallback();
  });
  await page.goto('/stewarding?league=rcc');
  await page.getByRole('button',{name:'Fall löschen',exact:true}).click();
  const form=page.getByRole('form',{name:'Fall löschen'});
  await expect(form).toContainText('Platzierungen und Punkte werden neu berechnet');
  await form.getByRole('button',{name:'Abbrechen'}).click();
  expect(submitted).toHaveLength(0);
  await page.getByRole('button',{name:'Fall löschen',exact:true}).click();
  await form.locator('[name="deleteReason"]').fill('Die Zeitgutschrift wurde versehentlich doppelt eingetragen.');
  await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0,0); });
  await page.screenshot({path:testInfo.outputPath('steward-delete-confirmation.png'),fullPage:true});
  await form.getByRole('button',{name:'Fall und Auswirkungen löschen',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Löschung konnte nicht bestätigt');
  await expect(form.locator('[name="deleteReason"]')).toHaveValue('Die Zeitgutschrift wurde versehentlich doppelt eingetragen.');
  await form.getByRole('button',{name:'Fall und Auswirkungen löschen',exact:true}).click();
  await expect(page.locator('.workspace-message[role="status"]')).toHaveText('Fall gelöscht und seine Auswirkungen zurückgenommen.');
  await expect(page.locator('.case-row')).toHaveCount(0);
  expect(submitted).toHaveLength(2);
  expect(submitted[0]).toEqual(submitted[1]);
  expect(submitted[0]).toMatchObject({p_case_id:item.id,p_expected_decision_version:1,p_expected_result_version_id:f.race.current_result_version_id});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('race shows pending and applied decisions plus incoming grid penalties', async ({ page, context }) => {
  await installPublicFixture(context);
  await context.route('**/rest/v1/steward_cases?**', route => route.fulfill({ json: [
    { id:'pending',title:'Pending time decision',description:'Incident',reported_driver_id:f.drivers[1].id,accused_driver_id:f.drivers[0].id,status:'closed' },
    { id:'applied',title:'Applied time decision',description:'Incident',reported_driver_id:f.drivers[0].id,accused_driver_id:f.drivers[1].id,status:'closed' },
  ] }));
  await context.route('**/rest/v1/steward_decision_versions?**', route => route.fulfill({ json: [
    { id:'decision-1',case_id:'pending',outcome:'penalty',reasoning:'Vorgemerkte Entscheidung aus externer Besprechung.' },
    { id:'decision-2',case_id:'applied',outcome:'penalty',reasoning:'Bereits angewendete Entscheidung.' },
  ] }));
  await context.route('**/rest/v1/steward_penalties?**', route => route.fulfill({ json: new URL(route.request().url()).searchParams.has('target_race_id')
    ? [{id:'grid',driver_id:f.drivers[0].id,grid_positions:3,reason:'Drei Startplätze zurück.'}]
    : [{id:'penalty-1',decision_version_id:'decision-1',penalty_type:'time_penalty',time_delta_ms:5000},
       {id:'penalty-2',decision_version_id:'decision-2',penalty_type:'time_credit',time_delta_ms:-3000}] }));
  await context.route('**/rest/v1/steward_penalty_applications?**', route => route.fulfill({json:[{penalty_id:'penalty-2',result_version_id:f.race.current_result_version_id}]}));
  await page.goto(`/racing/races/detail?league=rcc&demo=1&round=1&season=${f.season.id}`);
  const panel = page.locator('.race-detail-panels > section').last();
  await expect(panel).toContainText('Strafversetzungen für dieses Rennen');
  await expect(panel).toContainText('Test Driver 1 · 3 Startplätze zurück');
  await expect(panel).toContainText('Vorgemerkt · wartet auf Ergebnisveröffentlichung');
  await expect(panel).toContainText('Im Ergebnis angewendet');
  await expect(panel).toContainText('Zeitstrafe · +5 s');
  await expect(panel).toContainText('Zeitgutschrift · −3 s');
  await expect(panel).toContainText('Einreichender Fahrer: Test Driver 2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
