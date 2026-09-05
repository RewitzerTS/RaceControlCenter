import fs from 'node:fs';

const auth = fs.readFileSync('src/auth/AuthProvider.tsx', 'utf8');
const page = fs.readFileSync('src/auth/BetaAccessPage.tsx', 'utf8');
const authLink = fs.readFileSync('src/auth/AuthLinkPage.tsx', 'utf8');
const turnstile = fs.readFileSync('src/auth/TurnstileWidget.tsx', 'utf8');
const environment = fs.readFileSync('src/config/environment.ts', 'utf8');
const shell = fs.readFileSync('src/components/AppShell.tsx', 'utf8');
const home = fs.readFileSync('src/driver/DriverHomePage.tsx', 'utf8');
const messages = fs.readFileSync('src/i18n/messages.ts', 'utf8');
const failures = [];

function requireGate(condition, label) {
  if (!condition) failures.push(label);
}

requireGate(auth.includes('signInWithPassword') && auth.includes('client.auth.signUp') && auth.includes('resetPasswordForEmail') && auth.includes('updateUser({ password })'), 'Supabase Auth owns sign-in, sign-up and password recovery');
requireGate(auth.includes('setSession(data.session)') && auth.includes('setError(null)'), 'successful password authentication immediately activates the returned session');
requireGate(!page.includes('error.message') && !page.includes('signInError.message'), 'raw authentication errors are not exposed');
requireGate(page.includes('name="email"') && page.includes('name="password"'), 'form fields have stable names');
requireGate(page.includes('id="beta-email"') && page.includes('id="beta-password"'), 'form fields have programmatic labels');
requireGate(page.includes('autoComplete="email"') && page.includes("'new-password'") && page.includes("'current-password'"), 'browser-safe autocomplete modes are explicit');
requireGate(page.includes('minLength={8}') && page.includes('required'), 'minimum browser validation is present');
requireGate(page.includes("role={feedback.tone === 'error' ? 'alert' : 'status'}"), 'success and error feedback is announced accessibly');
requireGate(page.includes('<TurnstileWidget') && auth.includes('captchaToken') && environment.includes('VITE_AUTH_CAPTCHA_ENABLED'), 'target-configured CAPTCHA is wired into every public Auth operation');
requireGate(turnstile.includes('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit') && turnstile.includes("'expired-callback'") && turnstile.includes("'error-callback'"), 'Turnstile loads from the canonical origin and invalidates expired or failed tokens');
requireGate(turnstile.includes('role="group"') && turnstile.includes('aria-label="Cloudflare Turnstile"'), 'Turnstile container uses a valid labelled accessibility role');
requireGate(auth.includes('/auth/confirm') && auth.includes('/auth/reset') && shell.includes('<Route path="/auth/confirm"') && shell.includes('<Route path="/auth/reset"'), 'confirmation and recovery redirects stay inside the active V2 target');
requireGate(authLink.includes('autoComplete="new-password"') && authLink.includes('minLength={8}') && !authLink.includes('error.message'), 'password reset has accessible validation and hides raw errors');
requireGate(shell.includes('<Route path="/login" element={<BetaAccessPage appEnvironment={environment.appEnvironment} />} />') && shell.includes('<Route path="/beta" element={<BetaAccessPage appEnvironment={environment.appEnvironment} />} />'), 'environment-aware access route and compatibility alias are registered');
requireGate(shell.includes("aria-label={`${t('language')}: ${languageName(language)}`}") && shell.includes('role="menuitemradio"'), 'topbar language control has an accessible label and selectable menu items');
requireGate(home.includes('to="/login?mode=signin"') && shell.includes('to="/login?mode=signin"'), 'signed-out Home and topbar expose the production login');
requireGate(shell.includes("assets/images/racevora-logo-color.svg") && shell.includes('className="site-header"') && shell.includes('brand-title') && shell.includes('Race Management Platform'), 'V1 tenant branding and horizontal product header are retained');
requireGate(!shell.includes('className="app-rail"') && !shell.includes('className="brand-symbol"'), 'the divergent V2 rail and placeholder logo are absent');
requireGate(
  !shell.includes('v2-status-strip')
    && !shell.includes('status-pill-card')
    && page.includes('beta-dashboard-grid')
    && page.includes('beta-access-intro hero-main')
    && page.includes('beta-access-form hero-side'),
  'global status cards are absent while the Beta entry retains its responsive two-panel access geometry',
);
requireGate((messages.match(/"beta\.action"/g) ?? []).length === 4, 'Beta access copy exists in all four languages');
requireGate((messages.match(/"beta\.productionAction"/g) ?? []).length === 4, 'Production access copy exists in all four languages');

if (failures.length) {
  throw new Error(`Phase 27 Beta Access failed: ${failures.join(', ')}`);
}

console.log('Phase 27 Beta Access passed: isolated sign-up/sign-in/recovery, target CAPTCHA, accessible fields, safe feedback and four-language entry are present.');

