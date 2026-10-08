import { expect, test, type BrowserContext } from '@playwright/test';
import { installPublicFixture, publicRacingFixture as f } from './public-fixture';
import venues from '../src/driver/venueMedia.json' with { type: 'json' };

async function fixture(context: BrowserContext, count = 3) {
 await installPublicFixture(context);
 const user={id:'91000000-0000-4000-8000-000000000087',email:'race-day@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{onboarding_complete:true,display_name:'Race Day Test'}};
 const exp=Math.floor(Date.now()/1000)+3600;
 const token=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',aal:'aal1',exp})).toString('base64url')}.synthetic`;
 await context.addInitScript(({user,token,exp})=>{
  localStorage.setItem('racevora.locale','de');
  for(const ref of ['nfvwarlowjqphytqqtxz','znnkwjogtvzwfkwnmawp']) localStorage.setItem(`racevora-v2:${ref}:auth`,JSON.stringify({user,access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer'}));
 },{user,token,exp});
 let unread=3;
 const requests: URL[]=[];
 await context.route('https://*.supabase.co/**',async route=>{
  const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').pop();
  requests.push(url);
  if(name==='user') return route.fulfill({json:user});
  if(name==='current_app_role')return route.fulfill({json:'driver'});
  if(name==='get_owner_mfa_status')return route.fulfill({json:{is_owner:false,verified:false}});
  if(name==='league_members')return route.fulfill({json:[{league_id:f.league.id,role:'driver'}]});
  if(name==='driver_identities')return route.fulfill({json:{id:user.id,status:'active',profile_number:87}});
  if(name==='driver_identity_links')return route.fulfill({json:[{driver_id:f.drivers[0].id,driver:{league_id:f.league.id}}]});
  if(name==='seasons')return route.fulfill({json:[{...f.season,archived_at:null}]});
  if(name==='season_driver_assignments')return route.fulfill({json:[]});
  if(name==='races')return route.fulfill({json:[...Array.from({length:count},(_,i)=>({...f.race,id:'race-'+i,grand_prix_name:['Monaco GP','Japan GP','Great Britain GP'][i],circuit_name:['Circuit de Monaco','Suzuka International Racing Course','Silverstone Circuit'][i],round_number:i+1,race_date:'2099-10-05',race_time:(20+i)+':00',race_start_at:null,status:'upcoming',current_result_version_id:null})),{...f.race,id:'later',race_date:'2099-10-12',grand_prix_name:'Later GP'}]});
  if(name==='driver_career_stats'||name==='driver_progression'||name==='driver_wallets')return route.fulfill({json:null});
  if(name==='user_notifications') {
    if(request.method()==='HEAD') return route.fulfill({status:200,headers:{'content-range':`*/${unread}`,'access-control-expose-headers':'content-range'},body:''});
    return route.fulfill({json:[{id:'notification-1',notification_kind:'career_moment',title_key:'notification.levelUp.title',body_key:'notification.levelUp.body',payload:{event_type:'career.level_up',level:5},created_at:'2026-10-05T18:00:00Z',read_at:null}]});
  }
  if(name==='mark_notification_read'){unread--;return route.fulfill({json:null});}
  if(url.pathname.includes('/rpc/'))return route.fulfill({json:[]});
  return route.fallback();
 });
 return {requests};
}

test('compact next-day carousel exposes all races and track links; bell updates after reading', async ({page,context},info)=>{
 const {requests}=await fixture(context);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/home?league=rcc');
 const carousel=page.locator('.race-day');
 await expect(carousel).toContainText('Rennen 1 von 3');
 await expect(carousel.locator('h2')).toHaveText('Monaco GP');
 await expect(carousel.locator('.race-day-photo')).toHaveAttribute('src','/assets/race-art/20261006/monaco-blue-hour-v1.webp');
 await expect(carousel.locator('.race-day-credit')).toHaveText('RaceVora · KI-generierte Illustration');
 await expect(carousel.locator('.race-day-credit a')).toHaveCount(0);
 await expect(carousel.locator('.race-day-photo')).toHaveJSProperty('complete',true);
 await expect(carousel.locator('.race-day-photo')).not.toHaveJSProperty('naturalWidth',0);
 await expect(carousel.locator('.race-day-map img')).not.toHaveJSProperty('naturalWidth',0);
 await expect(page.locator('.hero-main > .race-day')).toBeVisible();
 await expect(page.locator('.hero-main > .hero-topline')).toHaveCount(0);
 await expect(carousel.getByRole('link',{name:'Streckenprofil',exact:true})).toHaveAttribute('href',`/racing/tracks/profile?league=rcc&season=${f.season.id}&track=monaco`);
 const bounds=await carousel.boundingBox();
 expect(bounds?.height).toBeLessThan(400);
 await expect(carousel.locator('.race-day-dot')).toHaveCount(3);
 await expect(carousel.locator('.race-day-controls, .race-day-races')).toHaveCount(0);
 const dots=await carousel.locator('.race-day-dots').boundingBox();
 expect(dots!.x+dots!.width/2).toBeCloseTo(bounds!.x+bounds!.width/2,0);
 expect(dots!.y+dots!.height).toBeLessThanOrEqual(bounds!.y+bounds!.height);
 if(info.project.name==='desktop') {
  const dashboard=await page.locator('.dashboard-hero').boundingBox();
  expect(bounds!.width).toBeLessThan(dashboard!.width*.6);
 }
 await expect(carousel).not.toContainText('Later GP');
 expect(requests.find(u=>u.pathname.endsWith('/seasons'))?.searchParams.get('league_id')).toBe('eq.'+f.league.id);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(process.env.RACEVORA_CAPTURE_UI==='1') await page.screenshot({path:`../.impeccable/review/screenshots/home-compact-${info.project.name}.png`,fullPage:true});
 await carousel.locator('.race-day-dot').nth(1).click();
 await expect(carousel.locator('h2')).toHaveText('Japan GP');
 await expect(carousel.locator('.race-day-photo')).toHaveAttribute('src','/assets/race-art/20261006/japan-v1.webp');
 await expect(carousel.locator('.race-day-photo')).not.toHaveJSProperty('naturalWidth',0);
 if(process.env.RACEVORA_CAPTURE_UI==='1') await page.screenshot({path:`../.impeccable/review/screenshots/home-art-day-${info.project.name}.png`,fullPage:true});
 await expect(carousel.locator('.race-day-open')).toHaveAttribute('href',/track=japan/);
 await carousel.focus(); await page.keyboard.press('ArrowRight');
 await expect(carousel.locator('h2')).toHaveText('Great Britain GP');
 await expect(carousel.locator('.race-day-open')).toHaveAttribute('href',/track=great-britain/);
 await carousel.evaluate(el => {
   const from=new Touch({identifier:1,target:el,clientX:250,clientY:100});
   const to=new Touch({identifier:1,target:el,clientX:100,clientY:105});
   el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[from]}));
   el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[to]}));
 });
 await expect(carousel.locator('h2')).toHaveText('Monaco GP');
 await carousel.getByRole('link',{name:'Streckenprofil',exact:true}).click();
 await expect(page).toHaveURL(/\/racing\/tracks\/profile\?.*track=monaco/);
 await expect(page.locator('.profile-identity h2')).toHaveText('Monaco GP');
 await expect(page.locator('.history-facts')).toContainText('3,337');
 await page.goto('/home?league=rcc');
 await expect(carousel.locator('h2')).toHaveText('Monaco GP');
 const bell=page.getByRole('link',{name:'Benachrichtigungen: 3 ungelesen',exact:true});
 await expect(bell).toBeVisible(); await bell.click();
 await expect(page.locator('.notification-list')).toContainText('Du hast Level 5 erreicht.');
 await page.locator('.notification-list a').click();
 await expect(page.getByRole('link',{name:'Benachrichtigungen: 2 ungelesen',exact:true})).toBeVisible();
 const countQuery=requests.find(u=>u.pathname.endsWith('/user_notifications')&&u.searchParams.get('read_at'));
 expect(countQuery?.searchParams.get('recipient_user_id')).toBe('eq.91000000-0000-4000-8000-000000000087');
});

test('varied challenges are readable on Home and Career without the redundant hero label',async({page,context},info)=>{
 await fixture(context);
 const metrics=['top_ten','top_five','positions_gained','gain_three','comeback_top_ten','hold_position'];
 const labels=['Top-10-Zieleinläufe','Top-5-Zieleinläufe','Gewonnene Plätze (Start → Ziel)','Rennen mit mindestens 3 gewonnenen Plätzen','Von außerhalb der Top 10 in die Top 10','Zielplatz mindestens so gut wie Startplatz'];
 let batch=0;
 await context.route('**/rest/v1/challenge_definitions*',route=>route.fulfill({json:metrics.slice(batch*3,batch*3+3).map((metric,i)=>({code:metric,metric,target_value:1,reward_vc:100+i*50,sort_order:i+1,active_from:'2026-01-01T00:00:00Z',active_until:'2099-01-01T00:00:00Z'}))}));
 for(batch=0;batch<2;batch++) {
  for(const route of ['/home','/career']) {
   await page.goto(route+'?league=rcc');
   const panel=page.locator('.challenge-panel');
   for(const label of labels.slice(batch*3,batch*3+3)) await expect(panel).toContainText(label);
   await expect(panel.locator('.challenge-list > li')).toHaveCount(3);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(route==='/home') {
    await expect(page.locator('.hero-topline')).toHaveCount(0);
    if(batch===1) {
     await page.locator('.hero-main').screenshot({path:info.outputPath('home-without-kicker.png')});
     await panel.screenshot({path:info.outputPath('varied-challenges.png')});
    }
   }
  }
 }
});

test('four-second rotation has working pause, hover, manual selection and reduced-motion controls',async({page,context},info)=>{
 await fixture(context);
 await page.goto('/home?league=rcc');
 const carousel=page.locator('.race-day');
 await carousel.scrollIntoViewIfNeeded();
 await expect(carousel.getByRole('button',{name:/Automatischen Wechsel pausieren/})).toBeVisible();
 await page.clock.install();
 await page.mouse.move(1,1);
 await page.clock.runFor(4000);
 await expect(carousel.locator('h2')).toHaveText('Japan GP');
 await carousel.hover();
 await page.clock.runFor(8000);
 await expect(carousel.locator('h2')).toHaveText('Japan GP');
 await page.mouse.move(1,1);
 await page.clock.runFor(4000);
 await expect(carousel.locator('h2')).toHaveText('Great Britain GP');
 await carousel.getByRole('button',{name:/Automatischen Wechsel pausieren/}).click();
 await page.mouse.move(1,1); await page.clock.runFor(8000);
 await expect(carousel.locator('h2')).toHaveText('Great Britain GP');
 await carousel.locator('.race-day-dot').nth(0).click();
 await expect(carousel.locator('h2')).toHaveText('Monaco GP');
 await page.mouse.move(1,1); await page.clock.runFor(4000);
 await expect(carousel.locator('h2')).toHaveText('Monaco GP');
 await carousel.getByRole('button',{name:/Automatischen Wechsel starten/}).click();
 await page.mouse.move(1,1); await page.clock.runFor(4000);
 await expect(carousel.locator('h2')).toHaveText('Japan GP');
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(carousel.locator('.race-day-playback')).toHaveCount(0);
 await page.clock.runFor(8000);
 await expect(carousel.locator('h2')).toHaveText('Japan GP');
 await page.screenshot({path:info.outputPath('home-navigation-carousel.png'),fullPage:true});
});

test('slider controls inherit personal color tokens at intermediate width',async({page,context},info)=>{
 await fixture(context); await page.setViewportSize({width:768,height:1024}); await page.goto('/home?league=rcc');
 const action=page.locator('.race-day-open');
 await expect(action).toBeVisible();
 for(const primary of ['#C7A24E','#FF87BC']) {
  await page.evaluate(primary=>{
   const root=document.documentElement;
   root.style.setProperty('--brand-primary',primary);
   root.style.setProperty('--brand-on-primary','#111318');
   root.style.setProperty('--brand-action-gradient',`linear-gradient(90deg, ${primary}, ${primary})`);
  },primary);
  const style=await action.evaluate(el=>({bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color,gradient:getComputedStyle(el).backgroundImage}));
  const expected=primary==='#C7A24E'?'rgb(199, 162, 78)':'rgb(255, 135, 188)';
  expect(style.bg).toBe(expected); expect(style.fg).toBe('rgb(17, 19, 24)'); expect(style.gradient).toContain(expected);
  await expect(page.locator('.race-day-dot[aria-pressed="true"] > span')).toHaveCSS('background-color',expected);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(process.env.RACEVORA_CAPTURE_UI==='1'&&info.project.name==='desktop') await page.screenshot({path:'../.impeccable/review/screenshots/home-compact-tablet.png',fullPage:true});
});

test('slides crossfade with a small directional move, fixed controls and a reduced-motion fallback',async({page,context},info)=>{
 await fixture(context); await page.goto('/home?league=rcc');
 const carousel=page.locator('.race-day');
 const next=carousel.locator('.race-day-dot').nth(1);
 await expect(carousel.locator('h2')).toHaveText('Monaco GP');
 await expect(carousel).not.toContainText('Streckenschema');
 await expect(carousel.locator('.race-day-map figcaption')).toContainText('3,337');
 await expect(carousel.locator('.race-day-open')).toHaveCSS('border-radius','999px');
 const before=await next.boundingBox();
 await next.click();
 await expect(carousel.locator('h2')).toHaveText('Japan GP');
 const animations=await carousel.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a instanceof CSSAnimation).map(a=>{a.pause();a.currentTime=140;return (a as CSSAnimation).animationName;}));
 expect(animations).toContain('race-photo-crossfade'); expect(animations).toContain('race-content-arrive');
 const opacity=await carousel.locator('.race-day-photo').evaluate(el=>Number(getComputedStyle(el).opacity));
 expect(opacity).toBeGreaterThan(0);expect(opacity).toBeLessThan(1);
 await expect(carousel.locator('.race-day-photo-outgoing')).toHaveAttribute('aria-hidden','true');
 expect((await next.boundingBox())!.y).toBeCloseTo(before!.y,0);
 await expect(next).toBeFocused();
 await carousel.screenshot({path:info.outputPath('slide-crossfade-midpoint.png'),animations:'allow'});
 await carousel.evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>a.finish()));
 await expect(carousel.locator('.race-day-photo-outgoing')).toHaveCount(0);
 await carousel.locator('.race-day-dot').nth(0).click();
 await expect(carousel).toHaveCSS('--race-slide-direction','-1');
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(carousel.locator('.race-day-photo-outgoing')).toHaveCount(0);
 await next.click();
 await expect(carousel.locator('.race-day-content')).toHaveCSS('animation-name','none');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('unmapped circuit omits a misleading profile link and long names wrap',async({page,context})=>{
 await fixture(context);
 const name='Ein sehr langer individueller Rennname ohne Eintrag im Streckenkatalog';
 await context.route('**/rest/v1/races?**',route=>route.fulfill({json:[{...f.race,id:'unknown',grand_prix_name:name,circuit_name:'Unbekannter Kurs',race_date:'2099-10-05',status:'upcoming',current_result_version_id:null}]}));
 await page.setViewportSize({width:320,height:800}); await page.goto('/home?league=rcc');
 await expect(page.locator('.race-day h2')).toHaveText(name);
 await expect(page.locator('.race-day-open')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('two races have two slides and a narrow screen remains readable',async({page,context})=>{
 await fixture(context,2);await page.setViewportSize({width:320,height:800});await page.goto('/home?league=rcc');
 await expect(page.locator('.race-day-dots button')).toHaveCount(2);
 await expect(page.locator('.race-day')).toContainText('Rennen 1 von 2');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('single-race and empty-day states do not display misleading switch controls', async({page,context})=>{
 await fixture(context,1); await page.goto('/home?league=rcc');
 await expect(page.locator('.race-day')).toContainText('Rennen 1 von 1');
 await expect(page.locator('.race-day-dots button')).toHaveCount(0);
 await expect(page.locator('.race-day-dots')).toHaveCount(0);
 await context.route('**/rest/v1/races?**',route=>route.fulfill({json:[]}));
 await page.reload(); await expect(page.locator('#driver-hero-title')).toBeVisible();
 await expect(page.locator('.race-day')).toHaveCount(0);
});

test('every generated venue asset is delivered as WebP rather than an HTML fallback', async ({request}) => {
 for(const venue of venues) {
  const response=await request.get(venue.src);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/webp');
  const bytes=await response.body();
  expect(bytes.toString('ascii',8,12)).toBe('WEBP');
 }
});

test('touch controls retain 44px targets and pause and resume on a real tap',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},hasTouch:true,isMobile:true,locale:'de-DE'});
 try {
  await fixture(context,2);
  const page=await context.newPage(); await page.goto('/home?league=rcc');
  const carousel=page.locator('.race-day');
  const pause=carousel.getByRole('button',{name:/Automatischen Wechsel pausieren/});
  await expect(pause).toBeVisible();
  await expect(pause).toHaveCSS('width','44px'); await expect(pause).toHaveCSS('height','44px');
  await pause.tap();
  const play=carousel.getByRole('button',{name:/Automatischen Wechsel starten/});
  await expect(play).toBeVisible();
  await play.tap(); await expect(pause).toBeVisible();
  await carousel.locator('.race-day-dot').nth(1).tap();
  await expect(play).toBeVisible(); await expect(carousel.locator('h2')).toHaveText('Japan GP');
 } finally { await context.close(); }
});
