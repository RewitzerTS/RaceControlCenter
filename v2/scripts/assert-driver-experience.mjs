import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shell = await readFile(resolve(root, 'src/components/AppShell.tsx'), 'utf8');
const home = await readFile(resolve(root, 'src/driver/DriverHomePage.tsx'), 'utf8');
const data = await readFile(resolve(root, 'src/driver/driverHome.ts'), 'utf8');
const racing = await readFile(resolve(root, 'src/driver/RacingPage.tsx'), 'utf8');
const career = await readFile(resolve(root, 'src/driver/CareerPage.tsx'), 'utf8');
const profile = await readFile(resolve(root, 'src/driver/ProfilePage.tsx'), 'utf8');
const styles = await readFile(resolve(root, 'src/styles.css'), 'utf8');
const violations = [];

for (const nav of [
  "{ icon: 'home', key: 'nav.home', path: '/' }",
  "{ icon: 'racing', key: 'nav.racing', path: '/racing' }",
  "{ icon: 'career', key: 'nav.career', path: '/career' }",
  "{ icon: 'vora', key: 'nav.vora', path: '/vora' }",
  "{ icon: 'profile', key: 'nav.profile', path: '/profile' }",
]) {
  if (!shell.includes(nav)) violations.push(`missing Driver navigation contract: ${nav}`);
}
if (!shell.includes('<Route path="/" element={<DriverHomePage />} />')) {
  violations.push('all permitted roles do not start in the Driver Experience');
}
for (const route of [
  '<Route path="/racing" element={<RacingPage />} />',
  '<Route path="/career" element={<Suspense',
  '<Route path="/profile" element={<Suspense',
]) {
  if (!shell.includes(route)) violations.push(`missing functional Driver route: ${route}`);
}
if (shell.includes('RoutePlaceholder')) violations.push('Driver core route still uses a placeholder');
if (!shell.includes('className="mobile-toggle"') || !shell.includes('main-navigation--open')) {
  violations.push('responsive V1 navigation drawer is missing');
}
if (shell.includes('<NavLink className="brand" to="/" aria-label=')) {
  violations.push('brand link accessible name overrides its visible product label');
}
for (const responsiveContract of [
  'env(safe-area-inset-bottom)',
  '@media (max-width: 700px)',
  '@media (prefers-reduced-motion: reduce)',
  'min-height: 44px',
]) {
  if (!styles.includes(responsiveContract)) violations.push(`missing responsive contract: ${responsiveContract}`);
}
for (const table of [
  'driver_career_stats',
  'driver_progression',
  'driver_wallets',
  'driver_achievements',
  'challenge_definitions',
  'driver_challenges',
  'races',
]) {
  if (!data.includes(`.from('${table}')`)) violations.push(`Driver Home does not read ${table}`);
}
for (const forbiddenMutation of ['.insert(', '.update(', '.delete(', ['service', 'role'].join('_')]) {
  if (data.includes(forbiddenMutation)) violations.push(`Driver Home contains forbidden client mutation or credential: ${forbiddenMutation}`);
}
for (const table of ['races', 'race_results']) {
  if (!racing.includes(`.from('${table}')`)) violations.push(`Racing does not read ${table}`);
}
if (!racing.includes(".eq('result_version_id', selectedRace.current_result_version_id)")) {
  violations.push('Racing does not pin results to the current official version');
}
if (!career.includes('useDriverHome') || !career.includes('identity.linkedDriverCount === 0')) {
  violations.push('Career does not use confirmed projections or protect the unlinked-driver state');
}
if (!profile.includes('updateDisplayName') || !profile.includes('identity?.linkedDriverCount')) {
  violations.push('Profile does not provide account settings and driver-link status');
}
if (
  data.indexOf("if (snapshot.career?.last_race_date) return 'result'") >
  data.indexOf("if (snapshot.nextRace) return 'next-race'")
) {
  violations.push('Driver Home hero does not prioritize a new result over the next race');
}
for (const state of [
  "home.signedOutTitle",
  "home.identityTitle",
  "home.loadingTitle",
  "home.errorTitle",
]) {
  if (!home.includes(state)) violations.push(`missing Driver Home state: ${state}`);
}
if (violations.length) {
  console.error(`V2 Driver Experience check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log('V2 Driver Experience check passed. Career-first navigation, responsive V1 shell, RLS-bound reads, deterministic hero priority, and safe UI states are present.');

