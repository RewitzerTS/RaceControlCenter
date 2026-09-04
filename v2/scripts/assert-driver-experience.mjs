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
  "icon: 'home', key: 'nav.home'",
  "icon: 'racing', key: 'nav.racing'",
  "icon: 'career', key: 'nav.career'",
  "icon: 'vora', key: 'nav.vora'",
]) {
  if (!shell.includes(nav)) violations.push(`missing Driver navigation contract: ${nav}`);
}
if (!shell.includes("to=\"/profile\"") || !shell.includes('topbar-profile-link')) {
  violations.push('Profile is not positioned with the account and language controls');
}
if (shell.includes('nav-item--public') || shell.includes("t('nav.league')")) {
  violations.push('retired standalone public league navigation is still visible');
}
if (!shell.includes('<Route path="/home" element={leagueRoute(<DriverHomePage />)} />')) {
  violations.push('all permitted roles do not start in the Driver Experience');
}
for (const route of [
  '<Route path="/racing/*" element={leagueRoute(<RacingPage />)} />',
  '<Route path="/career" element={leagueRoute(<Suspense',
  '<Route path="/profile" element={<Suspense',
]) {
  if (!shell.includes(route)) violations.push(`missing functional Driver route: ${route}`);
}
if (shell.includes('RoutePlaceholder')) violations.push('Driver core route still uses a placeholder');
if (!shell.includes('className="mobile-toggle"') || !shell.includes('main-navigation--open')) {
  violations.push('responsive V1 navigation drawer is missing');
}
if (shell.includes('v2-status-strip') || shell.includes('status-pill-card')) {
  violations.push('global status cards are still rendered between the header and page content');
}
if (shell.includes('language-code') || shell.includes('language-chevron')) {
  violations.push('compact language control still renders text or a chevron beside the flag');
}
if (!shell.includes('<LanguageFlag language={language} />')) {
  violations.push('compact language control no longer renders the selected country flag');
}
if (!styles.includes('justify-content: safe center;')) {
  violations.push('shared section navigation is not centered when space is available');
}
if (!styles.includes('position: sticky;') || !styles.includes('.section-navigation { top: 82px; }')) {
  violations.push('shared section navigation is not pinned below the responsive header');
}
if (shell.includes('<NavLink className="brand" to="/home" aria-label=')) {
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
if (racing.includes('integrated-section-heading') || racing.includes("t('racing.sectionCopy')")) {
  violations.push('Racing routes still duplicate their embedded page heading');
}
if (!racing.includes('section-view-switcher section-view-switcher--standalone')) {
  violations.push('Racing subviews lost their driver/team or history view switcher');
}
if (!styles.includes('color-mix(in srgb, var(--brand-primary) 16%, var(--brand-surface))')) {
  violations.push('The account role chip does not follow the active personal theme');
}
if (!career.includes('useDriverHome') || !career.includes('identity.linkedDriverCount === 0')) {
  violations.push('Career does not use confirmed projections or protect the unlinked-driver state');
}
if (career.includes('<header className="integrated-section-heading"><div><h1>{careerSection.title}</h1>')) {
  violations.push('Career detail routes still duplicate the embedded page heading');
}
if (!career.includes("careerSearch.set('profile_number', String(identity.profileNumber))")) {
  violations.push('Career profile does not pass the verified global profile number to its embedded view');
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

