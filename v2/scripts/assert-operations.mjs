import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [migration, processors, adminParity, completionMigration, seasonAuditFix, seasonCalendar, seasonCompletionGuard, racePenaltyCompatibility, shell, roleProvider, admin, members, drivers, completionPages, resultImportPage, owner, notifications, styles, test, seasonCompletionTest, racePenaltyTest, seasonSetupPage, leagueBrandingPage, brandingPermissions, brandingPermissionTest, driverAttribution, driverAttributionTest] = await Promise.all([
  'supabase/migrations/20260820184740_v2_admin_owner_notifications.sql',
  'supabase/migrations/20260821202014_v2_notification_vora_processors.sql',
  'supabase/migrations/20260822112925_v2_v1_admin_members_drivers.sql',
  'supabase/migrations/20260822120034_v2_v1_migration_completion.sql',
  'supabase/migrations/20260824233345_v2_season_start_append_only_audit.sql',
  'supabase/migrations/20260825093321_v2_season_calendar_workflow.sql',
  'supabase/migrations/20260827061108_v2_block_incomplete_season_completion.sql',
  'supabase/migrations/20260827062120_restore_race_penalties_compatibility.sql',
  'src/components/AppShell.tsx', 'src/roles/RoleProvider.tsx', 'src/operations/AdminWorkspacePage.tsx',
  'src/operations/LeagueMembersPage.tsx', 'src/operations/LeagueDriversPage.tsx',
  'src/operations/V1CompletionPages.tsx',
  'src/operations/ResultImportPage.tsx',
  'src/operations/OwnerControlPage.tsx', 'src/operations/NotificationCenterPage.tsx',
  'src/styles.css', 'supabase/tests/phase-17-19-operations.sql',
  'supabase/tests/phase-32-season-completion-guard.sql',
  'supabase/tests/phase-35-race-penalties-compatibility.sql',
  'src/operations/SeasonSetupPage.tsx',
  'src/operations/LeagueBrandingPage.tsx',
  'supabase/migrations/20260831000504_fix_league_branding_save_permissions.sql',
  'supabase/tests/phase-36-league-branding-write-access.sql',
  'supabase/migrations/20260831074524_driver_ai_points_attribution.sql',
  'supabase/tests/phase-37-driver-ai-points-attribution.sql',
].map((path) => readFile(resolve(root, path), 'utf8')));

const violations = [];
for (const contract of [
  'create table public.v2_audit_events', 'create table public.platform_feature_flags',
  'create table public.user_notifications', 'enable row level security',
  'private.has_league_capability(target_league.id', 'public.is_platform_owner()',
  'v2_audit_events_protect_history', 'recipient_user_id = (select auth.uid())',
  'enqueue_race_summary_notification',
]) if (!migration.includes(contract)) violations.push('missing database contract: ' + contract);
for (const contract of [
  'create or replace function private.process_notification_event',
  'public.enqueue_race_summary_notification',
  "dep.processor = 'notifications'",
  "race-summary:",
]) if (!processors.includes(contract)) violations.push('missing Notification processor contract: ' + contract);
for (const contract of ["to=\"/admin\"", "to=\"/owner\"", "to=\"/notifications\"", 'canSteward', 'canAdmin', 'canOwner', 'canNotify', 'loading: authLoading', 'accessLoading ?']) if (!shell.includes(contract)) violations.push('missing shell contract: ' + contract);
if (shell.includes('features.leagueAdmin &&')) violations.push('obsolete V1 admin rollout gate is still active');
for (const contract of ['path="/admin/users"', 'path="/admin/drivers"', 'path="/admin/races"', 'path="/admin/results"', 'path="/admin/standings"', 'path="/admin/teams"', 'path="/admin/rules"', 'path="/admin/results/import"', 'path="/admin/audit"']) if (!shell.includes(contract)) violations.push('missing V1 admin route: ' + contract);
for (const contract of ['resolvedScope', 'resolvedScope !== currentScope', '[client, leagueSlug, userId]']) if (!roleProvider.includes(contract)) violations.push('missing user-and-league-scoped role gate: ' + contract);
for (const contract of ['role === \'league_admin\'', 'role === \'platform_owner\'', 'loadAdminSnapshot']) if (!admin.includes(contract)) violations.push('missing admin role contract: ' + contract);
for (const contract of ['get_league_member_admin_workspace', 'add_existing_league_member_by_email', 'set_league_member_role', 'remove_league_member', 'get_league_driver_admin_workspace', 'upsert_league_driver']) if (!adminParity.includes(contract)) violations.push('missing V1 admin parity RPC: ' + contract);
for (const contract of ['get_league_configuration_workspace', 'update_league_rules', 'rename_league_team', 'create_league_result_draft', 'publish_league_result_draft']) if (!completionMigration.includes(contract)) violations.push('missing V1 completion RPC: ' + contract);
for (const contract of ['create or replace function public.start_league_season', "'season.preset.seeded'", "'ai_drivers', roster_size - player_count", "'races', track_count"]) if (!seasonAuditFix.includes(contract)) violations.push('missing append-only season start contract: ' + contract);
if (seasonAuditFix.includes('update public.v2_audit_events')) violations.push('season start still mutates immutable audit history');
for (const contract of ['configure_league_season_calendar', 'start_league_season_with_calendar', "'season.calendar.configured'", "r.status <> 'upcoming'", 'end_date = null']) if (!seasonCalendar.includes(contract)) violations.push('missing guided season calendar contract: ' + contract);
for (const contract of ['upcoming_race_count', 'missing_result_count', "rv.status <> 'active'", "errcode = '55000'", 'for update;']) if (!seasonCompletionGuard.includes(contract)) violations.push('missing guarded season completion contract: ' + contract);
for (const contract of ['create table public.race_penalties', 'steward_case_id uuid', 'private.has_league_capability', 'public.matches_requested_league', 'd.league_id = s.league_id', 'alter table public.race_penalties enable row level security']) if (!racePenaltyCompatibility.includes(contract)) violations.push('missing race penalties compatibility contract: ' + contract);
for (const contract of ['LeagueTeamsPage', 'LeagueRulesPage', 'ResultImportPage', 'LeagueAuditPage', 'parseResultCsv']) if (!completionPages.includes(contract)) violations.push('missing V1 completion workflow: ' + contract);
if (admin.includes('folgt in der V1-Migration') || admin.includes('operations-menu__pending')) violations.push('V1 migration still exposes pending admin placeholders');
if (admin.includes("t('admin.preview')") || admin.includes('to="/racing"')) violations.push('obsolete admin user-preview action is still visible');
if (resultImportPage.includes("copy('import.reason')") || resultImportPage.includes('reason.trim()')) violations.push('result import still asks for a redundant manual change reason');
for (const contract of ["copy(importMethod === 'images' ? 'import.reasonImages' : 'import.reasonCsv')", 'result-import-race-row']) if (!resultImportPage.includes(contract)) violations.push('missing automatic result-import audit reason contract: ' + contract);
for (const contract of ['addLeagueMember', 'setLeagueMemberRole', 'removeLeagueMember', 'confirmRemove']) if (!members.includes(contract)) violations.push('missing member management workflow: ' + contract);
for (const contract of ['loadDriverAdminWorkspace', 'upsertLeagueDriver', 'assignSeasonDriverAi', "copy('drivers.create')", "copy('shared.edit')", "copy('drivers.aiAssignment')"]) if (!drivers.includes(contract)) violations.push('missing driver management workflow: ' + contract);
for (const contract of ["t('owner.control')", 'setPlatformFlag', "'/owner/demo'", "'/admin'"]) if (!owner.includes(contract)) violations.push('missing owner contract: ' + contract);
for (const contract of ['markInboxItemRead', 'notification-unread']) if (!notifications.includes(contract)) violations.push('missing notification contract: ' + contract);
for (const contract of ['.operations-page', '.responsive-table', '@media (max-width: 700px)', 'env(safe-area-inset-bottom)']) if (!styles.includes(contract)) violations.push('missing responsive contract: ' + contract);
if (!styles.includes('.app-shell .operations-metrics {')
    || !styles.includes('color-mix(in srgb, var(--brand-primary) 14%, transparent)')
    || !styles.includes('color-mix(in srgb, var(--brand-surface) 94%, var(--brand-background))')) {
  violations.push('Owner and admin overview metrics do not follow the active personal theme');
}
const createLeagueButton = styles.match(/\.operations-menu \.operations-create-league \{([\s\S]*?)\}/)?.[1] ?? '';
if (!createLeagueButton.includes('color: var(--brand-on-primary)')
    || !createLeagueButton.includes('background: var(--brand-gradient)')
    || /#2c8fa6|#5a32a3/i.test(createLeagueButton)) {
  violations.push('The create-league action does not follow the active personal theme');
}
if (!styles.includes('.app-shell :is(.admin-form, .admin-inline-form, .onboarding-form, .steward-form, .beta-access-form)')
    || !styles.includes('outline: 3px solid var(--brand-primary)')) {
  violations.push('Admin inline form controls do not follow the active personal theme');
}
if (!styles.includes('.app-shell .result-import-form input[type="file"]')
    || !styles.includes('::file-selector-button')
    || !styles.includes('background: var(--brand-gradient)')) {
  violations.push('Result-import file controls do not follow the active personal theme');
}
for (const contract of ['rollback;', 'league admin entered global Owner Control', 'notification leaked to another user', 'audit history was mutable']) if (!test.includes(contract)) violations.push('missing SQL regression: ' + contract);
for (const contract of ['begin;', 'season completion accepted an upcoming race', 'blocked season completion still archived the season', 'rollback;']) if (!seasonCompletionTest.includes(contract)) violations.push('missing season completion regression: ' + contract);
for (const contract of ['begin;', 'race_penalties compatibility table is missing', 'anonymous race_penalties privileges are unsafe', 'policies do not enforce tenant, role, driver and case scope', 'rollback;']) if (!racePenaltyTest.includes(contract)) violations.push('missing race penalties compatibility regression: ' + contract);
for (const contract of ['shuffledTracks', "generationMode === 'random'", 'Streckenreihenfolge', 'season-calendar-table', 'calendar.map((entry, index)']) if (!seasonSetupPage.includes(contract)) violations.push('missing calendar wizard table/random contract: ' + contract);
for (const contract of ['.season-calendar-mode-options', '.season-calendar-table-wrap', 'overflow-x: auto', 'min-width: 900px']) if (!styles.includes(contract)) violations.push('missing calendar table responsive contract: ' + contract);
for (const contract of ['normalizeBrandingUrl', 'inputMode="url"', 'Mit oder ohne https://']) if (!leagueBrandingPage.includes(contract)) violations.push('missing branding URL normalization contract: ' + contract);
for (const contract of ['private.can_manage_league_brand_asset', "private.has_league_capability(l.id, 'league_admin')", 'security definer', 'for update', 'using (', 'with check (']) if (!brandingPermissions.includes(contract)) violations.push('missing branding write permission contract: ' + contract);
for (const contract of ['begin;', 'branding upload authorization crossed the requested tenant', 'driver received league branding upload access', 'guarded branding RPC did not update the requested league', 'rollback;']) if (!brandingPermissionTest.includes(contract)) violations.push('missing league branding permission regression: ' + contract);
for (const contract of ['private.season_driver_ai_assignments', 'private.resolve_season_driver_attribution', 'public.assign_season_driver_ai', 'points_owner_driver_id', 'effective_from_round', 'driver.ai_assignment_changed']) if (!driverAttribution.includes(contract)) violations.push('missing effective-dated driver AI attribution contract: ' + contract);
for (const contract of ['begin;', 'AI result did not retain BOT identity with human points ownership', 'mid-season change rewrote the previous AI points owner', 'former AI driver still routed points after the assignment ended', 'rollback;']) if (!driverAttributionTest.includes(contract)) violations.push('missing driver AI attribution regression: ' + contract);

if (violations.length) {
  console.error('V2 operations contract failed:\n' + violations.map((item) => '- ' + item).join('\n'));
  process.exit(1);
}
console.log('V2 Phases 17-19 operations contract passed: explicit Admin entry, separate Owner Control, immutable audit, private bundled notifications, role gates, and responsive layouts are present.');
