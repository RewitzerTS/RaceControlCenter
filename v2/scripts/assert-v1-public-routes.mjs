import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const distRoot = resolve(process.cwd(), 'dist');
const requiredPages = ['race-hub', 'kalender', 'ergebnisse', 'fahrer-wm', 'team-wm', 'grid', 'regeln-faq', 'strecken', 'strecken-profil', 'rennen-detail', 'hall-of-fame'];
const legacyProjectRef = ['kjcc', 'stcbqygxuqkvdaqw'].join('');

for (const page of requiredPages) {
  await access(resolve(distRoot, `${page}.html`));
  await access(resolve(distRoot, page, 'index.html'));
}

const trackMaps = (await readdir(resolve(distRoot, 'v1-assets', 'trackmaps'))).filter((name) => /\.(png|webp|svg)$/i.test(name));
if (trackMaps.length < 24) throw new Error(`Expected at least 24 V1 track maps, found ${trackMaps.length}.`);

const client = await readFile(resolve(distRoot, 'v1-assets', 'js', 'supabase-client.js'), 'utf8');
if (client.includes(legacyProjectRef) || client.includes('7aojXjXa4nfHRiT8CrGo6tX-lqAxYQ6mCMaHLhjo1J8')) {
  throw new Error('V1 production backend credentials leaked into the V2 public bundle.');
}
if (!client.includes('sb_publishable_') || !client.includes('znnkwjogtvzwfkwnmawp.supabase.co')) {
  throw new Error('V2 public routes are not connected to the dedicated V2 backend.');
}

const brandingSource = await readFile(resolve(process.cwd(), 'src', 'league', 'leagueBranding.ts'), 'utf8');
if (!brandingSource.includes("id: 0, name: 'RaceVora'") || brandingSource.includes("name: 'Midnight'")) {
  throw new Error('Theme 0 must be named RaceVora and Midnight must no longer be exposed.');
}

console.log(`V1 public route contract passed (${requiredPages.length} core pages, ${trackMaps.length} track maps, isolated V2 backend).`);
