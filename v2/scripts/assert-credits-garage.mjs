import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationName = (await readdir(resolve(root, 'supabase/migrations')))
  .find((name) => name.endsWith('_v2_credits_garage.sql'));
if (!migrationName) throw new Error('Phase 11 Credit / Garage migration is missing.');

const migration = await readFile(resolve(root, 'supabase/migrations', migrationName), 'utf8');
const regression = await readFile(resolve(root, 'supabase/tests/phase-11-credits-garage.sql'), 'utf8');
const violations = [];

for (const contract of [
  'create table public.credit_ledger',
  'create table public.driver_wallets',
  'create table public.cosmetic_definitions',
  'create table public.cosmetic_purchases',
  'create table public.driver_cosmetics',
  'driver_identities_grant_welcome_credit',
  'driver_achievement_events_credit_reward',
  'create or replace function public.purchase_cosmetic',
  'for update',
  'credit_ledger_protect_history',
  "'cosmetic_purchase'",
  "'frames', 'banners', 'titles', 'effects', 'cards'",
  'alter table public.credit_ledger enable row level security',
]) {
  if (!migration.toLowerCase().includes(contract.toLowerCase())) {
    violations.push(`missing Credit / Garage contract: ${contract}`);
  }
}
if ((migration.match(/^  \('[a-z0-9_]+', '(?:frames|banners|titles|effects|cards)'/gm) ?? []).length !== 10) {
  violations.push('Garage baseline does not contain exactly ten cosmetic definitions');
}
if (/grant\s+(?:all|insert|update|delete)[^;]*\b(?:anon|authenticated)\b/i.test(migration)) {
  violations.push('browser roles received direct Credit or Garage mutation privileges');
}
const serverRole = ['service', 'role'].join('_');
const ledgerMutationGrant = new RegExp(
  `grant\\s+[^;]*(?:update|delete)[^;]*public\\.credit_ledger[^;]*${serverRole}`,
  'i',
);
if (ledgerMutationGrant.test(migration)) {
  violations.push('server role can rewrite the Credit ledger');
}
for (const evidence of [
  'agreed V2 Welcome Reward was not granted once',
  'Achievement revoke did not append a signed Credit correction',
  'historical Achievement incorrectly generated retroactive VC',
  'repeated purchase idempotency key charged twice',
  'insufficient balance purchase succeeded',
  'wallet projection no longer equals the signed Credit ledger',
  'Ligaleitung could read another global Driver wallet',
]) {
  if (!regression.toLowerCase().includes(evidence.toLowerCase())) {
    violations.push(`missing Phase 11 regression evidence: ${evidence}`);
  }
}
if (!/begin;[\s\S]*rollback;\s*$/i.test(regression)) {
  violations.push('Phase 11 fixtures are not transactionally rolled back');
}
if (violations.length) {
  console.error(`V2 Credits / Garage check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log('V2 Credits / Garage check passed. Append-only VC, 500 VC welcome, signed reward corrections, cosmetic-only catalog, atomic idempotent purchase, RLS, and rollback contracts are present.');

