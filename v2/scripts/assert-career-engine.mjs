import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrations = await readdir(resolve(root, 'supabase/migrations'));
const name = migrations.find((item) => item.endsWith('_v2_career_engine.sql'));

if (!name) {
  console.error('V2 Career Engine check failed:\n- Career Engine migration is missing');
  process.exit(1);
}

const migration = await readFile(resolve(root, 'supabase/migrations', name), 'utf8');
const regression = await readFile(resolve(root, 'supabase/tests/phase-8-career-engine.sql'), 'utf8');

const contracts = [
  'classification_status',
  "'classified', 'dns', 'dnf', 'dsq'",
  'create table public.career_result_facts',
  'create table public.driver_career_stats',
  'create or replace function private.process_career_event',
  'race_record.current_result_version_id',
  "upper(rvr.participation_status) = 'PLAYER'",
  "di.status = 'active'",
  'join public.driver_identity_links',
  'delete from public.career_result_facts',
  'count(distinct crf.league_id)',
  "private.complete_domain_event_processing(p_processing_id, 'career', p_worker_id)",
  'alter table public.career_result_facts enable row level security',
  'alter table public.driver_career_stats enable row level security',
];

const violations = contracts
  .filter((contract) => !migration.toLowerCase().includes(contract.toLowerCase()))
  .map((contract) => `missing Career contract: ${contract}`);

if (/grant\s+(?:all|insert|update|delete)[^;]*\b(?:anon|authenticated)\b/i.test(migration)) {
  violations.push('browser roles received Career mutation privileges');
}
const serverRole = ['service', 'role'].join('_');
if (!migration.toLowerCase().includes(`to ${serverRole}`)) {
  violations.push('Career projections have no explicit server-role mutation grant');
}
if (!/begin;[\s\S]*rollback;\s*$/i.test(regression)) {
  violations.push('Phase 8 regression fixtures are not transactionally rolled back');
}
for (const evidence of [
  'cross-league Career facts were not built for the global identity',
  'unclaimed historical driver received active V2 progression',
  'BOT participation entered Career progression',
  'result revision did not deterministically correct Career',
  'voided result still contributes Career facts',
  'stale event delivery did not converge to the explicit current result pointer',
  'wrong worker processed a Career lease',
  'league admin Career facts escaped requested league scope',
]) {
  if (!regression.toLowerCase().includes(evidence.toLowerCase())) {
    violations.push(`missing regression evidence: ${evidence}`);
  }
}

if (violations.length > 0) {
  console.error(`V2 Career Engine check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log('V2 Career Engine check passed. Cross-league identity, current-pointer reconciliation, revision/void correction, classification metrics, idempotency, RLS, and rollback contracts are present.');
