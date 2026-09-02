import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const v2Root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(v2Root, '..');
const distRoot = resolve(v2Root, 'dist');
const appEnvironment = String(process.env.VITE_APP_ENV || 'staging').trim().toLowerCase();
const preservedFiles = [
  'impressum.html',
  'datenschutz.html',
  'agb.html',
  'assets/css/pages/legal.css',
  'assets/images/racevora-logo-color.png',
];
const failures = [];
const protectedV1ProjectRefs = [
  ['kjccstcbqygx', 'uqkvdaqw'].join(''),
  ['lugedxtmfitx', 'rkacmjpb'].join(''),
];

for (const relativePath of preservedFiles) {
  const [source, built] = await Promise.all([
    readFile(resolve(repositoryRoot, relativePath)),
    readFile(resolve(distRoot, relativePath)),
  ]);
  if (!source.equals(built)) failures.push(`${relativePath} differs from the pinned V1 source`);
}

const withdrawal = await readFile(resolve(distRoot, 'widerruf.html'), 'utf8');
const contracts = appEnvironment === 'production'
  ? [
      'data-v2-production-withdrawal',
      'withdrawal-form',
      'v2-withdrawal-config.js',
      'v2-withdrawal-adapter.js',
      'assets/js/pages/withdrawal.js',
      '<h2>Widerrufsrecht</h2>',
      '<h2>Muster-Widerrufsformular</h2>',
    ]
  : [
      'data-v2-staging-withdrawal',
      'mailto:kontakt@racevora.com?subject=Widerruf%20RaceVora',
      '<h2>Widerrufsrecht</h2>',
      '<h2>Muster-Widerrufsformular</h2>',
    ];
for (const contract of contracts) {
  if (!withdrawal.includes(contract)) failures.push(`withdrawal route lost ${contract}`);
}
const forbiddenContracts = appEnvironment === 'production'
  ? ['supabase-client.js', 'cdn.jsdelivr.net', ...protectedV1ProjectRefs]
  : ['withdrawal-form', 'supabase-client.js', 'withdrawal.js', 'cdn.jsdelivr.net', protectedV1ProjectRefs[1]];
for (const forbidden of forbiddenContracts) {
  if (withdrawal.includes(forbidden)) failures.push(`withdrawal route contains forbidden production coupling: ${forbidden}`);
}

if (appEnvironment === 'production') {
  const config = await readFile(resolve(distRoot, 'assets/js/v2-withdrawal-config.js'), 'utf8');
  const adapter = await readFile(resolve(distRoot, 'assets/js/v2-withdrawal-adapter.js'), 'utf8');
  const index = await readFile(resolve(distRoot, 'index.html'), 'utf8');
  const headers = await readFile(resolve(distRoot, '_headers'), 'utf8');
  const robots = await readFile(resolve(distRoot, 'robots.txt'), 'utf8');
  const sitemap = await readFile(resolve(distRoot, 'sitemap.xml'), 'utf8');
  if (!config.includes('https://znnkwjogtvzwfkwnmawp.supabase.co/functions/v1/submit-consumer-withdrawal')) {
    failures.push('production withdrawal config does not target the dedicated V2 endpoint');
  }
  if (!adapter.includes("name !== 'submit-consumer-withdrawal'") || !adapter.includes('apikey: config.publishableKey')) {
    failures.push('production withdrawal adapter lost its endpoint and key boundary');
  }
  if (!index.includes('content="index, follow"') || index.includes('Staging') || index.includes('staging foundation')) {
    failures.push('production index still exposes Staging crawler or page metadata');
  }
  if (/X-Robots-Tag:\s*noindex/i.test(headers)
      || !/^Allow:\s*\/$/m.test(robots)
      || !/^Sitemap:\s*https:\/\/racevora\.com\/sitemap\.xml$/m.test(robots)) {
    failures.push('production crawler policy is not enabled');
  }
  if (!sitemap.includes('<loc>https://racevora.com/</loc>') || sitemap.includes('/login') || sitemap.includes('/admin')) {
    failures.push('production sitemap does not expose only the public canonical landing page');
  }
}

if (failures.length) throw new Error(`V2 legal route contract failed: ${failures.join(', ')}`);
console.log(`V2 legal route contract passed for ${appEnvironment}: V1 presentation is preserved without V1 backend coupling.`);
