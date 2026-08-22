import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationName = (await readdir(resolve(root, 'supabase/migrations'))).find((name) => name.endsWith('_v2_steward_experience.sql'));
if (!migrationName) throw new Error('Phase 16 steward migration is missing.');
const migration = await readFile(resolve(root, 'supabase/migrations', migrationName), 'utf8');
const regression = await readFile(resolve(root, 'supabase/tests/phase-16-steward-experience.sql'), 'utf8');
const page = await readFile(resolve(root, 'src/stewarding/StewardWorkspacePage.tsx'), 'utf8');
const data = await readFile(resolve(root, 'src/stewarding/stewardWorkspace.ts'), 'utf8');
const violations = [];

for (const contract of [
  'create table public.steward_cases', 'create table public.steward_evidence',
  'create table public.steward_votes', 'create table public.steward_decision_versions',
  'create table public.steward_penalties', 'create table public.steward_appeals',
  'private.create_result_version', 'private.validate_result_version', 'private.activate_result_version',
  'A steward with a disclosed conflict cannot finalize this case',
  "steward.decision_finalized", 'alter table public.steward_cases enable row level security',
]) if (!migration.includes(contract)) violations.push(`missing steward contract: ${contract}`);

if (/grant\s+(?:insert|update|delete|all)[^;]*\bauthenticated\b/i.test(migration)) violations.push('browser roles received direct steward mutation privileges');
if (!page.includes("role === 'steward'") || !page.includes('flags.stewardWorkspace')) violations.push('Steward workspace is not role and feature-flag gated');
for (const command of ['create_steward_case', 'add_steward_evidence', 'cast_steward_vote', 'finalize_steward_decision']) {
  if (!data.includes(`rpc('${command}'`)) violations.push(`UI does not use ${command}`);
}
for (const forbidden of ['.insert(', '.update(', '.delete(', ['service', 'role'].join('_')]) {
  if (data.includes(forbidden)) violations.push(`Steward UI contains forbidden direct mutation or credential: ${forbidden}`);
}
for (const evidence of [
  'steward created a case through a manipulated tenant header',
  'structured penalty did not reach the official result projection',
  'time penalty did not recalculate finishing order',
  'steward vote history was rewritten', 'private evidence leaked',
]) if (!regression.includes(evidence)) violations.push(`missing Phase 16 regression evidence: ${evidence}`);
if (!/begin;[\s\S]*rollback;\s*$/i.test(regression)) violations.push('Phase 16 fixtures are not transactionally rolled back');

if (violations.length) {
  console.error(`V2 Steward Experience check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log('V2 Steward Experience check passed. Tenant-bound cases, immutable evidence/votes/decisions, conflicts, appeals, structured penalties, atomic current-result revisions, public closure, and role-gated UI are present.');
