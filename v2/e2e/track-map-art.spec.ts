import { test, expect } from '@playwright/test';
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
