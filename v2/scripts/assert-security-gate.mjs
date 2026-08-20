import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const headers = read('public/_headers');
const vite = read('vite.config.ts');
const migration = read('supabase/migrations/20260820213721_v2_security_gate.sql');
const regression = read('supabase/tests/phase-25-security-gate.sql');
const sourceFiles = fs.readdirSync(path.join(root, 'src'), { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
  .map((entry) => read(path.join('src', entry.parentPath.slice(path.join(root, 'src').length + 1), entry.name)))
  .join('\n');

const expectedProject = 'znnkwjogtvzwfkwnmawp.supabase.co';
const authenticatedDefinerRpcAllowlist = [
  'add_steward_evidence',
  'cast_steward_vote',
  'create_steward_case',
  'finalize_steward_decision',
  'get_demo_full_e2e_snapshot',
  'get_league_admin_workspace',
  'get_owner_control_snapshot',
  'get_social_graphics_workspace',
  'get_vora_companion_snapshot',
  'is_platform_owner',
  'mark_notification_read',
  'purchase_cosmetic',
  'record_social_graphic_render',
  'set_platform_feature_flag',
  'submit_steward_appeal',
];
const forbiddenSinks = ['dangerouslySetInnerHTML', '.innerHTML', 'document.write(', 'eval(', 'new Function('];
const failures = [];

function requireGate(condition, label) {
  if (!condition) failures.push(label);
}

requireGate(/sourcemap:\s*false/.test(vite), 'production source maps are disabled');
requireGate(!headers.includes('*.supabase.co'), 'CSP has no wildcard Supabase destination');
requireGate(headers.includes(`https://${expectedProject}`) && headers.includes(`wss://${expectedProject}`), 'CSP is pinned to V2 Staging Supabase');
requireGate(headers.includes("object-src 'none'"), 'CSP blocks plugin objects');
requireGate(headers.includes("frame-ancestors 'none'"), 'CSP blocks framing');
requireGate(headers.includes('X-Frame-Options: DENY'), 'legacy frame protection is present');
requireGate(headers.includes('Strict-Transport-Security: max-age=31536000; includeSubDomains'), 'HSTS is present');
requireGate(headers.includes('Cross-Origin-Opener-Policy: same-origin'), 'COOP is present');
requireGate(headers.includes('Cross-Origin-Resource-Policy: same-origin'), 'CORP is present');
requireGate(forbiddenSinks.every((sink) => !sourceFiles.includes(sink)), 'browser source has no forbidden dynamic HTML/code sink');
requireGate(migration.includes('alter table private.steward_case_counters enable row level security;'), 'private Steward counter has RLS defense in depth');
requireGate(migration.includes('revoke all on table private.steward_case_counters from public, anon, authenticated;'), 'private Steward counter denies browser roles');
requireGate(regression.includes("p.prosecdef") && regression.includes("has_function_privilege('public', p.oid, 'execute')"), 'database regression audits SECURITY DEFINER exposure');
requireGate(authenticatedDefinerRpcAllowlist.every((name) => regression.includes(`'${name}'`)), 'database regression pins the reviewed authenticated RPC allowlist');
requireGate(regression.includes('steward_case_counters') && regression.includes('relrowsecurity'), 'database regression audits private-table RLS');
requireGate(regression.trimEnd().endsWith('rollback;'), 'database regression is non-persistent');

if (failures.length) {
  throw new Error(`Phase 25 Security Gate failed: ${failures.join(', ')}`);
}

console.log('Phase 25 Security Gate passed: source maps, CSP, browser sinks, private RLS and privileged RPC contracts are hardened.');
