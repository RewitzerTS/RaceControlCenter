import { expect, test } from '@playwright/test';
import { installPublicFixture, publicRacingFixture as f, confirmedNameFixture } from './public-fixture';

test('closed cases prefill decisions, preserve failed corrections, retry safely and retain history', async ({ page, context }, info) => {
  await installPublicFixture(context);
  const user = { id:'91000000-0000-4000-8000-000000000091',email:'steward@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{onboarding_complete:true} };
  const exp = Math.floor(Date.now()/1000)+3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',aal:'aal1',exp})).toString('base64url')}.synthetic`;
  await context.addInitScript(({user,token,exp}) => {
    localStorage.setItem('racevora.locale','de');
    for(const ref of ['nfvwarlowjqphytqqtxz','znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`,JSON.stringify({user,access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer'}));
  },{user,token,exp});
  let version=1;
  const original = {driver_id:f.drivers[0].id,penalty_type:'time_penalty',amount:10,target_race_id:null,reasoning:'Ursprünglich wurden zehn Sekunden vergeben.'};
  const requests: Record<string,any>[]=[];
  const item = () => ({id:'case-correct',race_id:f.race.id,case_number:'TEST-CORRECT',title:version===1?'Prüfung eines Vorfalls':'Korrigierter Vorfall',description:'Zehn Sekunden wurden nach dem Rennen vergeben.',status:'closed',reported_driver_id:f.drivers[1].id,accused_driver_id:f.drivers[0].id,current_decision_version:version,created_at:'2026-10-06T12:00:00Z',closed_at:'2026-10-06T12:00:00Z'});
  await context.route('https://*.supabase.co/**', async route => {
    const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop();
    if(table==='user') return route.fulfill({json:user});
    if(table==='get_my_name_settings') return route.fulfill({json:confirmedNameFixture});
    if(table==='get_owner_mfa_status') return route.fulfill({json:{is_owner:false,verified:false}});
    if(table==='current_app_role') return route.fulfill({json:'steward'});
    if(table==='league_members') return route.fulfill({json:[{league_id:f.league.id,role:'steward'}]});
    if(table==='driver_identities') return route.fulfill({json:{id:user.id,status:'active',profile_number:91}});
    if(table==='driver_identity_links') return route.fulfill({json:[]});
    if(table==='steward_cases') return route.fulfill({json:[item()]});
    if(table==='steward_decision_versions') return route.fulfill({json:Array.from({length:version},(_,i)=>({id:`decision-${version-i}`,case_id:item().id,version_number:version-i,outcome:version-i===1?'penalty':'dismissed',reasoning:item().description,finalized_at:item().closed_at,result_version_id:null,steward_driver_decisions:version-i===1?[original]:requests.at(-1)!.p_decisions}))});
    if(table==='steward_penalties') return route.fulfill({json:[{id:'penalty-original',decision_version_id:'decision-1',driver_id:f.drivers[0].id,penalty_type:'time_penalty',time_delta_ms:10000,reason:original.reasoning}]});
    if(table==='correct_steward_group_case') {
      requests.push(req.postDataJSON());
      if(requests.length===1) return route.fulfill({status:503,json:{message:'Synthetic interrupted response'}});
      version=2;return route.fulfill({json:{id:'decision-2',case_id:item().id,result_version_id:'corrected-result'}});
    }
    if(url.pathname.includes('/rpc/')) return route.fulfill({json:[]});
    return route.fallback();
  });
  await page.goto('/stewarding?league=rcc');
  await page.getByRole('button',{name:'Fall bearbeiten',exact:true}).click();
  const form=page.locator('.simple-steward-form');
  await expect(form.locator('[name^="penaltyType-"]')).toHaveValue('time_penalty');
  await expect(form.locator('[name^="amount-"]')).toHaveValue('10');
  await expect(form.locator('[name^="reason-"]')).toHaveValue(original.reasoning);
  await form.locator('[name="title"]').fill('Korrigierter Vorfall');
  await form.locator('[name^="penaltyType-"]').selectOption('dismissed');
  await expect(form.locator('[name^="amount-"]')).toHaveCount(0);
  await form.locator('[name^="reason-"]').fill('Neue Beweise zeigen, dass kein Verstoß vorlag.');
  await form.locator('[name="correctionReason"]').fill('Die Onboard-Aufnahme wurde erneut geprüft.');
  await form.locator('[name="confirmed"]').check();
  await form.getByRole('button',{name:'Korrektur veröffentlichen'}).click();
  await expect(form.getByRole('alert')).toContainText('nicht gespeichert');
  await expect(form.locator('[name="title"]')).toHaveValue('Korrigierter Vorfall');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('steward-correction.png'),fullPage:true});
  await form.getByRole('button',{name:'Korrektur veröffentlichen'}).click();
  await expect(form).toHaveCount(0);
  await expect(page.locator('.workspace-message[role="status"]')).toContainText('Korrektur veröffentlicht');
  await expect(page.locator('.simple-decision').first()).toContainText('Aktuelle Entscheidung · 2');
  await expect(page.locator('.simple-decision').first()).toContainText('Abgelehnt');
  await expect(page.locator('.simple-decision').last()).toContainText('Frühere Entscheidungen · 1');
  expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);
  expect(requests[1]).toMatchObject({p_expected_decision_version:1,p_expected_result_version_id:f.race.current_result_version_id,p_case_id:'case-correct',p_title:'Korrigierter Vorfall',p_decisions:[{driver_id:f.drivers[0].id,penalty_type:'dismissed',amount:null,target_race_id:null}]});
});
