import { copyFile, cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const v2Root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(v2Root, '..');
const distRoot = resolve(v2Root, 'dist');
const appEnvironment = String(process.env.VITE_APP_ENV || 'staging').trim().toLowerCase();
const legacyProjectRef = ['kjcc', 'stcbqygxuqkvdaqw'].join('');

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

function transformHtml(source, includeBase = false) {
  let output = source
    .replaceAll('assets/', '/v1-assets/')
    .replaceAll('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', '/v1-assets/vendor/supabase.js')
    .replaceAll('https://cdn.jsdelivr.net/npm/chart.js', '/v1-assets/vendor/chart.umd.min.js')
    .replaceAll('/v1-assets/js/services/rcc-f1-news-backend.js', '/v1-assets/js/services/rcc-f1-news-backend.js?v=v2-worker-1')
    .replace(/\s*<script>\s*if \(location\.hash === '#wm-dynamics'\) document\.documentElement\.classList\.add\('wm-dynamics-preview'\);\s*<\/script>/g, '\n  <script src="/v1-assets/js/results-preview.js"></script>')
    .replace(/\s*<link rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net" crossorigin>\s*/g, '\n')
    .replace(/href="admin\.html([^"#]*)"/g, 'href="/admin$1"')
    .replace(/href="stewards\.html([^"#]*)"/g, 'href="/stewarding$1"');
  if (includeBase && !output.includes('<base ')) output = output.replace(/<head([^>]*)>/i, '<head$1>\n  <base href="/">');
  return output;
}

function transformV1Header(source) {
  let output = transformHtml(source)
    .replace('<a class="brand" href="race-hub.html">', '<a class="brand" href="/">')
    .replace('<span>Mehr</span>', '<span>Liga-Menü</span>');

  const globalNavigation = `      <a href="/" class="nav-primary-link">
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
      .replaceAll(`https://${legacyProjectRef}.supabase.co`, supabaseUrl);
    if (entry.name === 'supabase-client.js') {
      source = source
        .replace(/const SUPABASE_URL = '[^']+';/, `const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};`)
        .replace(/const SUPABASE_ANON_KEY = '[^']+';/, `const SUPABASE_ANON_KEY = ${JSON.stringify(publishableKey)};`)
        .replaceAll("new URL('admin.html', window.location.href)", "new URL('/admin', window.location.href)");
      source = `window.RCC_DISABLE_DRIVER_SEASON_ASSIGNMENTS = true;\n${source}`;
    }
    if (entry.name === 'rcc-driver-context.js') {
      source = source.replace(
        'if (!global.supabaseClient) return [];',
        'if (!global.supabaseClient || global.RCC_DISABLE_DRIVER_SEASON_ASSIGNMENTS === true) return [];',
      );
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
        "function withLeagueContextHref(href){const slug=getActiveLeagueSlug();if(!slug||!href)return href;try{const url=new URL(href,window.location.href);if(url.origin!==window.location.origin)return href;if(!/\\.html$/i.test(url.pathname)&&!url.pathname.endsWith('/'))return href;url.searchParams.set('league',slug);const file=url.pathname.split('/').pop()||'index.html';return `${file}${url.search}${url.hash}`;}catch{return href;}}",
        "function withLeagueContextHref(href){const slug=getActiveLeagueSlug();if(!slug||!href)return href;try{const url=new URL(href,window.location.href);if(url.origin!==window.location.origin)return href;const reactRoute=/^\\/(?:race-hub|racing|career|vora|profile|admin(?:\\/.*)?|stewarding(?:\\/.*)?|owner(?:\\/.*)?|notifications)?$/.test(url.pathname);if(!/\\.html$/i.test(url.pathname)&&!url.pathname.endsWith('/')&&!reactRoute)return href;url.searchParams.set('league',slug);if(reactRoute)return `${url.pathname}${url.search}${url.hash}`;const file=url.pathname.split('/').pop()||'index.html';return `${file}${url.search}${url.hash}`;}catch{return href;}}",
      );
    }
    await writeFile(path, source, 'utf8');
  }
}

const v1AssetsDestination = resolve(distRoot, 'v1-assets');
await cp(resolve(repositoryRoot, 'assets'), v1AssetsDestination, { recursive: true, force: true });
await transformJavaScriptTree(resolve(v1AssetsDestination, 'js'));
await writeFile(
  resolve(v1AssetsDestination, 'js', 'results-preview.js'),
  "if (location.hash === '#wm-dynamics') document.documentElement.classList.add('wm-dynamics-preview');\n",
  'utf8',
);

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
manifest.start_url = '/race-hub.html';
manifest.scope = '/';
manifest.icons = (manifest.icons || []).map((icon) => ({
  ...icon,
  src: String(icon.src || '').replace(/^\.?\/?assets\//, '/v1-assets/'),
}));
await writeFile(resolve(distRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

for (const page of publicPages) {
  const source = await readFile(resolve(repositoryRoot, `${page}.html`), 'utf8');
  await writeFile(resolve(distRoot, `${page}.html`), transformHtml(source), 'utf8');
  const cleanRoute = resolve(distRoot, page, 'index.html');
  await mkdir(dirname(cleanRoute), { recursive: true });
  await writeFile(cleanRoute, transformHtml(source, true), 'utf8');
}

console.log(`Restored ${publicPages.length} complete V1 public views inside V2, including track maps and track information.`);
