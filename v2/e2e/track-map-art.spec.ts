import { test, expect, webkit } from '@playwright/test';
import tracks from '../src/racing/trackCatalog.json' with { type: 'json' };
import { installPublicFixture } from './public-fixture';

test('all precise vector maps render and enlarged calendar maps remain usable', async ({page,context,request},info) => {
 await installPublicFixture(context);
 for(const file of new Set(tracks.map(track=>track.trackMapFile))) {
  const response=await request.get(`/v1-assets/trackmaps/${file}`);
  expect(response.ok()).toBe(true); expect(response.headers()['content-type']).toContain('image/svg+xml');
  expect(await response.text()).toContain('id="circuit"');
 }
 await page.goto('/racing/calendar?league=rcc&demo=1');
 const open=page.getByRole('button',{name:/Streckenkarte.*Suzuka/});
 await open.click();
 const dialog=page.locator('dialog.integrated-track-map');
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('img')).toHaveAttribute('src',/suzuka\.svg$/);
 await expect(dialog.locator('img')).not.toHaveJSProperty('naturalWidth',0);
 const themed=dialog.locator('.themed-track-map');
 const originalGeometry=await themed.locator('img').getAttribute('src');
 const originalColors=await themed.evaluate(el=>getComputedStyle(el,'::before').backgroundImage);
 // Theme values are inherited, not baked into the external SVG. This also covers
 // arbitrary colors extracted from a league logo, not just named presets.
 await page.locator('.app-shell').evaluate(el=>{(el as HTMLElement).style.setProperty('--brand-primary','#f16b31');(el as HTMLElement).style.setProperty('--brand-accent','#ffdb8a');});
 await expect.poll(()=>themed.evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).toContain('rgb(241, 107, 49)');
 expect(await themed.evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).not.toBe(originalColors);
 expect(await themed.evaluate(el=>getComputedStyle(el,'::before').maskImage)).toContain('suzuka.svg');
 await expect(themed.locator('img')).toHaveAttribute('src',originalGeometry!);
 await dialog.screenshot({path:info.outputPath('calendar-personal-theme.png')});
 await page.locator('.app-shell').evaluate(el=>{(el as HTMLElement).style.removeProperty('--brand-primary');(el as HTMLElement).style.removeProperty('--brand-accent');});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await dialog.screenshot({path:info.outputPath('calendar-vector-map.png')});
 await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(open).toBeFocused();
 if(info.project.name==='desktop') {
  // Contact sheet for the one bounded visual review, not shipped UI.
  const unique=[...new Map(tracks.map(track=>[track.trackMapFile,track])).values()];
  await page.setViewportSize({width:1500,height:1800});
  await page.setContent(`<body style="margin:0;background:#0b111c;color:white;font:16px Arial;display:grid;grid-template-columns:repeat(5,1fr);gap:16px;padding:20px">${unique.map(track=>`<figure style="margin:0"><figcaption>${track.key}</figcaption><img style="width:100%;height:135px" src="/v1-assets/trackmaps/${track.trackMapFile}"/><img style="width:100%;height:135px" src="/v1-assets/trackmaps/${track.trackMapFile.replace('.svg','.png')}"/></figure>`).join('')}</body>`);
  await page.evaluate(async()=>Promise.all([...document.images].map(image=>image.decode().catch(()=>{}))));
  await page.screenshot({path:info.outputPath('trackmap-source-comparison.png'),fullPage:true});
 }
});

test('Safari WebKit applies personal colors to circuit geometry without a reload', async ({baseURL},info) => {
 test.skip(info.project.name!=='desktop','One explicit touch WebKit context covers Safari.');
 const browser=await webkit.launch();
 try {
  const context=await browser.newContext({baseURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'de-DE'});
  await installPublicFixture(context);
  const page=await context.newPage();
  await page.goto('/racing/calendar?league=rcc&demo=1');
  await page.getByRole('button',{name:/Streckenkarte.*Suzuka/}).tap();
  const map=page.locator('dialog .themed-track-map');
  await expect(map).toBeVisible();
  await expect.poll(()=>map.locator('img').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.locator('.app-shell').evaluate(el=>{(el as HTMLElement).style.setProperty('--brand-primary','#f16b31');(el as HTMLElement).style.setProperty('--brand-accent','#ffdb8a');});
  await expect.poll(()=>map.evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).toContain('rgb(241, 107, 49)');
  expect(await map.evaluate(el=>getComputedStyle(el,'::before').webkitMaskImage)).toContain('suzuka.svg');
  await page.locator('dialog.integrated-track-map').screenshot({path:info.outputPath('safari-personal-track-map.png')});
 } finally { await browser.close(); }
});
