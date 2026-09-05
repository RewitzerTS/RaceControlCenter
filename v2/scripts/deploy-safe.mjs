import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBuildTarget } from './environment-targets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [mode, ...args] = process.argv.slice(2);
if (!['staging', 'production', 'preview'].includes(mode)) throw new Error('Explicit deployment target required.');
const dryRun = args.includes('--dry-run');
const allowedArgs = args.filter((arg) => arg !== '--dry-run');
if (allowedArgs.length && !(allowedArgs.length === 2 && allowedArgs[0] === '--outdir')) {
  throw new Error('Target overrides are not accepted by the safe deployment command.');
}

if (mode === 'production' && !dryRun) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  if (dirty || process.env.RACEVORA_APPROVED_LIVE_COMMIT !== commit) {
    throw new Error('Live deployment blocked. Obtain explicit owner approval for this clean commit, then set RACEVORA_APPROVED_LIVE_COMMIT for this invocation only.');
  }
  if (process.env.CI || process.env.WORKERS_CI) throw new Error('Automatic production deployment is disabled.');
}

const targetMode = mode === 'production' ? 'production' : 'staging';
const build = spawnSync(`npm run build:${targetMode}`, { cwd: root, shell: true, stdio: 'inherit' });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
const target = JSON.parse(readFileSync(resolve(root, 'dist/build-target.json'), 'utf8'));
assertBuildTarget(target);
if (target.VITE_APP_ENV !== targetMode) throw new Error('Built artifact does not match deployment target.');
const configFile = mode === 'production' ? 'wrangler.cutover.jsonc' : 'wrangler.jsonc';
const config = JSON.parse(readFileSync(resolve(root, configFile), 'utf8'));
if (config.name !== `racevora-v2-${targetMode}`) throw new Error('Unexpected Worker target.');
if (mode !== 'production' && (config.routes?.length || config.route || config.send_email?.length || config.services?.length)) {
  throw new Error('Staging must have no live routes, email or service bindings.');
}
const command = mode === 'preview' && !dryRun ? ['versions', 'upload'] : ['deploy'];
const run = spawnSync(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), ...command,
  '--config', configFile, ...(dryRun ? ['--dry-run'] : []), ...allowedArgs], { cwd: root, stdio: 'inherit' });
if (run.error) throw run.error;
process.exit(run.status ?? 1);
