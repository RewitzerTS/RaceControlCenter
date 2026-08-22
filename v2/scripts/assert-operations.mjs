import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [migration, processors, adminParity, shell, roleProvider, admin, members, drivers, owner, notifications, styles, test] = await Promise.all([
  'supabase/migrations/20260820191000_v2_admin_owner_notifications.sql',
  'supabase/migrations/20260821201612_v2_notification_vora_processors.sql',
  'supabase/migrations/20260822123000_v2_v1_admin_members_drivers.sql',
  'src/components/AppShell.tsx', 'src/roles/RoleProvider.tsx', 'src/operations/AdminWorkspacePage.tsx',
  'src/operations/LeagueMembersPage.tsx', 'src/operations/LeagueDriversPage.tsx',
  'src/operations/OwnerControlPage.tsx', 'src/operations/NotificationCenterPage.tsx',
  'src/styles.css', 'supabase/tests/phase-17-19-operations.sql',
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
for (const contract of ['path="/admin/users"', 'path="/admin/drivers"']) if (!shell.includes(contract)) violations.push('missing V1 admin route: ' + contract);
for (const contract of ['resolvedUserId', 'resolvedUserId !== user?.id']) if (!roleProvider.includes(contract)) violations.push('missing restored-session role gate: ' + contract);
for (const contract of ['role === \'league_admin\'', 'role === \'platform_owner\'', 'loadAdminSnapshot']) if (!admin.includes(contract)) violations.push('missing admin role contract: ' + contract);
for (const contract of ['get_league_member_admin_workspace', 'add_existing_league_member_by_email', 'set_league_member_role', 'remove_league_member', 'get_league_driver_admin_workspace', 'upsert_league_driver']) if (!adminParity.includes(contract)) violations.push('missing V1 admin parity RPC: ' + contract);
for (const contract of ['addLeagueMember', 'setLeagueMemberRole', 'removeLeagueMember', 'confirmRemove']) if (!members.includes(contract)) violations.push('missing member management workflow: ' + contract);
for (const contract of ['loadDriverAdminWorkspace', 'upsertLeagueDriver', 'Fahrer anlegen', 'Bearbeiten']) if (!drivers.includes(contract)) violations.push('missing driver management workflow: ' + contract);
for (const contract of ["t('owner.control')", 'setPlatformFlag', "'/owner/demo'", "'/admin'"]) if (!owner.includes(contract)) violations.push('missing owner contract: ' + contract);
for (const contract of ['markInboxItemRead', 'notification-unread']) if (!notifications.includes(contract)) violations.push('missing notification contract: ' + contract);
for (const contract of ['.operations-page', '.responsive-table', '@media (max-width: 700px)', 'env(safe-area-inset-bottom)']) if (!styles.includes(contract)) violations.push('missing responsive contract: ' + contract);
for (const contract of ['rollback;', 'league admin entered global Owner Control', 'notification leaked to another user', 'audit history was mutable']) if (!test.includes(contract)) violations.push('missing SQL regression: ' + contract);

if (violations.length) {
  console.error('V2 operations contract failed:\n' + violations.map((item) => '- ' + item).join('\n'));
  process.exit(1);
}
console.log('V2 Phases 17-19 operations contract passed: explicit Admin entry, separate Owner Control, immutable audit, private bundled notifications, role gates, and responsive layouts are present.');
