import { expect, test, type BrowserContext } from '@playwright/test';
import { installPublicFixture, publicRacingFixture } from './public-fixture';

async function fixture(context: BrowserContext, fail = false) {
  await installPublicFixture(context);
  const user = { id: '91000000-0000-4000-8000-000000000075', email:'alias@example.invalid', aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{display_name:'Aaron',onboarding_complete:true} };
  const exp = Math.floor(Date.now()/1000)+3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub:user.id,role:'authenticated',aal:'aal1',exp })).toString('base64url')}.synthetic`;
  await context.addInitScript(({user,token,exp}) => {
    localStorage.setItem('racevora.locale','de');
    for(const ref of ['nfvwarlowjqphytqqtxz','znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`,JSON.stringify({user,access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer'}));
  },{user,token,exp});
  let aliases = [{id:'alias-personal',alias:'D4RK',platform:'ea',editable:true,scope:'personal'}];
  const writes: Record<string,unknown>[]=[];
  const drivers = publicRacingFixture.drivers.map(d=>({...d,ai_driver_reference:null,identity_linked:true,result_count:14}));
  const response = (admin:boolean) => ({main:'Darkqz',aliases:aliases.map(a=>({...a,editable:admin?a.scope==='league':a.scope==='personal'}))});
  await context.route('https://*.supabase.co/**',async route=>{
    const name = new URL(route.request().url()).pathname.split('/').pop();
    const body = route.request().method()==='POST' ? route.request().postDataJSON() : {};
    if(name==='user') return route.fulfill({json:user});
    if(name==='current_app_role') return route.fulfill({json:'league_admin'});
    if(name==='get_owner_mfa_status') return route.fulfill({json:{is_owner:false,verified:false}});
    if(name==='driver_identities') return route.fulfill({json:{id:user.id,status:'active',profile_number:75,gamertag:'Darkqz'}});
    if(name==='league_members') return route.fulfill({json:[{league_id:publicRacingFixture.league.id,role:'league_admin'}]});
    if(name==='get_league_driver_admin_workspace') return route.fulfill({json:{league:publicRacingFixture.league,drivers,counts:{total:2,active:2,linked:2},active_season:null,ai_drivers:[],ai_assignments:[]}});
    if(name==='get_league_roster_workspace') return route.fulfill({json:{season_id:null,races:[],vehicles:[],substitutions:[]}});
    if(name==='get_league_team_directory') return route.fulfill({json:{teams:[],preferences:[],profiles:drivers}});
    if(name==='get_driver_gamertags') return route.fulfill({json:response(Boolean(body.p_driver_id))});
    if(name==='add_driver_gamertag') {
      writes.push(body);
      if(fail) {fail=false;return route.fulfill({status:503,json:{message:'Synthetic failure'}});}
      aliases.push({id:'alias-added',alias:body.p_alias,platform:body.p_platform,scope:body.p_driver_id?'league':'personal',editable:true});
      return route.fulfill({json:response(Boolean(body.p_driver_id))});
    }
    if(name==='remove_driver_gamertag') { writes.push(body);aliases=aliases.filter(a=>a.id!==body.p_alias_id);return route.fulfill({json:response(Boolean(body.p_driver_id))}); }
    if(route.request().url().includes('/rpc/')) return route.fulfill({json:null});
    return route.fallback();
  });
  return writes;
}

test('personal aliases add, persist after reload and remove without changing the main name',async({page,context},info)=>{
  const writes=await fixture(context);
  await page.goto('/profile');
  await page.getByText('Weitere Gamertags',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Entfernen D4RK'})).toBeVisible();
  await page.getByLabel('Weiterer Gamertag',{exact:true}).fill('Fabiylolboi');
  await page.getByLabel('Plattform (optional)').selectOption('steam');
  await page.getByRole('button',{name:'Gamertag hinzufügen'}).click();
  await expect(page.getByText('Gamertag gespeichert.',{exact:true})).toBeVisible();
  expect(writes[0]).toEqual({p_alias:'Fabiylolboi',p_platform:'steam'});
  await page.reload(); await page.getByText('Weitere Gamertags',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Entfernen Fabiylolboi'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`.impeccable/review/aliases-profile-${info.project.name}.png`,fullPage:true});
  await page.getByRole('button',{name:'Entfernen Fabiylolboi'}).click();
  await expect(page.getByRole('button',{name:'Entfernen Fabiylolboi'})).toHaveCount(0);
  await expect(page.getByText('Haupt-Gamertag:')).toContainText('Darkqz');
});

test('failed save keeps input and can be retried',async({page,context})=>{
  await fixture(context,true);await page.goto('/profile');
  await page.getByText('Weitere Gamertags',{exact:true}).click();
  await page.getByLabel('Weiterer Gamertag',{exact:true}).fill('Fabiylolboi');
  await page.getByRole('button',{name:'Gamertag hinzufügen'}).click();
  await expect(page.getByRole('alert')).toContainText('Änderung nicht bestätigt');
  await expect(page.getByLabel('Weiterer Gamertag',{exact:true})).toHaveValue('Fabiylolboi');
  await page.getByRole('button',{name:'Gamertag hinzufügen'}).click();
  await expect(page.getByText('Gamertag gespeichert.',{exact:true})).toBeVisible();
});

test('league management edits local aliases without editing personal ones',async({page,context},info)=>{
  const writes=await fixture(context);await page.goto('/admin/drivers');
  await page.getByRole('button',{name:'Bearbeiten',exact:true}).first().click();
  await page.getByText('Weitere Gamertags · Test Driver 1',{exact:true}).click();
  await expect(page.getByText('Im persönlichen Profil verwalten',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Entfernen D4RK'})).toHaveCount(0);
  await page.getByLabel('Weiterer Gamertag',{exact:true}).fill('Fabiylolboi');
  await page.getByRole('button',{name:'Gamertag hinzufügen'}).click();
  await expect(page.getByText('Gamertag gespeichert.',{exact:true})).toBeVisible();
  expect(writes[0].p_driver_id).toBe(publicRacingFixture.drivers[0].id);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
  await page.screenshot({path:`.impeccable/review/aliases-admin-${info.project.name}.png`,fullPage:true});
});
