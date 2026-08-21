import fs from 'node:fs';
import path from 'node:path';

const v2Root = process.cwd();
const repositoryRoot = path.resolve(v2Root, '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'docs', 'v2', 'v1-recovery-manifest.json'), 'utf8'),
);
const phase29 = fs.readFileSync(path.join(repositoryRoot, 'docs', 'v2', 'phase-29-cutover.md'), 'utf8');
const phase30 = fs.readFileSync(path.join(repositoryRoot, 'docs', 'v2', 'phase-30-v1-retirement.md'), 'utf8');
const readinessWorkflow = fs.readFileSync(
  path.join(repositoryRoot, '.github', 'workflows', 'v2-cutover-readiness.yml'),
  'utf8',
);
const landingStyles = fs.readFileSync(path.join(repositoryRoot, 'test-landing', 'style.css'), 'utf8');
const brandingWorkflow = fs.readFileSync(
  path.join(repositoryRoot, '.github', 'workflows', 'smoke-racevora-brand.yml'),
  'utf8',
);
const landingCleanupWorkflow = fs.readFileSync(
  path.join(repositoryRoot, '.github', 'workflows', 'test2-landing-smoke.yml'),
  'utf8',
);
const authProvider = fs.readFileSync(path.join(v2Root, 'src', 'auth', 'AuthProvider.tsx'), 'utf8');
const betaAccess = fs.readFileSync(path.join(v2Root, 'src', 'auth', 'BetaAccessPage.tsx'), 'utf8');
const turnstileWidget = fs.readFileSync(path.join(v2Root, 'src', 'auth', 'TurnstileWidget.tsx'), 'utf8');
const v2Headers = fs.readFileSync(path.join(v2Root, 'public', '_headers'), 'utf8');
const failures = [];

function requireGate(condition, label) {
  if (!condition) failures.push(label);
}

const exactReleaseCommit = process.env.PHASE29_RELEASE_COMMIT;
const exactRecoveryCommit = process.env.PHASE29_V1_RECOVERY_COMMIT;
const readinessOnly = process.env.PHASE29_READINESS_ONLY;
const manualCheck = process.env.PHASE29_MANUAL_CHECK === 'true';

requireGate(manifest.repository === 'RewitzerTS/RaceControlCenter', 'repository identity is pinned');
requireGate(/^[0-9a-f]{40}$/.test(manifest.v1Code.recoveryCommit), 'V1 recovery commit is immutable');
requireGate(/^[0-9a-f]{40}$/.test(manifest.v2ReleaseCandidate.candidateCommit), 'V2 release commit is immutable');
requireGate(manifest.v1Data.protectedLeagueSlug === 'rcc', 'productive rcc league is protected');
requireGate(manifest.v1Data.restoreTargetPolicy === 'separate-non-production-only', 'restore remains non-production only');
requireGate(manifest.v1Data.restoreDrill.evidence.productionTouched === false, 'recovery drill did not touch Production');
requireGate(manifest.v1Data.restoreDrill.evidence.restoredRccLeagues === 1, 'recovery proof contains exactly one rcc league');
requireGate(manifest.v1Data.restoreDrill.evidence.authRecoveryProven === true, 'Auth recovery is proven');
requireGate(manifest.v1Data.restoreDrill.evidence.storageObjectHashesMatched === true, 'Storage recovery hashes are proven');
requireGate(manifest.phaseProgress.phase29TrafficStatus === 'locked', 'Phase 29 traffic remains locked');
requireGate(manifest.phaseProgress.phase30RetirementStatus === 'locked', 'Phase 30 retirement remains locked');
requireGate(manifest.cutoverGates.phase29Authorized === false, 'Phase 29 authorization remains denied');
requireGate(manifest.cutoverGates.phase30Authorized === false, 'Phase 30 authorization remains denied');
requireGate(manifest.cutoverGates.v1ShutdownAllowed === false, 'V1 shutdown remains denied');
requireGate(manifest.phase29Readiness.mode === 'readiness-only', 'Phase 29 workflow is readiness-only');
requireGate(manifest.phase29Readiness.productionTrafficChangeAllowed === false, 'readiness workflow cannot change traffic');
requireGate(manifest.phase29Readiness.stagingAdvisorAudit.projectRef === 'znnkwjogtvzwfkwnmawp' && manifest.phase29Readiness.stagingAdvisorAudit.projectStatus === 'ACTIVE_HEALTHY', 'Staging advisor evidence is pinned to the healthy V2 project');
requireGate(manifest.phase29Readiness.stagingAdvisorAudit.securityErrorCount === 0 && manifest.phase29Readiness.stagingAdvisorAudit.performanceActionRequiredCount === 0, 'Staging advisor audit has no unreviewed actionable finding');
requireGate(manifest.phase29Readiness.stagingAdvisorAudit.reviewedAuthenticatedDefinerRpcCount === 15 && manifest.phase29Readiness.stagingAdvisorAudit.leakedPasswordProtectionExternalConfigOpen === true, 'reviewed RPC allowlist and open Auth configuration are recorded truthfully');
const stagingConfig = manifest.phase29Readiness.stagingExternalConfiguration;
const stagingOrigin = 'https://racevora-v2-staging.richard-rewitzerzwhe.workers.dev';
requireGate(stagingConfig.siteUrl === stagingOrigin && JSON.stringify(stagingConfig.redirectAllowlist) === JSON.stringify([stagingOrigin, `${stagingOrigin}/auth/confirm`, `${stagingOrigin}/auth/reset`]) && stagingConfig.localhostRemoved === true, 'Staging Auth URLs are pinned without localhost');
requireGate(stagingConfig.emailConfirmationRequired === true && stagingConfig.secureEmailChangeEnabled === true && stagingConfig.securePasswordChangeEnabled === true && stagingConfig.minimumPasswordLength === 8, 'Staging email and password controls are recorded');
requireGate(stagingConfig.leakedPasswordProtection === 'plan-blocked-free', 'leaked-password protection plan blocker is recorded truthfully');
requireGate(stagingConfig.captcha === 'open-target-keys-required' && stagingConfig.endToEndEmailLinkVerified === false, 'open CAPTCHA and email-link gates keep cutover fail-closed');
requireGate(stagingConfig.captchaFrontendReady === true && stagingConfig.captchaCspReady === true && stagingConfig.authLinkRoutesImplemented === true, 'V2 CAPTCHA and Auth-link frontend readiness is recorded');
requireGate(stagingConfig.edgeFunctionCount === 0 && stagingConfig.realtimePublicationTableCount === 0 && stagingConfig.storageBucketCount === 0, 'unused Supabase runtime surfaces are recorded as empty');
requireGate(manifest.phase30Preservation.v1DeletionAllowed === false, 'V1 deletion remains denied');
requireGate(manifest.phase30Preservation.v1PauseAllowed === false, 'V1 pause remains denied');
requireGate(manifest.phase30Preservation.recoveryBranchRequired === true, 'V1 recovery branch must be retained');

requireGate(/^Status: preparation in progress\. Traffic cutover: locked\./m.test(phase29), 'Phase 29 document keeps traffic locked');
requireGate(phase29.includes('readiness-only') && phase29.includes('no DNS, route or production deployment'), 'Phase 29 documents the non-deploying gate');
requireGate(/^Status: preservation in progress\. V1 retirement: locked\./m.test(phase30), 'Phase 30 document keeps retirement locked');
requireGate(phase30.includes('No automated job may pause or delete V1'), 'Phase 30 documents the automation prohibition');

requireGate(readinessWorkflow.includes('permissions:\n  contents: read'), 'readiness workflow is read-only');
requireGate(readinessWorkflow.includes('confirm_readiness_only'), 'readiness workflow requires an explicit readiness-only confirmation');
requireGate(readinessWorkflow.includes('PHASE29_READINESS_ONLY:') && readinessWorkflow.includes('inputs.confirm_readiness_only') && readinessWorkflow.includes('PHASE29_MANUAL_CHECK:'), 'manual readiness check pins readiness-only mode');
requireGate(readinessWorkflow.includes('npm run deploy -- --dry-run'), 'Worker build is checked with Wrangler dry-run');
requireGate(!readinessWorkflow.includes('cloudflare/wrangler-action'), 'readiness workflow has no Cloudflare deployment action');
requireGate(!readinessWorkflow.includes('supabase db push'), 'readiness workflow has no database deployment');
requireGate(!readinessWorkflow.includes('actions/upload-artifact'), 'readiness evidence does not expose build artifacts');

requireGate(!fs.existsSync(path.join(repositoryRoot, 'landing.html')) && !fs.existsSync(path.join(repositoryRoot, 'landing2.html')), 'removed legacy landing pages remain absent');
requireGate(brandingWorkflow.includes("legacyResponse.status() !== 404") && landingCleanupWorkflow.includes('Keep index as the only landing page'), 'branding and cleanup workflows agree on the single landing page');
requireGate(landingStyles.includes('font-size:clamp(2.75rem,13vw,5rem)') && landingStyles.includes('overflow-wrap:anywhere'), 'mobile final heading remains overflow-safe');
requireGate(authProvider.includes('resetPasswordForEmail') && authProvider.includes('/auth/confirm') && authProvider.includes('/auth/reset'), 'V2 Auth provider keeps confirmation and recovery inside Staging');
requireGate(betaAccess.includes('<TurnstileWidget') && turnstileWidget.includes('challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'), 'V2 public Auth forms use the canonical Turnstile frontend');
requireGate(v2Headers.includes("script-src 'self' https://challenges.cloudflare.com") && v2Headers.includes('frame-src https://challenges.cloudflare.com'), 'V2 CSP permits only the canonical Turnstile script and frame origin');

if (manualCheck) {
  requireGate(exactReleaseCommit === manifest.v2ReleaseCandidate.candidateCommit, 'manual release commit matches the manifest');
  requireGate(exactRecoveryCommit === manifest.v1Code.recoveryCommit, 'manual V1 recovery commit matches the manifest');
  requireGate(readinessOnly === 'true', 'manual execution is explicitly readiness-only');
}

if (failures.length) {
  throw new Error(`Phase 29/30 fail-closed gate failed: ${failures.join(', ')}`);
}

console.log(
  `Phase 29/30 readiness gate passed without deployment: V2 ${manifest.v2ReleaseCandidate.candidateCommit.slice(0, 12)}, V1 recovery ${manifest.v1Code.recoveryCommit.slice(0, 12)}, traffic and retirement locked.`,
);

