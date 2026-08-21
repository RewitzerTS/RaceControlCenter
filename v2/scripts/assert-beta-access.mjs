import fs from 'node:fs';

const auth = fs.readFileSync('src/auth/AuthProvider.tsx', 'utf8');
const page = fs.readFileSync('src/auth/BetaAccessPage.tsx', 'utf8');
const shell = fs.readFileSync('src/components/AppShell.tsx', 'utf8');
const home = fs.readFileSync('src/driver/DriverHomePage.tsx', 'utf8');
const messages = fs.readFileSync('src/i18n/messages.ts', 'utf8');
const failures = [];

function requireGate(condition, label) {
  if (!condition) failures.push(label);
}

requireGate(auth.includes('signInWithPassword') && auth.includes('client.auth.signUp'), 'Supabase Auth owns password sign-in and test-account creation');
requireGate(!page.includes('error.message') && !page.includes('signInError.message'), 'raw authentication errors are not exposed');
requireGate(page.includes('name="email"') && page.includes('name="password"'), 'form fields have stable names');
requireGate(page.includes('id="beta-email"') && page.includes('id="beta-password"'), 'form fields have programmatic labels');
requireGate(page.includes('autoComplete="email"') && page.includes("'new-password'") && page.includes("'current-password'"), 'browser-safe autocomplete modes are explicit');
requireGate(page.includes('minLength={8}') && page.includes('required'), 'minimum browser validation is present');
requireGate(page.includes("role={feedback === 'error' ? 'alert' : 'status'}"), 'success and error feedback is announced accessibly');
requireGate(shell.includes('<Route path="/beta" element={<BetaAccessPage />} />'), 'Beta route is registered');
requireGate(shell.includes('htmlFor="language-selector"') && shell.includes('name="language"'), 'topbar language field has a stable label and name');
requireGate(home.includes('to="/beta"') && shell.includes('to="/beta"'), 'signed-out Home and topbar expose Beta access');
requireGate(shell.includes("assets/images/logo.png") && shell.includes('className="site-header"') && shell.includes('brand-title'), 'V1 tenant branding and horizontal product header are retained');
requireGate(!shell.includes('className="app-rail"') && !shell.includes('className="brand-symbol"'), 'the divergent V2 rail and placeholder logo are absent');
requireGate(shell.includes('status-strip v2-status-strip') && page.includes('beta-dashboard-grid'), 'V1 dashboard geometry is retained for the Beta entry');
requireGate((messages.match(/"beta\.action"/g) ?? []).length === 4, 'Beta access copy exists in all four languages');

if (failures.length) {
  throw new Error(`Phase 27 Beta Access failed: ${failures.join(', ')}`);
}

console.log('Phase 27 Beta Access passed: isolated sign-up/sign-in, accessible fields, safe feedback and four-language entry are present.');
