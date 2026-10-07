import { expect, test, type BrowserContext } from '@playwright/test';
import { installPublicFixture, publicRacingFixture as f } from './public-fixture';

async function fixture(context: BrowserContext) {
  await installPublicFixture(context);
  const user={id:'91000000-0000-4000-8000-000000000092',email:'draft@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{display_name:'Test Admin',onboarding_complete:true}};
  const exp=Math.floor(Date.now()/1000)+3600;
  const token=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',aal:'aal1',exp})).toString('base64url')}.synthetic`;
  await context.addInitScript(({user,token,exp})=>{
    localStorage.setItem('racevora.locale','de');
    for(const ref of ['nfvwarlowjqphytqqtxz','znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`,JSON.stringify({user,access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer'}));
  },{user,token,exp});
  let discarded=false, failed=false;
  const writes: string[]=[];
  await context.route('https://*.supabase.co/**',async route=>{
    const name=new URL(route.request().url()).pathname.split('/').pop();
    if(name==='user') return route.fulfill({json:user});
    if(name==='current_app_role') return route.fulfill({json:'league_admin'});
    if(name==='get_owner_mfa_status') return route.fulfill({json:{is_owner:false,verified:false}});
    if(name==='league_members') return route.fulfill({json:[{league_id:f.league.id,role:'league_admin'}]});
    if(name==='driver_identities') return route.fulfill({json:{id:user.id,status:'active',profile_number:92}});
    if(name==='get_league_race_admin_workspace') return route.fulfill({json:{league:f.league,seasons:[f.season],races:[{...f.race,current_result_version_id:null}],driver_standings:[],team_standings:[]}});
    if(name==='get_league_driver_admin_workspace') return route.fulfill({json:{league:f.league,drivers:f.drivers,counts:{total:2,active:2,linked:2}}});
    if(name==='get_league_configuration_workspace') return route.fulfill({json:{league:f.league,rules:{},faqs:[],audit:[],result_drafts:discarded?[]:[{id:'test-draft',race_id:f.race.id,race_name:'Japan GP',version_number:1,change_reason:'Ergebnisbilder vom Renntag',row_count:20,status:'validated'}]}});
    if(name==='publish_league_result_draft') {writes.push(name);return route.fulfill({status:400,json:{message:'The affected driver needs a classified result with a valid race time.'}});}
    if(name==='discard_league_result_draft') {
      writes.push(name);
      if(!failed){failed=true;return route.fulfill({status:503,json:{message:'Synthetic outage'}});}
      discarded=true;return route.fulfill({json:{id:'test-draft',race_id:f.race.id,status:'discarded'}});
    }
    if(route.request().url().includes('/rpc/')) return route.fulfill({json:null});
    return route.fallback();
  });
  return writes;
}

test('publication failure keeps the draft and withdrawal confirms, retries, and allows new images',async({page,context},info)=>{
  const writes=await fixture(context);
  await page.goto('/admin/results/import?league=rcc');
  await page.getByRole('button',{name:'Jetzt offiziell freigeben'}).click();
  const panel=page.locator('.result-draft-release');
  await expect(panel.getByRole('alert')).toContainText('Steward-Zeitkorrektur');
  await panel.getByRole('button',{name:'Entwurf verwerfen'}).click();
  expect(writes).toEqual(['publish_league_result_draft']);
  await panel.getByRole('button',{name:'Abbrechen'}).click();
  await panel.getByRole('button',{name:'Entwurf verwerfen'}).click();
  await panel.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('draft-withdraw-confirm.png'),fullPage:true});
  await panel.getByRole('button',{name:'Entwurf verwerfen'}).click();
  await expect(panel.getByRole('alert')).toContainText('bleibt erhalten');
  await panel.getByRole('button',{name:'Entwurf verwerfen'}).click();
  await expect(panel.getByRole('status')).toContainText('Entwurf verworfen');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Keine offenen Entwürfe'})).toBeVisible();
  await page.locator('.result-import-race-row select').selectOption(f.race.id);
  const image=page.locator('input[type="file"][accept*="image/jpeg"]');
  const file={name:'Japan-neu.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jPioAAAAASUVORK5CYII=','base64')};
  await image.setInputFiles(file);
  await expect(page.getByRole('button',{name:'Bilder auslesen',exact:true})).toBeEnabled();
  await image.setInputFiles(file);
  await expect(page.getByText(/Japan-neu.png/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(writes).toEqual(['publish_league_result_draft','discard_league_result_draft','discard_league_result_draft']);
});
