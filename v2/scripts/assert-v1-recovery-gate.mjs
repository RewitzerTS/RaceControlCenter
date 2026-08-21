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

requireGate(manifest.schemaVersion === 1, 'recovery manifest schema is pinned');
requireGate(manifest.repository === 'RewitzerTS/RaceControlCenter', 'recovery repository is exact');
requireGate(/^[0-9a-f]{40}$/.test(manifest.v1Code.recoveryCommit), 'V1 recovery point is a full Git commit');
requireGate(manifest.v1Code.commitUrl.endsWith(manifest.v1Code.recoveryCommit), 'V1 commit URL matches the recovery commit');
requireGate(manifest.v1Code.recoveryBranch.startsWith('recovery/v1-production-'), 'V1 has a dedicated recovery branch');
requireGate(manifest.v1Data.protectedLeagueSlug === 'rcc', 'productive rcc tenant is explicitly protected');
requireGate(/^[a-z]{20}$/.test(manifest.v1Data.productionProjectRef), 'Production Supabase project is explicitly pinned');
requireGate(manifest.v1Data.restoreTargetPolicy === 'separate-non-production-only', 'restore drill is isolated from Production');
requireGate(manifest.v1Data.restoreDrill.status === 'required' && manifest.v1Data.restoreDrill.verifiedAt === null, 'unverified restore drill remains an explicit open gate');
requireGate(Object.values(manifest.cutoverGates).every((value) => value === false), 'cutover and V1 shutdown stay denied');

requireGate(backupWorkflow.includes("cron: '17 2 * * *'") && backupWorkflow.includes('RACEVORA_BACKUPS_ENABLED'), 'scheduled backup definition remains guarded and present');
requireGate(backupWorkflow.includes('--cipher-algo AES256') && backupWorkflow.includes('sha256sum'), 'backup encryption and checksum controls remain present');
requireGate(backupWorkflow.includes('.eu.r2.cloudflarestorage.com') && !backupWorkflow.includes('actions/upload-artifact'), 'off-site backup stays in private EU R2 and outside Actions artifacts');
requireGate(restoreRunbook.includes('getrennten nichtproduktiven Supabase-Projekt') && restoreRunbook.includes('rcc'), 'runbook requires an isolated restore target and protects rcc');

requireGate(/Status: complete\./.test(phase27), 'Phase 27 Beta is closed before Phase 28 advances');
requireGate(phase28.includes('Phase 29') && phase28.includes('Phase 30') && phase28.includes('remain locked'), 'Phase 28 documents both downstream locks');
requireGate(/^Status: locked\./m.test(phase29) && /^Status: locked\./m.test(phase30), 'Phase 29 and Phase 30 remain locked');
requireGate(phase30.includes('V1 retirement is not deletion'), 'V1 retirement preserves the recovery surface');

if (failures.length) {
  throw new Error(`Phase 28 V1 Recovery Gate failed: ${failures.join(', ')}`);
}

console.log(`Phase 28 V1 Recovery Gate passed: V1 is pinned at ${manifest.v1Code.recoveryCommit.slice(0, 12)}; restore proof is still required and Phases 29-30 remain locked.`);

