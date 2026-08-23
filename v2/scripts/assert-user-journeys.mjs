import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shell = fs.readFileSync(path.join(root, 'src/components/AppShell.tsx'), 'utf8');
const journeys = fs.readFileSync(path.join(root, 'src/journeys/userJourneys.ts'), 'utf8');
const driver = fs.readFileSync(path.join(root, 'src/driver/DriverHomePage.tsx'), 'utf8');
const steward = fs.readFileSync(path.join(root, 'src/stewarding/StewardWorkspacePage.tsx'), 'utf8');
const demo = fs.readFileSync(path.join(root, 'src/demo/DemoE2EPage.tsx'), 'utf8');
const regression = fs.readFileSync(path.join(root, 'supabase/tests/phase-23-user-journeys.sql'), 'utf8');

const requirements = [
  [journeys.includes("id: 'signed-out'") && journeys.includes("id: 'driver'") && journeys.includes("id: 'steward'") && journeys.includes("id: 'league-admin'") && journeys.includes("id: 'platform-owner'"), 'five acceptance journeys'],
  [shell.includes('canSteward') && shell.includes('canAdmin') && shell.includes('canOwner'), 'explicit role route gates'],
  [shell.includes('<Navigate replace to="/" />') && shell.includes('<Navigate replace to="/admin" />'), 'safe route fallbacks'],
  [driver.includes('home.signedOutTitle') && driver.includes('home.errorTitle'), 'signed-out and driver failure states'],
  [steward.includes('createStewardCase') && steward.includes('finalizeStewardDecision'), 'Steward create-to-decision flow'],
  [demo.includes('demo-isolation') && demo.includes('to="/stewarding"') && demo.includes('to="/admin/graphics"'), 'cross-workspace Demo journey'],
  [regression.includes("public.current_app_role() <> 'platform_owner'") && regression.includes('get_demo_full_e2e_snapshot') && regression.includes('get_social_graphics_workspace'), 'owner server journey'],
  [regression.includes('Non-owner entered owner journey') && regression.includes('rollback;'), 'denial and rollback regression'],
];

const missing = requirements.filter(([ok]) => !ok).map(([, label]) => label);
if (missing.length) throw new Error(`User Journey E2E contract missing: ${missing.join(', ')}`);
console.log('User Journey E2E contract passed: five role journeys, safe route gates, cross-workspace owner flow and server denial regression are present.');
