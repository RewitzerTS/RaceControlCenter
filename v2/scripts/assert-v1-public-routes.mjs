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
await access(resolve(distRoot, 'v1-data', 'hall-of-fame-fallback.json'));

const calendar = await readFile(resolve(distRoot, 'v1-assets', 'js', 'pages', 'kalender.js'), 'utf8');
if (!calendar.includes('Kommende Rennen (${upcoming.length})')
    || !calendar.includes('Gefahrene Rennen (${completed.length})')
    || !calendar.includes('if (!upcoming.length && completed.length) completedBtn?.click()')) {
  throw new Error('Integrated calendar must expose race counts and open completed races when no upcoming race exists.');
}
const calendarPage = await readFile(resolve(distRoot, 'kalender.html'), 'utf8');
if (!calendarPage.includes('/v1-assets/js/pages/kalender.js?v=v2-season-archive-1')) {
  throw new Error('Integrated calendar must cache-bust its updated lifecycle navigation.');
}
if (!calendarPage.includes('/v1-assets/js/data/tracks.js?v=v2-local-flags-1')) {
  throw new Error('Integrated calendar must cache-bust the local country-flag source.');
}
const integratedTracks = await readFile(resolve(distRoot, 'v1-assets', 'js', 'data', 'tracks.js'), 'utf8');
if (!integratedTracks.includes('`/v1-assets/images/flags/${lower}.svg`') || integratedTracks.includes('flagcdn.com')) {
  throw new Error('Integrated Racing pages must load country flags from local RaceVora assets.');
}

const seasonArchivePage = await readFile(resolve(distRoot, 'saison-archiv.html'), 'utf8');
if (!seasonArchivePage.includes('/v1-assets/js/pages/season-archive.js?v=v2-season-archive-4')) {
  throw new Error('Integrated season archive must cache-bust its official-result fix.');
}
const seasonArchive = await readFile(resolve(distRoot, 'v1-assets', 'js', 'pages', 'season-archive.js'), 'utf8');
if (!seasonArchive.includes('filterOfficialRaceResults') || !seasonArchive.includes("typeof window.RCCData?.filterCurrentRaceResults === 'function'")) {
  throw new Error('Integrated season archive must retain a compatible official-result filter fallback.');
}

for (const [page, marker] of [
  ['rennen-detail', '/v1-assets/js/pages/race-detail.js?v=v2-season-archive-1'],
  ['grid', '/v1-assets/js/pages/regeln-faq.js?v=v2-season-grid-1'],
  ['regeln-faq', '/v1-assets/js/pages/regeln-faq.js?v=v2-season-grid-1'],
  ['ergebnisse', '/v1-assets/js/pages/results-status-markers.js?v=v2-racing-fix-1'],
  ['fahrer-wm', '/v1-assets/js/components/racevora-team-logo-resilience.js?v=v2-racing-fix-1'],
]) {
  const source = await readFile(resolve(distRoot, `${page}.html`), 'utf8');
  if (!source.includes(marker) || !source.includes('/v1-assets/js/services/rcc-data.js?v=v2-racing-data-2')) {
    throw new Error(`${page}.html must cache-bust the integrated Racing fixes.`);
  }
  if (!source.includes('/v1-assets/js/supabase-client.js?v=v2-auth-session-1')) {
    throw new Error(`${page}.html must cache-bust the integrated browser-error client fix.`);
  }
}

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
if (!client.includes("storageKey: \"racevora-v2:znnkwjogtvzwfkwnmawp:auth\"") || client.includes("storageKey: 'rcc_admin_session'")) {
  throw new Error('Integrated public routes do not reuse the V2 browser session.');
}
if (!client.includes('RCC_DISABLE_LEGACY_DRIVER_SEASON_ASSIGNMENTS = true')) {
  throw new Error('V2 public routes must disable the unavailable legacy driver assignment relation.');
}
if (!client.includes('RCC_DISABLE_CHAMPIONSHIP_HISTORY = true')) {
  throw new Error('V2 public routes must disable the unavailable legacy championship history relation.');
}

const rulesFaq = await readFile(resolve(distRoot, 'v1-assets', 'js', 'pages', 'regeln-faq.js'), 'utf8');
const hallOfFame = await readFile(resolve(distRoot, 'v1-assets', 'js', 'pages', 'hall-of-fame.js'), 'utf8');
for (const [name, source] of [['rules FAQ', rulesFaq], ['Hall of Fame', hallOfFame]]) {
  if (!source.includes('/v1-data/hall-of-fame-fallback.json') || source.includes("fetch('data/hall-of-fame-fallback.json'")) {
    throw new Error(`Integrated ${name} does not use the deployed Hall-of-Fame fallback data.`);
  }
}
if (!rulesFaq.includes('window.RCC_DISABLE_CHAMPIONSHIP_HISTORY === true')) {
  throw new Error('Integrated rules FAQ does not skip the unavailable championship history relation.');
}
if (!hallOfFame.includes('window.RCC_DISABLE_CHAMPIONSHIP_HISTORY === true')) {
  throw new Error('Integrated Hall of Fame does not skip the unavailable championship history relation.');
}
const hallOfFamePage = await readFile(resolve(distRoot, 'hall-of-fame.html'), 'utf8');
if (!hallOfFamePage.includes('/v1-assets/js/pages/hall-of-fame.js?v=v2-browser-errors-2')) {
  throw new Error('Integrated Hall of Fame must cache-bust the browser-error fix.');
}
if (!hallOfFamePage.includes('/v1-assets/js/supabase-client.js?v=v2-auth-session-1')) {
  throw new Error('Integrated Hall of Fame must cache-bust the shared browser-error client fix.');
}

const driverContext = await readFile(resolve(distRoot, 'v1-assets', 'js', 'services', 'rcc-driver-context.js'), 'utf8');
if (!driverContext.includes('global.RCC_DISABLE_LEGACY_DRIVER_SEASON_ASSIGNMENTS === true')) {
  throw new Error('V2 driver context does not respect the disabled legacy assignment relation.');
}
const gridPage = await readFile(resolve(distRoot, 'grid.html'), 'utf8');
const gridRoster = await readFile(resolve(distRoot, 'v1-assets', 'js', 'services', 'rcc-grid-roster.js'), 'utf8');
if (!gridPage.includes('/v1-assets/js/services/rcc-driver-context.js?v=v2-season-grid-1')
    || !gridPage.includes('/v1-assets/js/services/rcc-grid-roster.js?v=v2-season-grid-1')
    || !gridRoster.includes('buildSeasonGrid')
    || !gridRoster.includes('participant_type')) {
  throw new Error('Integrated Grid does not use the active season seat assignments.');
}

const driverStats = await readFile(resolve(distRoot, 'v1-assets', 'js', 'services', 'rcc-driver-stats.js'), 'utf8');
const driverProfile = await readFile(resolve(distRoot, 'v1-assets', 'js', 'pages', 'driver-profile.js'), 'utf8');
if (!driverStats.includes(".from('driver_identities')")
    || !driverStats.includes(".from('driver_identity_links')")
    || !driverStats.includes('profileNumbersByDriver')) {
  throw new Error('Integrated driver profiles do not resolve the signed-in user profile number.');
}
if (!driverProfile.includes('state.profileNumber')
    || !driverProfile.includes('routedProfileNumber')
    || !driverProfile.includes('linkedProfileNumber')
    || !driverProfile.includes("'Profilnummer'")) {
  throw new Error('Driver profile number display is not connected to the global profile number fallback.');
}
const driverProfilePage = await readFile(resolve(distRoot, 'fahrer-profil.html'), 'utf8');
const headToHeadPage = await readFile(resolve(distRoot, 'head-to-head.html'), 'utf8');
if (!driverProfilePage.includes('/v1-assets/js/services/rcc-driver-stats.js?v=v2-profile-number-2')
    || !driverProfilePage.includes('/v1-assets/js/pages/driver-profile.js?v=v2-profile-number-2')
    || !headToHeadPage.includes('/v1-assets/js/services/rcc-driver-stats.js?v=v2-profile-number-2')) {
  throw new Error('Integrated Career pages do not cache-bust the profile number data fix.');
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

const integratedRedirect = await readFile(resolve(distRoot, 'v1-assets', 'js', 'integrated-route-redirect.js'), 'utf8');
for (const [page, route] of [
  ['kalender', '/racing/calendar'],
  ['ergebnisse', '/racing/results'],
  ['fahrer-wm', '/racing/standings?view=drivers'],
  ['team-wm', '/racing/standings?view=teams'],
  ['fahrer-profil', '/racing/drivers/profile'],
  ['head-to-head', '/career/compare'],
  ['hall-of-fame', '/racing/history?view=hall-of-fame'],
]) {
  if (!integratedRedirect.includes(`\"${page}\":\"${route}\"`)) {
    throw new Error(`Integrated route redirect is missing ${page} -> ${route}.`);
  }
}
if (!integratedRedirect.includes("p.get('embed')==='1'")) {
  throw new Error('Integrated public views must remain embeddable inside Racing and Career.');
}
for (const page of requiredPages) {
  const source = await readFile(resolve(distRoot, `${page}.html`), 'utf8');
  if (!source.includes(`data-racevora-integrated-route="${page}"`) || !source.includes('/v1-assets/js/integrated-route-redirect.js')) {
    throw new Error(`${page}.html is not connected to its integrated V2 destination.`);
  }
}

const landing = await readFile(resolve(distRoot, 'landing.html'), 'utf8');
for (const href of ['/login?mode=signin', '/login?mode=signup', '/race-hub?league=rcc&demo=1']) {
  if (!landing.includes(`href="${href}"`)) throw new Error(`V1 landing page is missing the V2 entry target ${href}.`);
}
for (const marker of ['data-auth-open="signin"', 'data-auth-open="signup"', 'id="racevora-auth-drawer"', 'data-auth-frame']) {
  if (!landing.includes(marker)) throw new Error(`V1 landing page is missing the embedded access marker ${marker}.`);
}
if ((landing.match(/Jetzt starten/g) || []).length < 3 || landing.includes('Liga starten') || landing.includes('Eigene Liga starten')) {
  throw new Error('V1 landing page does not use the unified Jetzt starten call to action.');
}
if (/[↗↓]/.test(landing) || landing.includes('final-signal')) {
  throw new Error('V1 landing page still contains decorative button arrows or signal dots.');
}
if (landing.includes('landing-login-modal') || landing.includes('assets/js/pages/landing.js') || landing.includes('assets/js/supabase-client.js')) {
  throw new Error('V1 landing page still contains the retired V1 authentication flow.');
}
await access(resolve(distRoot, 'v1-landing', 'style.css'));
await access(resolve(distRoot, 'v1-landing', 'script.js'));

const productionWorker = await readFile(resolve(process.cwd(), 'worker', 'news-worker.js'), 'utf8');
if (!productionWorker.includes("url.pathname === '/'") || !productionWorker.includes("new URL('/landing', url)")) {
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
if (!brandingSource.includes('const DEFAULT_THEME = THEME_PRESETS[0]') || !brandingSource.includes('shouldUseStandardRaceVoraBranding')) {
  throw new Error('Logged-out and Demo views must use the RaceVora standard theme.');
}

const restoredBranding = await readFile(resolve(distRoot, 'v1-assets', 'js', 'services', 'rcc-branding.js'), 'utf8');
const restoredPrepaint = await readFile(resolve(distRoot, 'v1-assets', 'js', 'theme-prepaint.js'), 'utf8');
for (const marker of ['tenantBrandingAllowed', "params.get('demo') === '1'", 'refreshTenantBrandingPermission']) {
  if (!restoredBranding.includes(marker)) throw new Error(`Restored public branding is missing the access guard ${marker}.`);
}
if (!restoredPrepaint.includes('apply(STANDARD_SETTINGS)') || restoredPrepaint.includes('apply(cached.settings)')) {
  throw new Error('Restored public pages must prepaint in RaceVora standard colors without cached tenant leakage.');
}

const appStyles = await readFile(resolve(process.cwd(), 'src', 'styles.css'), 'utf8');
if (appStyles.includes('linear-gradient(#060809, #040506)') || appStyles.includes('background: #141719;')) {
  throw new Error('V2 must not override selected league branding with fixed production colors.');
}

const resultImportSource = await readFile(resolve(process.cwd(), 'src', 'operations', 'V1CompletionPages.tsx'), 'utf8');
const aiImportSource = await readFile(resolve(process.cwd(), 'src', 'operations', 'imageResultImport.ts'), 'utf8');
const aiQuotaMigration = await readFile(resolve(process.cwd(), 'supabase', 'migrations', '20260822190247_v2_ai_result_import_quota.sql'), 'utf8');
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
