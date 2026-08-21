import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const v2Root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(v2Root, '..');
const distRoot = resolve(v2Root, 'dist');
const preservedFiles = [
  'impressum.html',
  'datenschutz.html',
  'agb.html',
  'assets/css/pages/legal.css',
  'assets/images/racevora-mark.svg',
];
const failures = [];

for (const relativePath of preservedFiles) {
  const [source, built] = await Promise.all([
    readFile(resolve(repositoryRoot, relativePath)),
    readFile(resolve(distRoot, relativePath)),
  ]);
  if (!source.equals(built)) failures.push(`${relativePath} differs from the pinned V1 source`);
}

const withdrawal = await readFile(resolve(distRoot, 'widerruf.html'), 'utf8');
for (const contract of [
  'data-v2-staging-withdrawal',
  'mailto:kontakt@racevora.com?subject=Widerruf%20RaceVora',
  '<h2>Widerrufsrecht</h2>',
  '<h2>Muster-Widerrufsformular</h2>',
]) {
  if (!withdrawal.includes(contract)) failures.push(`withdrawal route lost ${contract}`);
}
for (const forbidden of [
  'withdrawal-form',
  'supabase-client.js',
  'withdrawal.js',
  'cdn.jsdelivr.net',
  'lugedxtmfitxrkacmjpb',
]) {
  if (withdrawal.includes(forbidden)) failures.push(`withdrawal route contains forbidden production coupling: ${forbidden}`);
}

if (failures.length) throw new Error(`V2 legal route contract failed: ${failures.join(', ')}`);
console.log('V2 legal route contract passed: V1 legal presentation is preserved without a staging-to-production data path.');
