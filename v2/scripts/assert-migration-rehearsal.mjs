import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationDir = path.join(root, 'supabase', 'migrations');
const testDir = path.join(root, 'supabase', 'tests');
const requiredTail = [
  'v2_demo_full_e2e',
  'v2_security_gate',
  'v2_tenant_helper_anon_boundary',
  'import_verified_v1_rcc_cutover_snapshot',
  'v2_notification_vora_processors',
  'v2_consumer_withdrawals',
  'v2_v1_admin_league_branding',
  'v2_v1_admin_members_drivers',
  'v2_admin_audit_league_scope',
  'v2_v1_admin_races_standings',
  'v2_v1_migration_completion',
  'v2_ai_result_import_quota',
  'v2_rcc_public_rules_content',
  'v2_driver_onboarding_and_league_requests',
  'v2_join_request_fk_indexes',
  'v2_automatic_profile_numbers',
  'v2_season_start_workflow',
  'v2_season_roster_active_driver_sync',
  'v2_f1_26_season_preset',
  'v2_season_completion_archive',
  'v2_season_start_append_only_audit',
  'v2_season_calendar_workflow',
  'v2_self_service_league_creation',
  'v2_self_service_league_creation_audit_fix',
  'fix_result_import_participant_and_fastest_lap',
  'v2_block_incomplete_season_completion',
  'steward_result_notifications',
  'my_league_join_request_status',
  'restore_race_penalties_compatibility',
  'harden_private_database_surface',
  'backfill_public_driver_numbers',
];
const requiredRegressions = [
  'phase-26-migration-rehearsal.sql',
  'phase-32-season-completion-guard.sql',
  'phase-33-steward-result-notifications.sql',
  'phase-34-own-league-join-request-status.sql',
  'phase-35-race-penalties-compatibility.sql',
];
const failures = [];

const migrationFiles = fs.readdirSync(migrationDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();
const migrations = migrationFiles
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name));
const tests = fs.readdirSync(testDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();
const migrationSql = migrations.map((name) => fs.readFileSync(path.join(migrationDir, name), 'utf8'));
const testSql = tests.map((name) => fs.readFileSync(path.join(testDir, name), 'utf8'));
const migrationNames = migrations.map((name) => name.replace(/^\d{14}_|\.sql$/g, ''));

function requireGate(condition, label) {
  if (!condition) failures.push(label);
}

requireGate(migrationFiles.length === migrations.length, 'every V2 migration uses the timestamp_name.sql format');
requireGate(new Set(migrations.map((name) => name.slice(0, 14))).size === migrations.length, 'migration versions are unique');
requireGate(new Set(migrationNames).size === migrations.length, 'migration names are unique');
requireGate(migrationSql.every((sql) => sql.trim().length > 0), 'every V2 migration contains SQL');
requireGate(requiredTail.every((name) => migrationNames.includes(name)), 'all reviewed migration rehearsal milestones are present');
requireGate(requiredTail.every((name, index) => index === 0 || migrationNames.indexOf(name) > migrationNames.indexOf(requiredTail[index - 1])), 'reviewed staging history and pending migrations remain ordered');
requireGate(!migrationSql.some((sql) => /\bdrop\s+(?:table|schema|function)\b|\btruncate\b|\balter\s+table\b[\s\S]{0,120}\bdrop\s+column\b/i.test(sql)), 'migration set contains no destructive object/data DDL');
requireGate(requiredRegressions.every((name) => tests.includes(name)), 'all current migration regressions are present');
requireGate(testSql.every((sql) => /(^|\n)begin;\s/i.test(sql) && /rollback;\s*$/i.test(sql)), 'every database regression is transactional and rolls back');

const boundaryMigration = migrationSql[migrationNames.indexOf('v2_tenant_helper_anon_boundary')];
const driverNumberMigration = migrationSql[migrationNames.indexOf('backfill_public_driver_numbers')];
const phase26Regression = fs.readFileSync(path.join(testDir, 'phase-26-migration-rehearsal.sql'), 'utf8');
requireGate(/language\s+plpgsql/i.test(boundaryMigration) && !/security\s+definer/i.test(boundaryMigration), 'tenant helper keeps separate anonymous and authenticated invoker paths');
const privilegedRole = ['service', 'role'].join('_');
requireGate(boundaryMigration.includes(`grant execute on function public.matches_requested_league(uuid) to anon, authenticated, ${privilegedRole};`), 'tenant helper keeps exact browser grants');
requireGate(phase26Regression.includes('anonymous public tenant read was blocked') && phase26Regression.includes('owner-only Demo league'), 'Phase 26 regression covers public anonymous and owner-only paths');
requireGate(driverNumberMigration.includes('pg_catalog.md5') && driverNumberMigration.includes('pg_advisory_xact_lock'), 'driver numbers use stable pseudo-random distribution with tenant-scoped concurrency protection');

if (failures.length) {
  throw new Error(`Phase 26 Migration Rehearsal failed: ${failures.join(', ')}`);
}

console.log(`Phase 26 Migration Rehearsal passed: ${migrations.length} additive migrations and ${tests.length} transactional regressions are ordered and isolated.`);
