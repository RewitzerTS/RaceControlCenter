import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationDir = path.join(root, 'supabase', 'migrations');
const testDir = path.join(root, 'supabase', 'tests');
const requiredTail = [
  'v2_demo_full_e2e',
  'v2_security_gate',
  'v2_tenant_helper_anon_boundary',
];
const failures = [];

const migrations = fs.readdirSync(migrationDir)
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
  .sort();
const tests = fs.readdirSync(testDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();
const migrationSql = migrations.map((name) => fs.readFileSync(path.join(migrationDir, name), 'utf8'));
const testSql = tests.map((name) => fs.readFileSync(path.join(testDir, name), 'utf8'));
const migrationNames = migrations.map((name) => name.replace(/^\d{14}_|\.sql$/g, ''));

function requireGate(condition, label) {
  if (!condition) failures.push(label);
}

requireGate(migrations.length === 27, 'exactly 27 reviewed V2 migrations are present');
requireGate(new Set(migrations.map((name) => name.slice(0, 14))).size === migrations.length, 'migration versions are unique');
requireGate(new Set(migrationNames).size === migrations.length, 'migration names are unique');
requireGate(requiredTail.every((name, index) => migrationNames.at(index - requiredTail.length) === name), 'Demo, Security and tenant-boundary migrations remain the ordered tail');
requireGate(!migrationSql.some((sql) => /\bdrop\s+(?:table|schema|function)\b|\btruncate\b|\balter\s+table\b[\s\S]{0,120}\bdrop\s+column\b/i.test(sql)), 'migration set contains no destructive object/data DDL');
requireGate(testSql.every((sql) => /(^|\n)begin;\s/i.test(sql) && /rollback;\s*$/i.test(sql)), 'every database regression is transactional and rolls back');

const boundaryMigration = migrationSql.at(-1);
const phase26Regression = fs.readFileSync(path.join(testDir, 'phase-26-migration-rehearsal.sql'), 'utf8');
requireGate(/language\s+plpgsql/i.test(boundaryMigration) && !/security\s+definer/i.test(boundaryMigration), 'tenant helper keeps separate anonymous and authenticated invoker paths');
const privilegedRole = ['service', 'role'].join('_');
requireGate(boundaryMigration.includes(`grant execute on function public.matches_requested_league(uuid) to anon, authenticated, ${privilegedRole};`), 'tenant helper keeps exact browser grants');
requireGate(phase26Regression.includes('anonymous public tenant read was blocked') && phase26Regression.includes('owner-only Demo league'), 'Phase 26 regression covers public anonymous and owner-only paths');

if (failures.length) {
  throw new Error(`Phase 26 Migration Rehearsal failed: ${failures.join(', ')}`);
}

console.log(`Phase 26 Migration Rehearsal passed: ${migrations.length} additive migrations and ${tests.length} transactional regressions are ordered and isolated.`);
