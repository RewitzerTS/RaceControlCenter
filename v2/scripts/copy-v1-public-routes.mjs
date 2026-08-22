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
    .replace(/\s*<script>\s*if \(location\.hash === '#wm-dynamics'\) document\.documentElement\.classList\.add\('wm-dynamics-preview'\);\s*<\/script>/g, '\n  <script src="/v1-assets/js/results-preview.js"></script>')
    .replace(/\s*<link rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net" crossorigin>\s*/g, '\n')
    .replace(/href="admin\.html([^"#]*)"/g, 'href="/admin$1"')
    .replace(/href="stewards\.html([^"#]*)"/g, 'href="/stewarding$1"');
  if (includeBase && !output.includes('<base ')) output = output.replace(/<head([^>]*)>/i, '<head$1>\n  <base href="/">');
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
  await writeFile(resolve(componentsDestination, component), transformHtml(source), 'utf8');
}

for (const page of publicPages) {
  const source = await readFile(resolve(repositoryRoot, `${page}.html`), 'utf8');
  await writeFile(resolve(distRoot, `${page}.html`), transformHtml(source), 'utf8');
  const cleanRoute = resolve(distRoot, page, 'index.html');
  await mkdir(dirname(cleanRoute), { recursive: true });
  await writeFile(cleanRoute, transformHtml(source, true), 'utf8');
}

console.log(`Restored ${publicPages.length} complete V1 public views inside V2, including track maps and track information.`);
