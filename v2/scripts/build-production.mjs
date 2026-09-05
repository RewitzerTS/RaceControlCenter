import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProductionBindings } from './production-bindings.mjs';
import { assertBuildTarget } from './environment-targets.mjs';

const v2Root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await checkProductionBindings(v2Root);
const examplePath = resolve(v2Root, '.env.production.example');
const productionEnvironment = { ...process.env };

for (const rawLine of (await readFile(examplePath, 'utf8')).split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const separator = line.indexOf('=');
  if (separator < 1) throw new Error(`Invalid production environment line: ${rawLine}`);
  productionEnvironment[line.slice(0, separator)] = line.slice(separator + 1);
}

if (productionEnvironment.VITE_APP_ENV !== 'production') {
  throw new Error('The production environment template must set VITE_APP_ENV=production.');
}

assertBuildTarget(productionEnvironment);
const result = spawnSync('npm run build', {
  cwd: v2Root,
  env: productionEnvironment,
  shell: true,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
