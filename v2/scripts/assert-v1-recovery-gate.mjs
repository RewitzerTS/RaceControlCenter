import fs from 'node:fs';
import path from 'node:path';

const v2Root = process.cwd();
const repositoryRoot = path.resolve(v2Root, '..');
const manifestPath = path.join(repositoryRoot, 'docs', 'v2', 'v1-recovery-manifest.json');
const phase27Path = path.join(repositoryRoot, 'docs', 'v2', 'phase-27-beta.md');
const phase28Path = path.join(repositoryRoot, 'docs', 'v2', 'phase-28-production-readiness.md');
const phase29Path = path.join(repositoryRoot, 'docs', 'v2', 'phase-29-cutover.md');
const phase30Path = path.join(repositoryRoot, 'docs', 'v2', 'phase-30-v1-retirement.md');
const failures = [];

function requireGate(condition, label) {
  if (!condition) failures.push(label);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const phase27 = fs.readFileSync(phase27Path, 'utf8');
const phase28 = fs.readFileSync(phase28Path, 'utf8');
const phase29 = fs.readFileSync(phase29Path, 'utf8');
const phase30 = fs.readFileSync(phase30Path, 'utf8');
const backupWorkflow = fs.readFileSync(path.join(repositoryRoot, manifest.v1Data.backupWorkflow), 'utf8');
const restoreRunbook = fs.readFileSync(path.join(repositoryRoot, manifest.v1Data.restoreRunbook), 'utf8');

requireGate(manifest.schemaVersion === 2, 'recovery manifest schema is pinned');
requireGate(manifest.repository === 'RewitzerTS/RaceControlCenter', 'recovery repository is exact');
requireGate(/^[0-9a-f]{40}$/.test(manifest.v1Code.recoveryCommit), 'V1 recovery point is a full Git commit');
requireGate(manifest.v1Code.commitUrl.endsWith(manifest.v1Code.recoveryCommit), 'V1 commit URL matches the recovery commit');
requireGate(manifest.v1Code.recoveryBranch.startsWith('recovery/v1-production-'), 'V1 has a dedicated recovery branch');
requireGate(/^[0-9a-f]{40}$/.test(manifest.v2ReleaseCandidate.candidateCommit), 'V2 release candidate is a full Git commit');
requireGate(manifest.v2ReleaseCandidate.commitUrl.endsWith(manifest.v2ReleaseCandidate.candidateCommit), 'V2 candidate URL matches its commit');
requireGate(manifest.v2ReleaseCandidate.releaseBranch.startsWith('release/v2-cutover-candidate-'), 'V2 has a dedicated release-candidate branch');
requireGate(manifest.v2ReleaseCandidate.stagingUrl.includes('racevora-v2-staging') && !manifest.v2ReleaseCandidate.stagingUrl.includes('racevora.com'), 'V2 candidate remains isolated from the Production domain');
requireGate(manifest.v1Data.protectedLeagueSlug === 'rcc', 'productive rcc tenant is explicitly protected');
requireGate(/^[a-z]{20}$/.test(manifest.v1Data.productionProjectRef), 'Production Supabase project is explicitly pinned');
requireGate(manifest.v1Data.restoreTargetPolicy === 'separate-non-production-only', 'restore drill is isolated from Production');
requireGate(manifest.v1Data.restoreDrill.status === 'required' && manifest.v1Data.restoreDrill.verifiedAt === null, 'unverified restore drill remains an explicit open gate');
requireGate(manifest.v1Data.restoreDrill.lastAttempt.result === 'capacity-blocked' && manifest.v1Data.restoreDrill.lastAttempt.productionTouched === false && manifest.v1Data.restoreDrill.lastAttempt.stagingTouched === false, 'failed restore-project allocation changed neither Production nor Staging');
requireGate(Object.values(manifest.cutoverGates).every((value) => value === false), 'cutover and V1 shutdown stay denied');
requireGate(manifest.phaseProgress.phase29TrafficStatus === 'locked' && manifest.phaseProgress.phase30RetirementStatus === 'locked', 'Phase 29 traffic and Phase 30 retirement remain locked');
requireGate(Boolean(manifest.phaseProgress.phase29PreparationStartedAt) && Boolean(manifest.phaseProgress.phase30PreservationStartedAt), 'Phase 29 and Phase 30 safe preparation has started');

requireGate(backupWorkflow.includes("cron: '17 2 * * *'") && backupWorkflow.includes('RACEVORA_BACKUPS_ENABLED'), 'scheduled backup definition remains guarded and present');
requireGate(backupWorkflow.includes('--cipher-algo AES256') && backupWorkflow.includes('sha256sum'), 'backup encryption and checksum controls remain present');
requireGate(backupWorkflow.includes('.eu.r2.cloudflarestorage.com') && !backupWorkflow.includes('actions/upload-artifact'), 'off-site backup stays in private EU R2 and outside Actions artifacts');
requireGate(restoreRunbook.includes('getrennten nichtproduktiven Supabase-Projekt') && restoreRunbook.includes('rcc'), 'runbook requires an isolated restore target and protects rcc');

requireGate(/Status: complete\./.test(phase27), 'Phase 27 Beta is closed before Phase 28 advances');
requireGate(phase28.includes('Phase 29') && phase28.includes('Phase 30') && phase28.includes('remain locked'), 'Phase 28 documents both downstream locks');
requireGate(/^Status: preparation in progress\. Traffic cutover: locked\./m.test(phase29), 'Phase 29 preparation is active while traffic stays locked');
requireGate(/^Status: preservation in progress\. V1 retirement: locked\./m.test(phase30), 'Phase 30 preservation is active while retirement stays locked');
requireGate(phase30.includes('V1 retirement is not deletion'), 'V1 retirement preserves the recovery surface');

if (failures.length) {
  throw new Error(`Phase 28 V1 Recovery Gate failed: ${failures.join(', ')}`);
}

console.log(`V1 Recovery Gate passed: V1 is pinned at ${manifest.v1Code.recoveryCommit.slice(0, 12)}; Phase 29/30 preparation is active while traffic and retirement remain locked.`);

