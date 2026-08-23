import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrations = await readdir(resolve(root, 'supabase/migrations'));
const name = migrations.find((item) => item.endsWith('_v2_xp_level_rank.sql'));

if (!name) {
  console.error('V2 XP / Level / Rank check failed:\n- Phase 9 migration is missing');
  process.exit(1);
}

const migration = await readFile(resolve(root, 'supabase/migrations', name), 'utf8');
const regression = await readFile(resolve(root, 'supabase/tests/phase-9-xp-level-rank.sql'), 'utf8');

const contracts = [
  'create table public.xp_ledger',
  'xp_ledger_idempotency_key_unique',
  'xp_ledger_amount_nonzero_check',
  'create table public.driver_progression',
  'create or replace function private.xp_for_result_v1',
  'create or replace function private.level_from_lifetime_xp',
  'create or replace function private.rank_from_level',
  "when p_level = 100 then 'Immortal'",
  'create or replace function private.protect_xp_ledger',
  'before update or delete on public.xp_ledger',
  'create or replace function private.process_xp_event',
  'race_record.current_result_version_id',
  "'result_adjustment'",
  'target.desired_xp - target.current_xp',
  "private.complete_domain_event_processing(p_processing_id, 'xp', p_worker_id)",
  'alter table public.xp_ledger enable row level security',
  'alter table public.driver_progression enable row level security',
];

const violations = contracts
  .filter((contract) => !migration.toLowerCase().includes(contract.toLowerCase()))
  .map((contract) => `missing XP contract: ${contract}`);

if (/grant\s+(?:all|insert|update|delete)[^;]*\b(?:anon|authenticated)\b/i.test(migration)) {
  violations.push('browser roles received XP or progression mutation privileges');
}
const serverRole = ['service', 'role'].join('_');
if (!migration.toLowerCase().includes(`grant select, insert on table public.xp_ledger to ${serverRole}`)) {
  violations.push('XP ledger has no explicit append-only server grant');
}
const xpLedgerMutationGrant = new RegExp(
  `grant\\s+[^;]*(?:update|delete)[^;]*public\\.xp_ledger[^;]*${serverRole}`,
  'i',
);
if (xpLedgerMutationGrant.test(migration)) {
  violations.push('server role can rewrite or delete XP history');
}
if (!/begin;[\s\S]*rollback;\s*$/i.test(regression)) {
  violations.push('Phase 9 regression fixtures are not transactionally rolled back');
}
for (const evidence of [
  'Level 100 Immortal or another Rank boundary is incorrect',
  'wrong worker processed an XP lease',
  'zero, BOT, or unclaimed result produced an XP ledger entry',
  'cross-league Lifetime XP projection is incorrect',
  'result revision hid history instead of appending negative XP',
  'result void did not append an XP reversal',
  'stale XP event did not converge to the explicit current result pointer',
  'XP ledger entry was mutable',
  'league admin XP ledger escaped requested league scope',
]) {
  if (!regression.toLowerCase().includes(evidence.toLowerCase())) {
    violations.push(`missing regression evidence: ${evidence}`);
  }
}

if (violations.length > 0) {
  console.error(`V2 XP / Level / Rank check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log('V2 XP / Level / Rank check passed. Append-only rewards, signed corrections, current-pointer convergence, Level 1-100, Immortal, idempotency, RLS, and rollback contracts are present.');
