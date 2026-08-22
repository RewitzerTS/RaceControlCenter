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

const manifest = JSON.parse(await readFile(resolve(distRoot, 'manifest.json'), 'utf8'));
if (manifest.start_url !== '/home' || manifest.scope !== '/' || !manifest.icons?.every((icon) => String(icon.src).startsWith('/v1-assets/'))) {
  throw new Error('V2 public manifest does not point to the restored RaceVora public experience.');
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
if (!client.includes('RCC_DISABLE_DRIVER_SEASON_ASSIGNMENTS = true')) {
  throw new Error('V2 public routes must disable the unavailable legacy driver assignment relation.');
}

const driverContext = await readFile(resolve(distRoot, 'v1-assets', 'js', 'services', 'rcc-driver-context.js'), 'utf8');
if (!driverContext.includes('global.RCC_DISABLE_DRIVER_SEASON_ASSIGNMENTS === true')) {
  throw new Error('V2 driver context does not respect the disabled legacy assignment relation.');
}

const newsBackend = await readFile(resolve(distRoot, 'v1-assets', 'js', 'services', 'rcc-f1-news-backend.js'), 'utf8');
if (!newsBackend.includes("const ENDPOINT = '/api/f1-news';") || newsBackend.includes('.supabase.co/functions/v1/f1-news')) {
  throw new Error('V2 Race Hub news must use the isolated same-origin Worker endpoint.');
}
const raceHub = await readFile(resolve(distRoot, 'race-hub.html'), 'utf8');
if (!raceHub.includes('/v1-assets/js/services/rcc-f1-news-backend.js?v=v2-worker-1')) {
  throw new Error('V2 Race Hub must cache-bust the restored news backend.');
}

const newsWorker = await readFile(resolve(process.cwd(), 'worker', 'news-worker.js'), 'utf8');
const privilegedNewsCredential = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
if (!newsWorker.includes("url.pathname === '/api/f1-news'") || !newsWorker.includes('environment.ASSETS.fetch(request)') || newsWorker.includes(privilegedNewsCredential)) {
  throw new Error('V2 news Worker must serve the same-origin feed without privileged Supabase credentials.');
}

const layout = await readFile(resolve(distRoot, 'v1-assets', 'js', 'layout.js'), 'utf8');
if (!layout.includes("parsed.querySelectorAll('script')")) {
  throw new Error('V2 layout partials must discard scripts injected into Cloudflare HTML fragments.');
}
if (!layout.includes('const reactRoute=') || !layout.includes('(?:race-hub|racing|career|vora|profile|admin') || !layout.includes("if(reactRoute)return `${url.pathname}${url.search}${url.hash}`")) {
  throw new Error('V2 platform navigation must retain the active league context.');
}

const restoredHeader = await readFile(resolve(distRoot, 'components', 'header.html'), 'utf8');
for (const href of ['href="/home"', 'href="/racing"', 'href="/career"', 'href="/vora"', 'href="/profile"', 'href="/race-hub"']) {
  if (!restoredHeader.includes(href)) throw new Error(`Restored public header is missing global navigation target ${href}.`);
}
for (const href of ['kalender.html', 'ergebnisse.html', 'fahrer-wm.html', 'team-wm.html', 'regeln-faq.html', 'grid.html', 'hall-of-fame.html']) {
  if (!restoredHeader.includes(href)) throw new Error(`Restored league menu is missing ${href}.`);
}
if (!restoredHeader.includes('Liga-Menü') || !restoredHeader.includes('nav-primary-link active')) {
  throw new Error('Restored public header must keep Liga active and expose the complete league menu.');
}

const landing = await readFile(resolve(distRoot, 'landing.html'), 'utf8');
for (const href of ['/login?mode=signin', '/login?mode=signup', '/race-hub?league=rcc']) {
  if (!landing.includes(`href="${href}"`)) throw new Error(`V1 landing page is missing the V2 entry target ${href}.`);
}
if (landing.includes('landing-login-modal') || landing.includes('assets/js/pages/landing.js') || landing.includes('assets/js/supabase-client.js')) {
  throw new Error('V1 landing page still contains the retired V1 authentication flow.');
}
await access(resolve(distRoot, 'v1-landing', 'style.css'));
await access(resolve(distRoot, 'v1-landing', 'script.js'));

const productionWorker = await readFile(resolve(process.cwd(), 'worker', 'news-worker.js'), 'utf8');
if (!productionWorker.includes("url.pathname === '/'") || !productionWorker.includes("new URL('/landing.html', url)")) {
  throw new Error('Production Worker does not serve the V1 landing page at the public root.');
}
const productionConfig = await readFile(resolve(process.cwd(), 'wrangler.production.jsonc'), 'utf8');
if (!productionConfig.includes('"run_worker_first": ["/", "/api/*"]')) {
  throw new Error('Production Worker is not configured to handle the public root before the SPA fallback.');
}

const brandingSource = await readFile(resolve(process.cwd(), 'src', 'league', 'leagueBranding.ts'), 'utf8');
if (!brandingSource.includes("id: 0, name: 'RaceVora'") || brandingSource.includes("name: 'Midnight'")) {
  throw new Error('Theme 0 must be named RaceVora and Midnight must no longer be exposed.');
}

const appStyles = await readFile(resolve(process.cwd(), 'src', 'styles.css'), 'utf8');
if (appStyles.includes('linear-gradient(#060809, #040506)') || appStyles.includes('background: #141719;')) {
  throw new Error('V2 must not override selected league branding with fixed production colors.');
}

const resultImportSource = await readFile(resolve(process.cwd(), 'src', 'operations', 'V1CompletionPages.tsx'), 'utf8');
const aiImportSource = await readFile(resolve(process.cwd(), 'src', 'operations', 'imageResultImport.ts'), 'utf8');
const aiQuotaMigration = await readFile(resolve(process.cwd(), 'supabase', 'migrations', '20260822190000_v2_ai_result_import_quota.sql'), 'utf8');
for (const marker of ['KI-Bildimport', 'Bilder mit KI auslesen', 'analysisToReviewCsv']) {
  if (!resultImportSource.includes(marker)) throw new Error(`V2 result import is missing the restored AI workflow marker ${marker}.`);
}
if (!aiImportSource.includes("functions.invoke('analyze-race-result-images'") || !aiImportSource.includes("'PRÜFEN'")) {
  throw new Error('V2 AI image import must invoke the isolated analyzer and force human point verification.');
}
if (!aiQuotaMigration.includes('consume_ai_analysis_quota') || !aiQuotaMigration.includes('pg_advisory_xact_lock')) {
  throw new Error('V2 AI image import is missing its atomic tenant quota migration.');
}

console.log(`V1 public route contract passed (${requiredPages.length} core pages, ${trackMaps.length} track maps, isolated V2 backend).`);
