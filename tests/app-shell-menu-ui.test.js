const fs = require('fs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const shell = fs.readFileSync('v2/src/components/AppShell.tsx', 'utf8');
const styles = fs.readFileSync('v2/src/styles.css', 'utf8');
const branding = fs.readFileSync('v2/src/league/leagueBranding.ts', 'utf8');

const headerStart = shell.indexOf('<header className="site-header">');
const navigationStart = shell.indexOf('<nav className={navigationOpen', headerStart);
const navigationEnd = shell.indexOf('</nav>', navigationStart);
const headerLead = shell.slice(headerStart, navigationStart);
const navigation = shell.slice(navigationStart, navigationEnd);

assert(!headerLead.includes('<LeagueSwitcher'), 'The persistent header row must not contain the league switcher');
assert(navigation.includes('navigation-league-switcher'), 'The desktop/tablet menu must contain the league switcher');
assert(shell.includes('mobile-more-league-switcher'), 'The mobile More menu must contain the league switcher');
assert(shell.includes('menu-sign-out'), 'Authenticated menus must expose sign out');
assert(shell.includes("await signOut();"), 'The menu sign-out action must end the Supabase session');
assert(styles.includes('padding-top: env(safe-area-inset-top)'), 'The header must cover the top safe area');
assert(styles.includes('html { background-color: var(--brand-surface); }'), 'The browser safe area needs a theme-aware background fallback');
assert(branding.includes("meta[name=\"theme-color\"]"), 'Brand changes must update the browser theme color');

console.log('app shell menu UI tests passed');
