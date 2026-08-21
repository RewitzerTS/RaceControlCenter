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
const restoreWorkflow = fs.readFileSync(path.join(repositoryRoot, manifest.v1Data.restoreWorkflow), 'utf8');
const restoreScript = fs.readFileSync(path.join(repositoryRoot, manifest.v1Data.restoreScript), 'utf8');
const storageRestoreScript = fs.readFileSync(path.join(repositoryRoot, manifest.v1Data.storageRestoreScript), 'utf8');
const restoreRunbook = fs.readFileSync(path.join(repositoryRoot, manifest.v1Data.restoreRunbook), 'utf8');
const externalConfigChecklist = fs.readFileSync(path.join(repositoryRoot, manifest.v1Data.externalConfigChecklist), 'utf8');
const phase2930Gate = fs.readFileSync(path.join(repositoryRoot, manifest.phase29Readiness.gateScript), 'utf8');
const cutoverReadinessWorkflow = fs.readFileSync(path.join(repositoryRoot, manifest.phase29Readiness.workflow), 'utf8');

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
requireGate(manifest.v1Data.restoreDrill.status === 'database-auth-storage-verified-external-config-required' && manifest.v1Data.restoreDrill.verifiedAt === null, 'verified data recovery remains locked on external configuration evidence');
requireGate(manifest.v1Data.restoreDrill.lastAttempt.result === 'encrypted-v1-database-auth-storage-restore-verified' && manifest.v1Data.restoreDrill.lastAttempt.v1BackupRestored === true, 'encrypted V1 database, Auth and Storage restore is recorded truthfully');
requireGate(manifest.v1Data.restoreDrill.lastAttempt.productionTouched === false && manifest.v1Data.restoreDrill.lastAttempt.stagingDataReset === false, 'replay changed neither Production nor Staging data');
requireGate(manifest.v1Data.restoreDrill.evidence.restoredRccLeagues === 1 && manifest.v1Data.restoreDrill.evidence.restoredPublicTables === manifest.v1Data.restoreDrill.evidence.restoredPublicRlsTables, 'database evidence contains one rcc tenant and complete public RLS');
requireGate(manifest.v1Data.restoreDrill.evidence.authRecoveryProven === true && manifest.v1Data.restoreDrill.evidence.authCredentialFingerprintMatched === true && manifest.v1Data.restoreDrill.evidence.storageObjectsRestored === 4 && manifest.v1Data.restoreDrill.evidence.storageObjectHashesMatched === true, 'Auth credentials and every archived Storage object are proven');
requireGate(manifest.v1Data.restoreDrill.fullRestorePreparation.status === 'full-restore-verified-external-config-open' && manifest.v1Data.restoreDrill.fullRestorePreparation.freshBackup.authArchiveChecksumVerified === true && manifest.v1Data.restoreDrill.fullRestorePreparation.freshBackup.encryptedUploadVerified === true && manifest.v1Data.restoreDrill.fullRestorePreparation.productionTouched === false && manifest.v1Data.restoreDrill.fullRestorePreparation.stagingPaused === false, 'full recovery is verified without touching Production and Staging is restored');
requireGate(manifest.v2ZeroStateReplay.status === 'verified' && manifest.v2ZeroStateReplay.migrationCount === 27 && manifest.v2ZeroStateReplay.transactionalTestCount === 18, 'clean V2 replay evidence is complete');
requireGate(manifest.v2ZeroStateReplay.publicTableCount === manifest.v2ZeroStateReplay.publicRlsTableCount && manifest.v2ZeroStateReplay.stagingRestoredActiveHealthy === true, 'clean replay retained complete public RLS and restored Staging health');
requireGate(Object.values(manifest.cutoverGates).every((value) => value === false), 'cutover and V1 shutdown stay denied');
requireGate(manifest.phaseProgress.phase29TrafficStatus === 'locked' && manifest.phaseProgress.phase30RetirementStatus === 'locked', 'Phase 29 traffic and Phase 30 retirement remain locked');
requireGate(Boolean(manifest.phaseProgress.phase29PreparationStartedAt) && Boolean(manifest.phaseProgress.phase30PreservationStartedAt), 'Phase 29 and Phase 30 safe preparation has started');
requireGate(manifest.phase29Readiness.mode === 'readiness-only' && manifest.phase29Readiness.productionTrafficChangeAllowed === false, 'Phase 29 automation is readiness-only');
requireGate(manifest.phase30Preservation.ownerApprovalReceived === true && manifest.phase30Preservation.preservationStatus === 'complete-retirement-waiting-for-v2-production-observation', 'Phase 30 owner approval and completed preservation are recorded');
requireGate(manifest.phase30Preservation.v1DeletionAllowed === false && manifest.phase30Preservation.v1PauseAllowed === false && manifest.phase30Preservation.recoveryBranchRequired === true && manifest.phase30Preservation.productionObservationWindowComplete === false, 'Phase 30 preserves an active recoverable V1 until Production observation');
requireGate(manifest.phase30Preservation.recoveryBranchVerification.remoteCommitMatched === true && manifest.phase30Preservation.recoveryBranchVerification.commit === manifest.v1Code.recoveryCommit, 'remote V1 recovery branch still matches the pinned commit');
requireGate(manifest.phase30Preservation.recoveryZip.entryCount === 504 && manifest.phase30Preservation.recoveryZip.sha256 === '5076DE7CCCD483685481F5680E1E65D892A10A0D26280E68E9A707E34E1A7132', 'V1 recovery ZIP content and checksum are pinned');
requireGate(manifest.phase30Preservation.latestEncryptedOffsiteBackup.status === 'success' && manifest.phase30Preservation.latestEncryptedOffsiteBackup.euR2UploadVerified === true && manifest.phase30Preservation.latestEncryptedOffsiteBackup.storageBuckets === 1 && manifest.phase30Preservation.latestEncryptedOffsiteBackup.storageObjects === 4, 'fresh encrypted V1 backup is verified in private EU R2');
requireGate(manifest.phase30Preservation.livePreservationAudit.v1WorkerHealthy === true && manifest.phase30Preservation.livePreservationAudit.v1ProjectStatus === 'ACTIVE_HEALTHY' && manifest.phase30Preservation.livePreservationAudit.v2StagingProjectStatus === 'ACTIVE_HEALTHY' && manifest.phase30Preservation.livePreservationAudit.protectedRccLeagueCount === 1 && manifest.phase30Preservation.livePreservationAudit.productionWritePerformed === false, 'live Phase 30 audit preserves healthy V1, healthy Staging and exactly one rcc without Production writes');

requireGate(backupWorkflow.includes("cron: '17 2 * * *'") && backupWorkflow.includes('RACEVORA_BACKUPS_ENABLED'), 'scheduled backup definition remains guarded and present');
requireGate(backupWorkflow.includes('--cipher-algo AES256') && backupWorkflow.includes('sha256sum'), 'backup encryption and checksum controls remain present');
requireGate(backupWorkflow.includes('auth-data.dump') && backupWorkflow.includes('backup-format-version.txt'), 'fresh encrypted backup includes Auth recovery format v2');
requireGate(backupWorkflow.includes('.eu.r2.cloudflarestorage.com') && !backupWorkflow.includes('actions/upload-artifact'), 'off-site backup stays in private EU R2 and outside Actions artifacts');
requireGate(restoreWorkflow.includes('workflow_dispatch') && restoreWorkflow.includes('RESTORE_DRILL_DB_URL') && !restoreWorkflow.includes('actions/upload-artifact'), 'encrypted restore remains manual, secret-backed and outside Actions artifacts');
requireGate(restoreScript.includes("expected_target_ref='lugedxtmfitxrkacmjpb'") && restoreScript.includes(`production_ref='${manifest.v1Data.productionProjectRef}'`) && restoreScript.includes("staging_ref='znnkwjogtvzwfkwnmawp'") && restoreScript.includes("session_pooler_host='aws-1-eu-west-1.pooler.supabase.com'"), 'restore helper pins the only allowed target and its IPv4 Session Pooler while rejecting Production and Staging');
requireGate(restoreScript.includes('verified roles.sql is not replayed') && !restoreScript.includes('--file "$backup_dir/roles.sql"'), 'restore helper retains target-managed Supabase roles');
requireGate(restoreScript.includes('sha256sum -c') && restoreScript.includes('protected rcc tenant is missing from restored data') && restoreScript.includes('--single-transaction'), 'restore helper verifies checksums, rcc and transactional recovery');
requireGate(restoreScript.includes('Auth user, identity or credential recovery evidence does not match') && restoreScript.includes('TARGET_SUPABASE_SECRET_KEY'), 'restore helper verifies Auth credential recovery and requires a target-only secret');
requireGate(storageRestoreScript.includes("expectedTargetRef = 'lugedxtmfitxrkacmjpb'") && storageRestoreScript.includes("`${bucketPath}/empty`") && storageRestoreScript.includes('sha256(restored)'), 'Storage restore resets only the drill target and verifies downloaded object hashes');
requireGate(restoreRunbook.includes('getrennten nichtproduktiven Supabase-Projekt') && restoreRunbook.includes('rcc'), 'runbook requires an isolated restore target and protects rcc');
requireGate(externalConfigChecklist.includes('RESTORE_DRILL_SECRET_KEY') && externalConfigChecklist.includes('Keep Phase 29 traffic'), 'external configuration remains an explicit fail-closed recovery gate');
requireGate(phase2930Gate.includes('phase29Authorized === false') && phase2930Gate.includes('v1ShutdownAllowed === false'), 'Phase 29/30 code denies cutover and V1 shutdown by default');
requireGate(cutoverReadinessWorkflow.includes('npm run deploy -- --dry-run') && !cutoverReadinessWorkflow.includes('cloudflare/wrangler-action'), 'cutover readiness builds without deploying');

requireGate(/Status: complete\./.test(phase27), 'Phase 27 Beta is closed before Phase 28 advances');
requireGate(phase28.includes('Phase 29') && phase28.includes('Phase 30') && phase28.includes('remain locked'), 'Phase 28 documents both downstream locks');
requireGate(/^Status: preparation in progress\. Traffic cutover: locked\./m.test(phase29), 'Phase 29 preparation is active while traffic stays locked');
requireGate(/^Status: preservation complete\. V1 retirement: locked\./m.test(phase30), 'Phase 30 preservation is complete while retirement stays locked');
requireGate(phase30.includes('V1 retirement is not deletion'), 'V1 retirement preserves the recovery surface');

if (failures.length) {
  throw new Error(`Phase 28 V1 Recovery Gate failed: ${failures.join(', ')}`);
}

console.log(`V1 Recovery Gate passed: V1 is pinned at ${manifest.v1Code.recoveryCommit.slice(0, 12)}; V2 replay plus V1 database/Auth/Storage recovery are verified while external configuration, traffic and retirement remain locked.`);

