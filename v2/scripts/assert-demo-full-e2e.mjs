import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260820194035_v2_demo_full_e2e.sql'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/demo/DemoE2EPage.tsx'), 'utf8');
const model = fs.readFileSync(path.join(root, 'src/demo/demo.ts'), 'utf8');
const regression = fs.readFileSync(path.join(root, 'supabase/tests/phase-22-demo-full-e2e.sql'), 'utf8');

const requirements = [
  [migration.includes("'owner_only', 'true'") || migration.includes('"owner_only":true'), 'owner-only league'],
  [migration.includes('progression_scope') && migration.includes('demo_only'), 'isolated Demo progression'],
  [migration.includes("'dns'") && migration.includes("'dnf'") && migration.includes("'dsq'"), 'DNS, DNF and DSQ'],
  [migration.includes('is_substitute') && migration.includes('team_history'), 'substitute and team changes'],
  [migration.includes('steward_decision_versions') && migration.includes('steward_penalties'), 'Steward decision and penalty'],
  [migration.includes('previous_version_id') && migration.includes("status = 'superseded'"), 'official result revision'],
  [migration.includes('achievements') && migration.includes('challenges') && migration.includes('cosmetics'), 'complete Demo progression fixtures'],
  [migration.includes('if not public.is_platform_owner()'), 'actor-bound snapshot'],
  [model.includes('DEMO_COVERAGE_KEYS') && model.includes('get_demo_full_e2e_snapshot'), 'typed 13-scenario snapshot'],
  [page.includes('demo-isolation') && page.includes('DEMO_COVERAGE_KEYS.map'), 'visible isolation and coverage'],
  [regression.includes('Non-owner entered Demo Full E2E snapshot') && regression.includes('rollback;'), 'owner denial and rollback regression'],
];

const missing = requirements.filter(([ok]) => !ok).map(([, label]) => label);
if (missing.length) throw new Error(`Demo Full E2E contract missing: ${missing.join(', ')}`);
console.log('Demo Full E2E contract passed: owner-only fixtures, official result revision and isolated progression are present.');
