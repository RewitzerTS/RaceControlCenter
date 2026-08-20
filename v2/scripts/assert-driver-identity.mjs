import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260820152536_v2_global_driver_identity.sql'),
  'utf8',
);
const hardeningMigration = await readFile(
  resolve(root, 'supabase/migrations/20260820152940_v2_immutable_linked_claim_evidence.sql'),
  'utf8',
);
const regression = await readFile(resolve(root, 'supabase/tests/phase-4-driver-identity.sql'), 'utf8');

const requiredContracts = [
  'create table public.drivers',
  'create table public.driver_identities',
  'create table public.driver_claims',
  'create table public.driver_identity_links',
  'create table public.driver_aliases',
  'constraint driver_identities_user_id_unique unique (user_id)',
  "verification_method in ('league_invitation', 'unique_claim_link', 'admin_verified')",
  'a driver identity link requires a matching verified claim',
  'alias equality is never identity proof',
  'revoke all on table public.driver_claims from public, anon, authenticated',
];

const violations = requiredContracts
  .filter((contract) => !migration.toLowerCase().includes(contract.toLowerCase()))
  .map((contract) => `missing driver identity contract: ${contract}`);

for (const table of [
  'drivers',
  'driver_identities',
  'driver_claims',
  'driver_identity_links',
  'driver_aliases',
]) {
  if (!migration.toLowerCase().includes(`alter table public.${table} enable row level security`)) {
    violations.push(`RLS is not enabled for ${table}`);
  }
}

if (/grant\s+(?:all|select)[^;]*driver_claims[^;]*\b(?:anon|authenticated)\b/i.test(migration)) {
  violations.push('driver_claims is exposed to a browser role');
}
if (/verification_method\s+in\s*\([^)]*(?:gamertag|display_name|real_name|alias)/i.test(migration)) {
  violations.push('a mutable name or alias is accepted as claim verification');
}
if (!/new\s+is\s+distinct\s+from\s+old/i.test(hardeningMigration)) {
  violations.push('linked claim evidence is not fully immutable');
}
if (!/begin;[\s\S]*rollback;\s*$/i.test(regression)) {
  violations.push('Phase 4 regression fixtures are not transactionally rolled back');
}
if (!/aliases created an identity link without verified evidence/i.test(regression)) {
  violations.push('regression does not prove that aliases cannot create links');
}
if (!/anonymous cross-tenant driver isolation failed/i.test(regression)) {
  violations.push('regression does not cover cross-tenant driver reads');
}

if (violations.length > 0) {
  console.error(`V2 driver identity check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log('V2 driver identity check passed. Claims, aliases, RLS, and rollback contracts are present.');
