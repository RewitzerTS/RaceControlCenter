import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const v2Root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const examplePath = resolve(v2Root, '.env.staging.example');
const stagingEnvironment = { ...process.env };

for (const rawLine of (await readFile(examplePath, 'utf8')).split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const separator = line.indexOf('=');
  if (separator < 1) throw new Error(`Invalid staging environment line: ${rawLine}`);
  stagingEnvironment[line.slice(0, separator)] = line.slice(separator + 1);
}

if (stagingEnvironment.VITE_APP_ENV !== 'staging') {
  throw new Error('The staging environment template must set VITE_APP_ENV=staging.');
}

const result = spawnSync('npm run build', {
  cwd: v2Root,
  env: stagingEnvironment,
  shell: true,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
