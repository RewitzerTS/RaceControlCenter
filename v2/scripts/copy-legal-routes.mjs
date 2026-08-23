import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
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
  'widerruf.html',
  'assets/css/pages/legal.css',
  'assets/images/racevora-mark.svg',
];

for (const relativePath of preservedFiles) {
  const destination = resolve(distRoot, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(repositoryRoot, relativePath), destination);
}

const withdrawalPath = resolve(distRoot, 'widerruf.html');
let withdrawal = await readFile(withdrawalPath, 'utf8');

if (appEnvironment === 'production') {
  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const publishableKey = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (supabaseUrl !== 'https://znnkwjogtvzwfkwnmawp.supabase.co' || !publishableKey.startsWith('sb_publishable_')) {
    throw new Error('Production legal build requires the dedicated V2 Supabase URL and publishable key.');
  }

  const configPath = resolve(distRoot, 'assets/js/v2-withdrawal-config.js');
  const adapterPath = resolve(distRoot, 'assets/js/v2-withdrawal-adapter.js');
  const clientPath = resolve(distRoot, 'assets/js/pages/withdrawal.js');
  await mkdir(dirname(configPath), { recursive: true });
  await mkdir(dirname(clientPath), { recursive: true });
  await writeFile(configPath, `window.RACEVORA_V2_WITHDRAWAL_CONFIG = ${JSON.stringify({
    endpoint: `${supabaseUrl}/functions/v1/submit-consumer-withdrawal`,
    publishableKey,
  })};\n`, 'utf8');
  await copyFile(resolve(v2Root, 'scripts/v2-withdrawal-adapter.js'), adapterPath);
  await copyFile(resolve(repositoryRoot, 'assets/js/pages/withdrawal.js'), clientPath);

  withdrawal = withdrawal
    .replace('<section class="withdrawal-panel"', '<section class="withdrawal-panel" data-v2-production-withdrawal')
    .replace(/^\s*<script src="https:\/\/cdn\.jsdelivr\.net[^\n]+\n/gm, '')
    .replace(/^\s*<script src="assets\/js\/supabase-client\.js"><\/script>\s*\n/gm, '')
    .replace(
      '  <script src="assets/js/pages/withdrawal.js"></script>',
      '  <script src="assets/js/v2-withdrawal-config.js"></script>\n  <script src="assets/js/v2-withdrawal-adapter.js"></script>\n  <script src="assets/js/pages/withdrawal.js"></script>',
    );
  await writeFile(withdrawalPath, withdrawal, 'utf8');

  const indexPath = resolve(distRoot, 'index.html');
  const headersPath = resolve(distRoot, '_headers');
  const robotsPath = resolve(distRoot, 'robots.txt');
  const index = (await readFile(indexPath, 'utf8'))
    .replace('<meta name="robots" content="noindex, nofollow" />', '<meta name="robots" content="index, follow" />')
    .replace('RaceVora V2 staging foundation', 'RaceVora – Race Management Platform')
    .replace('<title>RaceVora V2 · Staging</title>', '<title>RaceVora · Race Management Platform</title>');
  const headers = (await readFile(headersPath, 'utf8'))
    .replace(/^\s*X-Robots-Tag: noindex, nofollow\s*\r?\n/m, '');
  await writeFile(indexPath, index, 'utf8');
  await writeFile(headersPath, headers, 'utf8');
  await writeFile(robotsPath, 'User-agent: *\nAllow: /\n', 'utf8');

  console.log('Preserved four V1 legal routes with the dedicated V2 production withdrawal endpoint.');
  process.exit(0);
}

// Non-production builds must never submit legal requests to either Production
// backend. Keep the V1 presentation and legal information, but replace the
// interactive form with a truthful email route.
const interactiveStart = withdrawal.indexOf('      <div class="legal-note">');
const interactiveEnd = withdrawal.indexOf('      <h2>Widerrufsrecht</h2>');
if (interactiveStart === -1 || interactiveEnd === -1 || interactiveEnd <= interactiveStart) {
  throw new Error('V1 withdrawal page structure changed; safe staging replacement was not applied.');
}

const stagingWithdrawal = `      <div class="legal-note" data-v2-staging-withdrawal><strong>Widerruf in der Beta:</strong> Diese getrennte Testumgebung ist absichtlich nicht mit dem produktiven Widerrufssystem verbunden. Du kannst deinen Widerruf rechtswirksam per E-Mail an RaceVora senden.</div>

      <section class="withdrawal-panel" aria-labelledby="withdrawal-staging-title">
        <h2 id="withdrawal-staging-title">Widerruf per E-Mail senden</h2>
        <p>Nutze die folgende E-Mail-Adresse und nenne deinen vollständigen Namen sowie deine RaceVora-Account-, Liga- oder Vertragskennung. Zur Wahrung der Widerrufsfrist reicht die rechtzeitige Absendung.</p>
        <div class="legal-actions">
          <a class="legal-button" href="mailto:kontakt@racevora.com?subject=Widerruf%20RaceVora">E-Mail für Widerruf öffnen</a>
        </div>
      </section>

`;
withdrawal = `${withdrawal.slice(0, interactiveStart)}${stagingWithdrawal}${withdrawal.slice(interactiveEnd)}`
  .replace('Widerrufsinformationen und elektronische Widerrufsfunktion für Verbraucher bei RaceVora.', 'Widerrufsinformationen für Verbraucher bei RaceVora.')
  .replace('Elektronische Widerrufsfunktion · Stand:', 'Widerrufsinformation · Stand:')
  .replace('Du kannst die elektronische Widerrufsfunktion oben nutzen oder uns eine andere eindeutige Widerrufserklärung senden:', 'Du kannst uns deine eindeutige Widerrufserklärung insbesondere per E-Mail oder Post senden:')
  .replace('Die elektronische Widerrufsfunktion oben ist eine zusätzliche Möglichkeit.', 'Die Übermittlung per E-Mail ist eine zusätzliche Möglichkeit.')
  .replace(/^\s*<script src="https:\/\/cdn\.jsdelivr\.net[^\n]+\n/gm, '')
  .replace(/^\s*<script src="assets\/js\/supabase-client\.js"><\/script>\s*\n/gm, '')
  .replace(/^\s*<script src="assets\/js\/pages\/withdrawal\.js"><\/script>\s*\n/gm, '');
await writeFile(withdrawalPath, withdrawal, 'utf8');

console.log('Preserved four V1 legal routes with a production-isolated non-production withdrawal path.');
