import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260820154039_v2_normalize_role_model.sql'),
  'utf8',
);
const regression = await readFile(resolve(root, 'supabase/tests/phase-5-role-model.sql'), 'utf8');

const contracts = [
  "check (role in ('driver', 'steward', 'league_admin'))",
  "when 'admin' then 'league_admin'",
  "when 'owner' then 'league_admin'",
  'create or replace function public.current_app_role()',
  'security invoker',
  "return 'platform_owner'",
  'create or replace function private.has_league_capability',
  'a league role requires an active registered driver identity',
  'platform ownership is never stored here',
];

const violations = contracts
  .filter((contract) => !migration.toLowerCase().includes(contract.toLowerCase()))
  .map((contract) => `missing role-model contract: ${contract}`);

if (/check\s*\(\s*role\s+in\s*\([^)]*platform_owner/i.test(migration)) {
  violations.push('platform_owner can be stored as a league role');
}
if (/grant\s+execute[^;]*current_app_role[^;]*\banon\b/i.test(migration)) {
  violations.push('anonymous callers can resolve application roles');
}
if (!/begin;[\s\S]*rollback;\s*$/i.test(regression)) {
  violations.push('Phase 5 regression fixtures are not transactionally rolled back');
}
if (!/driver capability crossed the requested tenant/i.test(regression)) {
  violations.push('role regression does not prove tenant-bound capabilities');
}
if (!/platform_owner was assigned through league membership/i.test(regression)) {
  violations.push('role regression does not prove owner separation');
}

if (violations.length > 0) {
  console.error(`V2 role model check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log('V2 role model check passed. Exact roles, hierarchy, owner separation, and rollback contracts are present.');
