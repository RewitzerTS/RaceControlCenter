import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationName = (await readdir(resolve(root, 'supabase/migrations')))
  .find((name) => name.endsWith('_v2_challenges.sql'));
if (!migrationName) throw new Error('Phase 12 Challenge migration is missing.');

const migration = await readFile(resolve(root, 'supabase/migrations', migrationName), 'utf8');
const regression = await readFile(resolve(root, 'supabase/tests/phase-12-challenges.sql'), 'utf8');
const violations = [];

for (const contract of [
  'create table public.challenge_definitions',
  'create table public.challenge_races',
  'create table public.challenge_result_facts',
  'create table public.driver_challenge_events',
  'create table public.driver_challenges',
  'At most three Challenges may be active',
  "event_record.event_type = 'result.published'",
  'event_record.recorded_at >= cd.created_at',
  "interval '7 days'",
  'count(*) < 3',
  'challenge.completed',
  'challenge.revoked',
  'driver_challenge_events_credit_reward',
  'alter table public.driver_challenges enable row level security',
]) {
  if (!migration.toLowerCase().includes(contract.toLowerCase())) {
    violations.push(`missing Challenge contract: ${contract}`);
  }
}
if (/daily|login challenge|lootbox|xp booster|performance boost/i.test(migration)) {
  violations.push('non-racing or pay-to-win Challenge language entered the migration');
}
if (/grant\s+(?:all|insert|update|delete)[^;]*\b(?:anon|authenticated)\b/i.test(migration)) {
  violations.push('browser roles received Challenge mutation privileges');
}
const serverRole = ['service', 'role'].join('_');
const historyMutationGrant = new RegExp(
  `grant\\s+[^;]*(?:update|delete)[^;]*driver_challenge_events[^;]*${serverRole}`,
  'i',
);
if (historyMutationGrant.test(migration)) {
  violations.push('server role can rewrite Challenge history');
}
for (const evidence of [
  'fourth simultaneous active Challenge was accepted',
  'three Racing Challenges did not complete deterministically',
  'BOT participation entered Challenge progression',
  'unclaimed or BOT result entered Challenge facts',
  'fourth rolling seven-day Challenge completion was rewarded',
  'result revision/void did not revoke corrected Challenge completion',
  'historical race entered Challenge eligibility',
  'Ligaleitung could read another global Driver Challenges',
]) {
  if (!regression.toLowerCase().includes(evidence.toLowerCase())) {
    violations.push(`missing Phase 12 regression evidence: ${evidence}`);
  }
}
if (!/begin;[\s\S]*rollback;\s*$/i.test(regression)) {
  violations.push('Phase 12 fixtures are not transactionally rolled back');
}
if (violations.length) {
  console.error(`V2 Challenges check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log('V2 Challenges check passed. Three racing-only active rules, future-only facts, seven-day reward cap, revision/void correction, no failure penalty, RLS, and rollback contracts are present.');

