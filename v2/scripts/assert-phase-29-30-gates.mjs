import fs from 'node:fs';
import path from 'node:path';

const v2Root = process.cwd();
const repositoryRoot = path.resolve(v2Root, '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'docs', 'v2', 'v1-recovery-manifest.json'), 'utf8'),
);
const phase29 = fs.readFileSync(path.join(repositoryRoot, 'docs', 'v2', 'phase-29-cutover.md'), 'utf8');
const phase30 = fs.readFileSync(path.join(repositoryRoot, 'docs', 'v2', 'phase-30-v1-retirement.md'), 'utf8');
const cutoverConfig = fs.readFileSync(path.join(v2Root, 'wrangler.cutover.jsonc'), 'utf8');
const rollbackConfig = fs.readFileSync(path.join(v2Root, 'wrangler.production.jsonc'), 'utf8');
const failures = [];

function requireGate(condition, label) {
  if (!condition) failures.push(label);
}

const release = manifest.v2ProductionRelease;
const cutover = manifest.phase29Cutover;
const observation = manifest.phase30Preservation.productionObservation;
const parity = cutover.protectedRccParity;

requireGate(manifest.schemaVersion === 3, 'post-cutover manifest schema is current');
requireGate(manifest.repository === 'RewitzerTS/RaceControlCenter', 'repository identity is pinned');
requireGate(/^[0-9a-f]{40}$/.test(manifest.v1Code.recoveryCommit), 'V1 recovery commit is immutable');
requireGate(/^[0-9a-f]{40}$/.test(release.releaseCommit), 'V2 Production release commit is immutable');
requireGate(release.commitUrl.endsWith(release.releaseCommit), 'V2 Production commit URL matches');
requireGate(release.releaseBranch === 'release/v2-r10-production-cutover', 'Production release branch is pinned');
requireGate(release.cloudflareWorker === 'racevora-v2-production' && /^[0-9a-f-]{36}$/.test(release.cloudflareVersionId), 'Cloudflare Production version is pinned');

requireGate(manifest.phaseProgress.phase29TrafficStatus === 'v2-active', 'V2 owns Production traffic');
requireGate(manifest.phaseProgress.phase30RetirementStatus === 'reversible-operational-retirement-complete', 'V1 is operationally retired but reversible');
requireGate(manifest.cutoverGates.phase29Authorized === true && manifest.cutoverGates.phase30Authorized === true, 'owner authorization for Phases 29 and 30 is recorded');
requireGate(manifest.cutoverGates.v1ShutdownAllowed === false, 'V1 shutdown remains denied');
requireGate(cutover.status === 'complete', 'Phase 29 cutover is complete');
requireGate(JSON.stringify(cutover.routes) === JSON.stringify(['racevora.com/*', 'www.racevora.com/*']), 'both Production routes are exact');
requireGate(cutover.wwwCanonicalRedirectVerified === true, 'www canonical redirect is verified');
requireGate(Object.keys(cutover.liveRouteStatuses).length === 9 && Object.values(cutover.liveRouteStatuses).every((status) => status === 200), 'all nine live routes returned HTTP 200');
requireGate(cutover.apiLogSample.entries === 100 && cutover.apiLogSample.http5xx === 0, 'Production API sample contains no 5xx');

const expectedRcc = { leagues: 1, seasons: 1, races: 24, drivers: 20, raceResults: 451 };
requireGate(JSON.stringify(parity.v1) === JSON.stringify(expectedRcc), 'V1 rcc counts match the protected baseline');
requireGate(JSON.stringify(parity.v2) === JSON.stringify(expectedRcc), 'V2 rcc counts match the protected baseline');
requireGate(parity.matched === true && parity.v1WritePerformed === false, 'rcc parity is exact without a V1 write');

requireGate(manifest.phase30Preservation.ownerApprovalReceived === true, 'Phase 30 owner approval is retained');
requireGate(manifest.phase30Preservation.preservationStatus === 'complete-v1-retained-for-rollback', 'V1 preservation is complete');
requireGate(manifest.phase30Preservation.v1DeletionAllowed === false && manifest.phase30Preservation.v1PauseAllowed === false, 'V1 deletion and pause remain denied');
requireGate(manifest.phase30Preservation.recoveryBranchRequired === true && manifest.phase30Preservation.productionObservationWindowComplete === true, 'recovery branch is mandatory and initial observation is complete');
requireGate(observation.coreRoutesPassed === 9 && observation.http5xxObserved === 0 && observation.normalNavigationConsoleErrors === 0, 'initial Production health gate passed');
requireGate(observation.mobileFast4gCpu4x.lcpMs < 2500 && observation.mobileFast4gCpu4x.ttfbMs < 800 && observation.mobileFast4gCpu4x.cls < 0.1, 'Production Core Web Vitals gate passed');
requireGate(observation.mobileLighthouse.accessibilityScore === 100 && observation.mobileLighthouse.seoScore === 100, 'Production accessibility and SEO gates passed');
requireGate(manifest.phase30Preservation.recoveryBranchVerification.remoteCommitMatched === true && manifest.phase30Preservation.recoveryBranchVerification.commit === manifest.v1Code.recoveryCommit, 'remote V1 recovery branch matches the pinned commit');
requireGate(manifest.phase30Preservation.recoveryZip.sha256 === '5076DE7CCCD483685481F5680E1E65D892A10A0D26280E68E9A707E34E1A7132', 'V1 recovery ZIP checksum is pinned');
requireGate(manifest.phase30Preservation.latestEncryptedOffsiteBackup.status === 'success' && manifest.phase30Preservation.latestEncryptedOffsiteBackup.euR2UploadVerified === true, 'encrypted V1 off-site backup is verified');

requireGate(/^Status: complete\. V2 production traffic: active\./m.test(phase29), 'Phase 29 document records active V2 traffic');
requireGate(phase29.includes(release.releaseCommit) && phase29.includes(release.cloudflareVersionId), 'Phase 29 document pins release evidence');
requireGate(/^Status: complete\. V1 operational retirement: reversible\./m.test(phase30), 'Phase 30 document records reversible retirement');
requireGate(phase30.includes('No automated job may pause or delete V1') && phase30.includes('v1ShutdownAllowed` remains false'), 'Phase 30 keeps V1 shutdown fail-closed');

requireGate(cutoverConfig.includes('racevora.com/*') && cutoverConfig.includes('www.racevora.com/*'), 'cutover config owns both Production routes');
requireGate(!rollbackConfig.includes('racevora.com/*') && !rollbackConfig.includes('www.racevora.com/*'), 'rollback config removes the V2 route overlay');

const exactReleaseCommit = process.env.PHASE29_RELEASE_COMMIT;
const exactRecoveryCommit = process.env.PHASE29_V1_RECOVERY_COMMIT;
const readinessOnly = process.env.PHASE29_READINESS_ONLY;
const manualCheck = process.env.PHASE29_MANUAL_CHECK === 'true';

if (manualCheck) {
  if (readinessOnly === 'true') {
    requireGate(exactReleaseCommit === manifest.v2ReleaseCandidate.candidateCommit, 'historical readiness commit matches the pinned candidate');
  } else {
    requireGate(exactReleaseCommit === release.releaseCommit, 'manual Production release commit matches the manifest');
  }
  requireGate(exactRecoveryCommit === manifest.v1Code.recoveryCommit, 'manual V1 recovery commit matches the manifest');
}

if (failures.length) {
  throw new Error(`Phase 29/30 post-cutover gate failed: ${failures.join(', ')}`);
}

console.log(
  `Phase 29/30 gate passed: V2 ${release.releaseCommit.slice(0, 12)} is live; V1 ${manifest.v1Code.recoveryCommit.slice(0, 12)} remains recoverable and shutdown is denied.`,
);
