import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationDirectory = resolve(root, 'supabase/migrations');
const migrationName = (await readdir(migrationDirectory))
  .find((name) => name.endsWith('_v2_result_versioning.sql'));

if (!migrationName) {
  console.error('V2 result versioning check failed:\n- result versioning migration is missing');
  process.exit(1);
}

const migration = await readFile(resolve(migrationDirectory, migrationName), 'utf8');
const hardeningName = (await readdir(migrationDirectory))
  .find((name) => name.endsWith('_v2_lock_result_version_audit.sql'));
const hardening = hardeningName
  ? await readFile(resolve(migrationDirectory, hardeningName), 'utf8')
  : '';
const regression = await readFile(
  resolve(root, 'supabase/tests/phase-6-result-versioning.sql'),
  'utf8',
);

const contracts = [
  'create table public.result_versions',
  'create table public.result_version_rows',
  'current_result_version_id uuid',
  'next_result_version_number integer not null default 1',
  'create or replace function private.create_result_version',
  'for update',
  'create or replace function private.validate_result_version',
  'create or replace function private.activate_result_version',
  'create or replace function private.void_current_result_version',
  "status = 'superseded'",
  "status = 'void'",
  'delete from public.race_results',
  'insert into public.race_results',
  'result_versions_one_active_per_race',
  'official versions are superseded or voided, never overwritten',
];

const violations = contracts
  .filter((contract) => !migration.toLowerCase().includes(contract.toLowerCase()))
  .map((contract) => `missing result-versioning contract: ${contract}`);

if (/max\s*\(\s*version(?:_number)?\s*\)/i.test(migration)) {
  violations.push('current result state can be inferred with MAX(version)');
}
if (!hardening.toLowerCase().includes('result activation evidence is immutable')) {
  violations.push('official lifecycle audit evidence is not locked');
}
if (/grant\s+(?:all|insert|update|delete)[^;]*\b(?:anon|authenticated)\b/i.test(migration)) {
  violations.push('browser roles received result workflow mutation privileges');
}
if (!/begin;[\s\S]*rollback;\s*$/i.test(regression)) {
  violations.push('Phase 6 regression fixtures are not transactionally rolled back');
}
for (const evidence of [
  'revision overwrote historical version rows',
  'a race accepted another race current result pointer',
  'cross-tenant driver was accepted into result version',
  'void did not clear the explicit current pointer',
  'void official version was hard-deleted',
  'official lifecycle audit evidence was mutable',
]) {
  if (!regression.toLowerCase().includes(evidence.toLowerCase())) {
    violations.push(`missing regression evidence: ${evidence}`);
  }
}

if (violations.length > 0) {
  console.error(`V2 result versioning check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log('V2 result versioning check passed. Explicit current pointers, immutable revisions, atomic projection, void, tenant isolation, and rollback contracts are present.');
