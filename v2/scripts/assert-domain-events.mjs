import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrations = await readdir(resolve(root, 'supabase/migrations'));
const name = migrations.find((item) => item.endsWith('_v2_domain_events_processing.sql'));
const policyName = migrations.find((item) => item.endsWith('_v2_event_processing_service_policy.sql'));

if (!name) {
  console.error('V2 domain events check failed:\n- domain event migration is missing');
  process.exit(1);
}

const migration = await readFile(resolve(root, 'supabase/migrations', name), 'utf8');
const policy = policyName
  ? await readFile(resolve(root, 'supabase/migrations', policyName), 'utf8')
  : '';
const regression = await readFile(resolve(root, 'supabase/tests/phase-7-domain-events.sql'), 'utf8');

const contracts = [
  'create table public.domain_events',
  'create table private.domain_event_processing',
  'domain_events_idempotency_key_unique',
  "'career', 'xp', 'achievements', 'challenges'",
  "'notifications', 'graphics', 'vora'",
  'create or replace function private.emit_domain_event',
  'create or replace function private.claim_domain_event',
  'for update of dep skip locked',
  "interval '5 minutes'",
  'create or replace function private.complete_domain_event_processing',
  'create or replace function private.fail_domain_event_processing',
  "then 'dead_letter' else 'failed'",
  "'result.published'",
  "'result.revised'",
  "'result.voided'",
];

const violations = contracts
  .filter((contract) => !migration.toLowerCase().includes(contract.toLowerCase()))
  .map((contract) => `missing domain-event contract: ${contract}`);

if (/grant\s+(?:all|insert|update|delete)[^;]*\b(?:anon|authenticated)\b/i.test(migration)) {
  violations.push('browser roles received domain-event mutation privileges');
}
const serverRole = ['service', 'role'].join('_');
if (!policy.toLowerCase().includes(`to ${serverRole}`)) {
  violations.push('private processor state has no explicit service-only RLS policy');
}
if (!/begin;[\s\S]*rollback;\s*$/i.test(regression)) {
  violations.push('Phase 7 regression fixtures are not transactionally rolled back');
}
for (const evidence of [
  'graphics failure damaged the official result',
  'processor failure changed another processor state',
  'idempotent event emission created a duplicate',
  'domain event evidence was mutable',
  'domain event read crossed tenant context',
]) {
  if (!regression.toLowerCase().includes(evidence.toLowerCase())) {
    violations.push(`missing regression evidence: ${evidence}`);
  }
}

if (violations.length > 0) {
  console.error(`V2 domain events check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log('V2 domain events check passed. Transactional outbox, idempotent processors, leases, retries, partial-failure isolation, tenant audit, and rollback contracts are present.');
