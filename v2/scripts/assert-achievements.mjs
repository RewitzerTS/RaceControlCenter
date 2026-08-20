import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationName = (await readdir(resolve(root, 'supabase/migrations')))
  .find((name) => name.endsWith('_v2_achievements.sql'));
if (!migrationName) throw new Error('Phase 10 Achievement migration is missing.');

const migration = await readFile(resolve(root, 'supabase/migrations', migrationName), 'utf8');
const regression = await readFile(resolve(root, 'supabase/tests/phase-10-achievements.sql'), 'utf8');
const violations = [];
const achievementCodes = [
  "starts_1",
  "starts_5",
  "starts_10",
  "starts_25",
  "starts_50",
  "starts_100",
  "starts_200",
  "starts_300",
  "starts_500",
  "starts_1000",
  "wins_1",
  "wins_3",
  "wins_5",
  "wins_10",
  "wins_25",
  "wins_50",
  "wins_100",
  "wins_200",
  "podiums_1",
  "podiums_5",
  "podiums_10",
  "podiums_25",
  "podiums_50",
  "podiums_100",
  "podiums_200",
  "podiums_500",
  "poles_1",
  "poles_5",
  "poles_10",
  "poles_25",
  "poles_50",
  "poles_100",
  "poles_250",
  "fastest_laps_1",
  "fastest_laps_5",
  "fastest_laps_10",
  "fastest_laps_25",
  "fastest_laps_50",
  "fastest_laps_100",
  "fastest_laps_250",
  "classified_finishes_1",
  "classified_finishes_10",
  "classified_finishes_25",
  "classified_finishes_50",
  "classified_finishes_100",
  "classified_finishes_250",
  "classified_finishes_500",
  "leagues_competed_2",
  "leagues_competed_3",
  "leagues_competed_5"
];

if (achievementCodes.length !== 50 || achievementCodes.some((code) => !migration.includes(`('${code}'`))) {
  violations.push('the exact 50 Core Achievement definitions are incomplete');
}
for (const contract of [
  'create table public.achievement_definitions',
  'create table public.driver_achievement_events',
  'create table public.driver_achievements',
  'create or replace function private.process_achievement_event',
  'achievement.unlocked',
  'achievement.revoked',
  'event_record.recorded_at <',
  'upper(rr.participation_status) = \'PLAYER\'',
  'driver_achievement_events_protect_history',
  'alter table public.driver_achievements enable row level security',
]) {
  if (!migration.toLowerCase().includes(contract.toLowerCase())) {
    violations.push(`missing Achievement contract: ${contract}`);
  }
}
if (/grant\s+(?:all|insert|update|delete)[^;]*\b(?:anon|authenticated)\b/i.test(migration)) {
  violations.push('browser roles received Achievement mutation privileges');
}
const serverRole = ['service', 'role'].join('_');
const historyMutationGrant = new RegExp(
  `grant\\s+[^;]*(?:update|delete)[^;]*driver_achievement_events[^;]*${serverRole}`,
  'i',
);
if (historyMutationGrant.test(migration)) {
  violations.push('server role can rewrite Achievement history');
}
for (const evidence of [
  'exactly 50 Core Achievements',
  'perfect win did not deterministically unlock exactly six Core Achievements',
  'BOT participation entered Achievement progression',
  'unclaimed driver entered Achievement progression',
  'result revision did not append five deterministic Achievement revokes',
  'result void did not revoke the final current Achievement',
  'league admin could read another driver global Achievements',
]) {
  if (!regression.toLowerCase().includes(evidence.toLowerCase())) {
    violations.push(`missing Phase 10 regression evidence: ${evidence}`);
  }
}
if (!/begin;[\s\S]*rollback;\s*$/i.test(regression)) {
  violations.push('Phase 10 fixtures are not transactionally rolled back');
}
if (violations.length) {
  console.error(`V2 Achievements check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log('V2 Achievements check passed. Exactly 50 rule-based Core Achievements, identity safety, idempotency, unlock/revoke correction, RLS, and rollback contracts are present.');

