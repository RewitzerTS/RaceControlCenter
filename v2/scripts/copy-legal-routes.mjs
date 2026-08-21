import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const v2Root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(v2Root, '..');
const distRoot = resolve(v2Root, 'dist');

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

// The staging build must never submit legal requests to V1 production. Keep
// the V1 presentation and legal information, but replace its production-backed
// form with a truthful, functional email route until the V2 production
// withdrawal endpoint receives an explicit cutover approval.
const withdrawalPath = resolve(distRoot, 'widerruf.html');
let withdrawal = await readFile(withdrawalPath, 'utf8');
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

console.log('Preserved four V1 legal routes with a production-isolated staging withdrawal path.');
