import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260820150732_v2_additive_tenancy_foundation.sql'),
  'utf8',
);
const regression = await readFile(resolve(root, 'supabase/tests/phase-3-foundation.sql'), 'utf8');

const requiredMigrationContracts = [
  'create table public.leagues',
  'create table public.league_members',
  'create table public.platform_owners',
  'alter table public.leagues enable row level security',
  'alter table public.league_members enable row level security',
  'alter table public.platform_owners enable row level security',
  "'x-rcc-league-slug'",
  'revoke all on table public.platform_owners from public, anon, authenticated',
  'grant select on table public.leagues to anon, authenticated',
  'grant select on table public.league_members to authenticated',
  'set search_path = \'\'',
];

const violations = requiredMigrationContracts
  .filter((contract) => !migration.toLowerCase().includes(contract.toLowerCase()))
  .map((contract) => `missing migration contract: ${contract}`);

if (/grant\s+(?:all|select)[^;]*platform_owners[^;]*\b(?:anon|authenticated)\b/i.test(migration)) {
  violations.push('platform_owners is exposed to a browser role');
}
if (/x-racevora-league/i.test(migration)) {
  violations.push('noncanonical tenant header appears in the migration');
}
if (!/begin;[\s\S]*rollback;\s*$/i.test(regression)) {
  violations.push('database regression fixtures are not transactionally rolled back');
}
if (!/missing tenant header did not fail closed/i.test(regression)) {
  violations.push('database regression does not prove fail-closed tenant resolution');
}
if (!/anon tenant isolation failed/i.test(regression) || !/authenticated tenant isolation failed/i.test(regression)) {
  violations.push('database regression does not cover both browser roles');
}

if (violations.length > 0) {
  console.error(`V2 database foundation check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log('V2 database foundation check passed. RLS, grants, tenant header, and rollback contracts are present.');
