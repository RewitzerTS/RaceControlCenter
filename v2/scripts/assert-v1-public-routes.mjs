import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const distRoot = resolve(process.cwd(), 'dist');
const requiredPages = ['race-hub', 'kalender', 'ergebnisse', 'fahrer-wm', 'team-wm', 'grid', 'regeln-faq', 'strecken', 'strecken-profil', 'rennen-detail', 'hall-of-fame'];
const legacyProjectRef = ['kjcc', 'stcbqygxuqkvdaqw'].join('');

for (const page of requiredPages) {
  await access(resolve(distRoot, `${page}.html`));
  await access(resolve(distRoot, page, 'index.html'));
  const source = await readFile(resolve(distRoot, `${page}.html`), 'utf8');
  if (source.includes('cdn.jsdelivr.net/npm/@supabase/supabase-js') || source.includes('cdn.jsdelivr.net/npm/chart.js')) {
    throw new Error(`${page}.html still loads a runtime dependency from jsDelivr.`);
  }
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(source)) {
    throw new Error(`${page}.html still contains an inline runtime script blocked by the production CSP.`);
  }
}

for (const vendorFile of ['supabase.js', 'chart.umd.min.js']) {
  await access(resolve(distRoot, 'v1-assets', 'vendor', vendorFile));
}
await access(resolve(distRoot, 'v1-assets', 'js', 'results-preview.js'));

const trackMaps = (await readdir(resolve(distRoot, 'v1-assets', 'trackmaps'))).filter((name) => /\.(png|webp|svg)$/i.test(name));
if (trackMaps.length < 24) throw new Error(`Expected at least 24 V1 track maps, found ${trackMaps.length}.`);

const client = await readFile(resolve(distRoot, 'v1-assets', 'js', 'supabase-client.js'), 'utf8');
if (client.includes(legacyProjectRef) || client.includes('7aojXjXa4nfHRiT8CrGo6tX-lqAxYQ6mCMaHLhjo1J8')) {
  throw new Error('V1 production backend credentials leaked into the V2 public bundle.');
}
if (!client.includes('sb_publishable_') || !client.includes('znnkwjogtvzwfkwnmawp.supabase.co')) {
  throw new Error('V2 public routes are not connected to the dedicated V2 backend.');
}
if (!client.includes('RCC_DISABLE_DRIVER_SEASON_ASSIGNMENTS = true')) {
  throw new Error('V2 public routes must disable the unavailable legacy driver assignment relation.');
}

const driverContext = await readFile(resolve(distRoot, 'v1-assets', 'js', 'services', 'rcc-driver-context.js'), 'utf8');
if (!driverContext.includes('global.RCC_DISABLE_DRIVER_SEASON_ASSIGNMENTS === true')) {
  throw new Error('V2 driver context does not respect the disabled legacy assignment relation.');
}

const brandingSource = await readFile(resolve(process.cwd(), 'src', 'league', 'leagueBranding.ts'), 'utf8');
if (!brandingSource.includes("id: 0, name: 'RaceVora'") || brandingSource.includes("name: 'Midnight'")) {
  throw new Error('Theme 0 must be named RaceVora and Midnight must no longer be exposed.');
}

console.log(`V1 public route contract passed (${requiredPages.length} core pages, ${trackMaps.length} track maps, isolated V2 backend).`);
