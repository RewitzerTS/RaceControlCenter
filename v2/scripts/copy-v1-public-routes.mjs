import { copyFile, cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const v2Root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(v2Root, '..');
const distRoot = resolve(v2Root, 'dist');
const appEnvironment = String(process.env.VITE_APP_ENV || 'staging').trim().toLowerCase();
const legacyProjectRef = ['kjcc', 'stcbqygxuqkvdaqw'].join('');

const integratedRoutes = {
  'race-hub': '/racing',
  kalender: '/racing/calendar',
  ergebnisse: '/racing/results',
  'fahrer-wm': '/racing/standings?view=drivers',
  'team-wm': '/racing/standings?view=teams',
  grid: '/racing/grid',
  'regeln-faq': '/racing/rules',
  strecken: '/racing/tracks',
  'strecken-profil': '/racing/tracks/profile',
  'rennen-detail': '/racing/races/detail',
  'fahrer-profil': '/racing/drivers/profile',
  'team-profil': '/racing/teams/profile',
  'head-to-head': '/career/compare',
  rekorde: '/racing/history?view=records',
  'hall-of-fame': '/racing/history?view=hall-of-fame',
  'saison-archiv': '/racing/history?view=seasons',
};

const publicPages = [
  'race-hub',
  'kalender',
  'ergebnisse',
  'fahrer-wm',
  'team-wm',
  'grid',
  'regeln-faq',
  'strecken',
  'strecken-profil',
  'rennen-detail',
  'hall-of-fame',
  'fahrer-profil',
  'team-profil',
  'head-to-head',
  'rekorde',
  'saison-archiv',
];

async function readExampleEnvironment() {
  const path = resolve(v2Root, appEnvironment === 'production' ? '.env.production.example' : '.env.staging.example');
  const source = await readFile(path, 'utf8');
  return Object.fromEntries(source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => {
    const split = line.indexOf('=');
    return [line.slice(0, split), line.slice(split + 1)];
  }));
}

const exampleEnvironment = await readExampleEnvironment();
const supabaseUrl = String(process.env.VITE_SUPABASE_URL || exampleEnvironment.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const publishableKey = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || exampleEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(supabaseUrl) || !publishableKey.startsWith('sb_publishable_')) {
  throw new Error('V1 public-route build requires the dedicated V2 Supabase URL and publishable key.');
}
if (supabaseUrl.includes(legacyProjectRef)) {
  throw new Error('V1 source Supabase must never be bundled into V2 public routes.');
}

const supabaseProjectRef = new URL(supabaseUrl).hostname.split('.')[0];
const sharedAuthStorageKey = `racevora-v2:${supabaseProjectRef}:auth`;

function transformHtml(source, includeBase = false, page = '') {
  let output = source
    .replaceAll('assets/', '/v1-assets/')
    .replaceAll('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', '/v1-assets/vendor/supabase.js')
    .replaceAll('https://cdn.jsdelivr.net/npm/chart.js', '/v1-assets/vendor/chart.umd.min.js')
    .replaceAll('/v1-assets/js/services/rcc-f1-news-backend.js', '/v1-assets/js/services/rcc-f1-news-backend.js?v=v2-worker-1')
    .replaceAll('/v1-assets/js/layout.js', '/v1-assets/js/layout.js?v=v2-internal-i18n-1')
    .replaceAll('/v1-assets/js/utils.js', '/v1-assets/js/utils.js?v=v2-no-track-info-1')
    .replaceAll('/v1-assets/js/app.js', '/v1-assets/js/app.js?v=v2-no-track-info-1')
    .replaceAll('/v1-assets/js/pages/kalender.js', '/v1-assets/js/pages/kalender.js?v=v2-calendar-next-1')
    .replaceAll('/v1-assets/js/data/tracks.js', '/v1-assets/js/data/tracks.js?v=v2-local-flags-1')
    .replaceAll('/v1-assets/js/pages/track-hub.js', '/v1-assets/js/pages/track-hub.js?v=v2-track-hub-theme-1')
    .replaceAll('/v1-assets/js/services/rcc-data.js', '/v1-assets/js/services/rcc-data.js?v=v2-racing-data-6')
    .replaceAll('/v1-assets/js/services/rcc-result-data-compat.js', '/v1-assets/js/services/rcc-result-data-compat.js?v=v2-fastest-lap-rule-1')
    .replaceAll('/v1-assets/js/services/rcc-driver-context.js', '/v1-assets/js/services/rcc-driver-context.js?v=v2-season-grid-1')
    .replaceAll('/v1-assets/js/services/rcc-grid-roster.js', '/v1-assets/js/services/rcc-grid-roster.js?v=v2-season-grid-1')
    .replaceAll('/v1-assets/js/supabase-client.js', '/v1-assets/js/supabase-client.js?v=v2-auth-session-1')
    .replaceAll('/v1-assets/js/pages/race-detail.js', '/v1-assets/js/pages/race-detail.js?v=v2-season-archive-1')
    .replaceAll('/v1-assets/js/pages/regeln-faq.js', '/v1-assets/js/pages/regeln-faq.js?v=v2-season-grid-1')
    .replaceAll('/v1-assets/js/pages/season-archive.js', '/v1-assets/js/pages/season-archive.js?v=v2-season-archive-4')
    .replaceAll('/v1-assets/js/pages/hall-of-fame.js', '/v1-assets/js/pages/hall-of-fame.js?v=v2-browser-errors-2')
    .replaceAll('/v1-assets/js/pages/results-status-markers.js', '/v1-assets/js/pages/results-status-markers.js?v=v2-racing-fix-1')
    .replaceAll('/v1-assets/js/pages/standings.js', '/v1-assets/js/pages/standings.js?v=v2-fastest-lap-rule-1')
    .replaceAll('/v1-assets/js/pages/results.js', '/v1-assets/js/pages/results.js?v=v2-fastest-lap-rule-1')
    .replaceAll('/v1-assets/js/components/racevora-team-logo-resilience.js', '/v1-assets/js/components/racevora-team-logo-resilience.js?v=v2-racing-fix-1')
    .replaceAll('/v1-assets/css/pages/results-theme.css', '/v1-assets/css/pages/results-theme.css?v=v2-results-sticky-2')
    .replaceAll('/v1-assets/css/pages/results-status-markers.css', '/v1-assets/css/pages/results-status-markers.css?v=v2-racing-fix-1')
    .replace(/\s*<script>\s*if \(location\.hash === '#wm-dynamics'\) document\.documentElement\.classList\.add\('wm-dynamics-preview'\);\s*<\/script>/g, '\n  <script src="/v1-assets/js/results-preview.js"></script>')
    .replace(/\s*<link rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net" crossorigin>\s*/g, '\n')
    .replace(/href="admin\.html([^"#]*)"/g, 'href="/admin$1"')
    .replace(/href="stewards\.html([^"#]*)"/g, 'href="/stewarding$1"');
  if (includeBase && !output.includes('<base ')) output = output.replace(/<head([^>]*)>/i, '<head$1>\n  <base href="/">');
  if (page && integratedRoutes[page]) {
    output = output
      .replace(/<body([^>]*)>/i, `<body$1 data-racevora-integrated-route="${page}">`)
      .replace('</body>', '  <script defer src="/v1-assets/js/integrated-route-redirect.js"></script>\n</body>');
  }
  return output;
}

function transformLanding(source) {
  const authDrawer = `
  <dialog class="auth-drawer" id="racevora-auth-drawer" aria-labelledby="racevora-auth-title">
    <div class="auth-drawer__panel">
      <header class="auth-drawer__header">
        <div class="auth-drawer__brand">
          <img src="/v1-assets/images/racevora-mark.svg" alt="" width="48" height="48">
          <div><span>RACEVORA ACCOUNT</span><strong id="racevora-auth-title" data-auth-title>Anmelden</strong></div>
        </div>
        <button class="auth-drawer__close" type="button" data-auth-close aria-label="Anmeldung schließen">×</button>
      </header>
      <p class="auth-drawer__copy" data-auth-copy>Melde dich an, ohne die RaceVora Landingpage zu verlassen.</p>
      <iframe class="auth-drawer__frame" title="RaceVora Anmeldung" data-auth-frame src="about:blank"></iframe>
      <noscript><p class="auth-drawer__noscript">JavaScript ist deaktiviert. <a href="/login?mode=signin">Anmeldung direkt öffnen</a></p></noscript>
    </div>
  </dialog>`;

  return source
    .replace(/<button class="text-link" type="button" data-login-open><span data-login-button-label>Login<\/span><\/button>/, '<a class="text-link" href="/login?mode=signin" data-auth-open="signin">Login</a>')
    .replaceAll('href="register.html"', 'href="/login?mode=signup" data-auth-open="signup"')
    .replaceAll('href="race-hub.html?league=racevora-demo"', 'href="/race-hub?league=rcc&demo=1"')
    .replaceAll('href="impressum.html"', 'href="/impressum"')
    .replaceAll('href="datenschutz.html"', 'href="/datenschutz"')
    .replaceAll('href="agb.html"', 'href="/agb"')
    .replaceAll('href="widerruf.html"', 'href="/widerruf"')
    .replace(/\s*<div class="login-modal"[\s\S]*?<script src="assets\/js\/pages\/landing\.js"><\/script>/, '')
    .replaceAll('test-landing/', '/v1-landing/')
    .replaceAll('assets/', '/v1-assets/')
    .replace('</body>', `${authDrawer}\n</body>`);
}

function transformV1Header(source) {
  let output = transformHtml(source)
    .replace('<a class="brand" href="race-hub.html">', '<a class="brand" href="/">')
    .replace('<span>Mehr</span>', '<span>Liga-Menü</span>');

  const globalNavigation = `      <a href="/home" class="nav-primary-link">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"></path><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"></path></svg>
        <span class="nav-label">Home</span>
      </a>
      <a href="/racing" class="nav-primary-link">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4"></path><path d="M5 5h11l-2 4 2 4H5"></path></svg>
        <span class="nav-label">Racing</span>
      </a>
      <a href="/career" class="nav-primary-link">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9M10 20V4M16 20v-7M3 20h18"></path></svg>
        <span class="nav-label">Career</span>
      </a>
      <a href="/vora" class="nav-primary-link">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5ZM18 16l.7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7Z"></path></svg>
        <span class="nav-label">Vora</span>
      </a>
      <a href="/profile" class="nav-primary-link">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c.7-4 3.3-6 8-6s7.3 2 8 6"></path></svg>
        <span class="nav-label">Profil</span>
      </a>
      <a href="/race-hub" class="nav-primary-link active" aria-current="page">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><rect x="14" y="14" width="6" height="6" rx="1"></rect></svg>
        <span class="nav-label">Liga</span>
      </a>
`;
  output = output.replace(
    /      <a href="race-hub\.html" data-nav-link="index" class="nav-primary-link">[\s\S]*?(?=      <a href="\/admin)/,
    globalNavigation,
  );

  const leagueMenuStart = `        <div class="nav-more-menu" data-nav-more-menu>
          <a href="/race-hub" data-nav-link="index"><span class="nav-label">Übersicht</span></a>
          <a href="kalender.html" data-nav-link="kalender"><span class="nav-label">Kalender</span></a>
          <a href="ergebnisse.html" data-nav-link="ergebnisse"><span class="nav-label">Ergebnisse</span></a>
          <a href="fahrer-wm.html" data-nav-link="fahrer-wm"><span class="nav-label">Fahrer-WM</span></a>`;
  output = output.replace('        <div class="nav-more-menu" data-nav-more-menu>', leagueMenuStart);
  return output;
}

async function transformJavaScriptTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await transformJavaScriptTree(path);
      continue;
    }
    if (extname(entry.name) !== '.js') continue;
    let source = await readFile(path, 'utf8');
    source = source
      .replaceAll('assets/', '/v1-assets/')
      .replaceAll('data/hall-of-fame-fallback.json', '/v1-data/hall-of-fame-fallback.json')
      .replaceAll(`https://${legacyProjectRef}.supabase.co`, supabaseUrl);
    if (entry.name === 'supabase-client.js') {
      source = source
        .replace(/const SUPABASE_URL = '[^']+';/, `const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};`)
        .replace(/const SUPABASE_ANON_KEY = '[^']+';/, `const SUPABASE_ANON_KEY = ${JSON.stringify(publishableKey)};`)
        .replace(/storageKey:\s*'[^']+'/, `storageKey: ${JSON.stringify(sharedAuthStorageKey)}`)
        .replaceAll("new URL('admin.html', window.location.href)", "new URL('/admin', window.location.href)");
      source = `window.RCC_DISABLE_LEGACY_DRIVER_SEASON_ASSIGNMENTS = true;\nwindow.RCC_DISABLE_CHAMPIONSHIP_HISTORY = true;\n${source}`;
    }
    if (entry.name === 'rcc-f1-news-backend.js') {
      source = source.replace(
        /const ENDPOINT = '[^']+';/,
        "const ENDPOINT = '/api/f1-news';",
      );
    }
    if (entry.name === 'layout.js') {
      source = source.replace(
        'target.innerHTML=await response.text();',
        "const markup=await response.text();const parsed=new DOMParser().parseFromString(markup,'text/html');parsed.querySelectorAll('script').forEach((script)=>script.remove());target.innerHTML=parsed.body.innerHTML;",
      );
      source = source.replace(
        "function withLeagueContextHref(href){const slug=getActiveLeagueSlug();if(!slug||!href)return href;try{const url=new URL(href,window.location.href);if(url.origin!==window.location.origin)return href;const platformRoute=/^\\/(?:home|racing|career|vora|profile)\\/?$/i.test(url.pathname);if(!/\\.html$/i.test(url.pathname)&&!url.pathname.endsWith('/')&&!platformRoute)return href;url.searchParams.set('league',slug);if(platformRoute)return `${url.pathname}${url.search}${url.hash}`;const file=url.pathname.split('/').pop()||'index.html';return `${file}${url.search}${url.hash}`;}catch{return href;}}",
        "function withLeagueContextHref(href){const slug=getActiveLeagueSlug();if(!slug||!href)return href;try{const url=new URL(href,window.location.href);if(url.origin!==window.location.origin)return href;const reactRoute=/^\\/(?:race-hub|racing|career|vora|profile|admin|stewarding|owner|notifications|home)(?:\\/.*)?$/.test(url.pathname);if(!/\\.html$/i.test(url.pathname)&&!url.pathname.endsWith('/')&&!reactRoute)return href;url.searchParams.set('league',slug);if(reactRoute)return `${url.pathname}${url.search}${url.hash}`;const file=url.pathname.split('/').pop()||'index.html';return `${file}${url.search}${url.hash}`;}catch{return href;}}",
      );
      source = source.replace(
        "function withLeagueContextHref(href){const slug=getActiveLeagueSlug();if(!slug||!href)return href;try{const url=new URL(href,window.location.href);if(url.origin!==window.location.origin)return href;if(!/\\.html$/i.test(url.pathname)&&!url.pathname.endsWith('/'))return href;url.searchParams.set('league',slug);const file=url.pathname.split('/').pop()||'index.html';return `${file}${url.search}${url.hash}`;}catch{return href;}}",
        "function withLeagueContextHref(href){const slug=getActiveLeagueSlug();if(!slug||!href)return href;try{const url=new URL(href,window.location.href);if(url.origin!==window.location.origin)return href;const reactRoute=/^\\/(?:race-hub|racing|career|vora|profile|admin|stewarding|owner|notifications|home)(?:\\/.*)?$/.test(url.pathname);if(!/\\.html$/i.test(url.pathname)&&!url.pathname.endsWith('/')&&!reactRoute)return href;url.searchParams.set('league',slug);if(reactRoute)return `${url.pathname}${url.search}${url.hash}`;const file=url.pathname.split('/').pop()||'index.html';return `${file}${url.search}${url.hash}`;}catch{return href;}}",
      );
    }
    await writeFile(path, source, 'utf8');
  }
}

const v1AssetsDestination = resolve(distRoot, 'v1-assets');
await cp(resolve(repositoryRoot, 'assets'), v1AssetsDestination, { recursive: true, force: true });
await transformJavaScriptTree(resolve(v1AssetsDestination, 'js'));
const v1DataDestination = resolve(distRoot, 'v1-data');
await mkdir(v1DataDestination, { recursive: true });
await copyFile(
  resolve(repositoryRoot, 'data', 'hall-of-fame-fallback.json'),
  resolve(v1DataDestination, 'hall-of-fame-fallback.json'),
);
await writeFile(
  resolve(v1AssetsDestination, 'js', 'results-preview.js'),
  "if (location.hash === '#wm-dynamics') document.documentElement.classList.add('wm-dynamics-preview');\n",
  'utf8',
);
await writeFile(
  resolve(v1AssetsDestination, 'js', 'integrated-route-redirect.js'),
  `(function(){var page=document.body&&document.body.dataset.racevoraIntegratedRoute;var routes=${JSON.stringify(integratedRoutes)};if(!page||!routes[page])return;var p=new URLSearchParams(location.search);if(p.get('embed')==='1')return;p.delete('embed');var target=new URL(routes[page],location.origin);p.forEach(function(value,key){if(!target.searchParams.has(key))target.searchParams.set(key,value)});location.replace(target.pathname+target.search+location.hash)})();\n`,
  'utf8',
);

await cp(resolve(repositoryRoot, 'test-landing'), resolve(distRoot, 'v1-landing'), { recursive: true, force: true });
const landingSource = await readFile(resolve(repositoryRoot, 'index.html'), 'utf8');
await writeFile(resolve(distRoot, 'landing.html'), transformLanding(landingSource), 'utf8');

const vendorDestination = resolve(v1AssetsDestination, 'vendor');
await mkdir(vendorDestination, { recursive: true });
await copyFile(resolve(v2Root, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'), resolve(vendorDestination, 'supabase.js'));
await copyFile(resolve(v2Root, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js'), resolve(vendorDestination, 'chart.umd.min.js'));

const componentsDestination = resolve(distRoot, 'components');
await mkdir(componentsDestination, { recursive: true });
for (const component of ['header.html', 'footer.html']) {
  const source = await readFile(resolve(repositoryRoot, 'components', component), 'utf8');
  await writeFile(resolve(componentsDestination, component), component === 'header.html' ? transformV1Header(source) : transformHtml(source), 'utf8');
}

const manifest = JSON.parse(await readFile(resolve(repositoryRoot, 'manifest.json'), 'utf8'));
manifest.start_url = '/home';
manifest.scope = '/';
manifest.icons = (manifest.icons || []).map((icon) => ({
  ...icon,
  src: String(icon.src || '').replace(/^\.?\/?assets\//, '/v1-assets/'),
}));
await writeFile(resolve(distRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

for (const page of publicPages) {
  const source = await readFile(resolve(repositoryRoot, `${page}.html`), 'utf8');
  await writeFile(resolve(distRoot, `${page}.html`), transformHtml(source, false, page), 'utf8');
  const cleanRoute = resolve(distRoot, page, 'index.html');
  await mkdir(dirname(cleanRoute), { recursive: true });
  await writeFile(cleanRoute, transformHtml(source, true, page), 'utf8');
}

console.log(`Restored ${publicPages.length} complete V1 public views inside V2, including track maps and local flags.`);
