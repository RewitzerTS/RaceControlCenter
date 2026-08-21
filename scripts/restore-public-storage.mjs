#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const requireFromV2 = createRequire(new URL('../v2/package.json', import.meta.url));
const { createClient } = requireFromV2('@supabase/supabase-js');

const expectedTargetRef = 'lugedxtmfitxrkacmjpb';
const forbiddenRefs = ['kjccstcbqygxuqkvdaqw', 'znnkwjogtvzwfkwnmawp'];
const expectedTargetUrl = `https://${expectedTargetRef}.supabase.co`;

function fail(message) {
  throw new Error(message);
}

function isSafeSegment(value) {
  return typeof value === 'string' && value.length > 0 && !value.includes('/') && value !== '.' && value !== '..';
}

function safeObjectPath(root, bucket, name) {
  if (!isSafeSegment(bucket) || typeof name !== 'string' || name.length === 0) {
    fail('Storage manifest contains an invalid bucket or object path.');
  }
  const normalized = name.replaceAll('\\', '/');
  if (normalized.startsWith('/') || normalized.split('/').some((part) => !part || part === '.' || part === '..')) {
    fail('Storage manifest contains an unsafe object path.');
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, bucket, ...normalized.split('/'));
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    fail('Storage object escapes the verified backup root.');
  }
  return resolved;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function loadJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function main() {
  const backupDir = process.env.RACEVORA_RESTORE_BACKUP_DIR?.trim();
  const targetUrl = process.env.TARGET_SUPABASE_URL?.replace(/\/$/, '');
  const secretKey = process.env.TARGET_SUPABASE_SECRET_KEY?.trim();

  if (!backupDir || !secretKey) fail('Restore backup directory and target secret key are required.');
  if (targetUrl !== expectedTargetUrl || forbiddenRefs.some((ref) => targetUrl?.includes(ref))) {
    fail('Storage restore target is not the dedicated V1 restore-drill project.');
  }

  const storageDir = path.join(backupDir, 'storage');
  const buckets = await loadJson(path.join(storageDir, 'buckets.json'));
  const manifest = await loadJson(path.join(storageDir, 'storage-manifest.json'));
  if (!Array.isArray(buckets) || !Array.isArray(manifest)) fail('Storage backup metadata is malformed.');

  const bucketIds = new Set();
  for (const bucket of buckets) {
    if (!isSafeSegment(bucket?.id) || bucket.id !== bucket.name || bucketIds.has(bucket.id)) {
      fail('Storage bucket inventory is invalid or ambiguous.');
    }
    if (typeof bucket.public !== 'boolean') fail('Storage bucket visibility is missing.');
    bucketIds.add(bucket.id);
  }

  const objects = [];
  const objectKeys = new Set();
  for (const item of manifest) {
    const key = `${item?.bucket}/${item?.name}`;
    if (!bucketIds.has(item?.bucket) || objectKeys.has(key)) fail('Storage object inventory is invalid or duplicated.');
    if (!Number.isSafeInteger(item?.bytes) || item.bytes < 0 || !/^[0-9a-f]{64}$/.test(item?.sha256 ?? '')) {
      fail('Storage object integrity metadata is invalid.');
    }
    const file = safeObjectPath(path.join(storageDir, 'objects'), item.bucket, item.name);
    const bytes = await readFile(file);
    if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) fail('Storage backup object failed local integrity verification.');
    objects.push({ ...item, bytesBuffer: bytes });
    objectKeys.add(key);
  }

  const client = createClient(targetUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: targetBuckets, error: listError } = await client.storage.listBuckets();
  if (listError) fail(`Could not inventory restore target buckets: ${listError.message}`);
  const unknownBuckets = targetBuckets.filter((bucket) => !bucketIds.has(bucket.id));
  if (unknownBuckets.length > 0) fail('Dedicated restore target contains unexpected Storage buckets; refusing a partial reset.');

  for (const targetBucket of targetBuckets) {
    const { error: emptyError } = await client.storage.emptyBucket(targetBucket.id);
    if (emptyError) fail(`Could not empty a dedicated restore bucket: ${emptyError.message}`);
    const { error: deleteError } = await client.storage.deleteBucket(targetBucket.id);
    if (deleteError) fail(`Could not reset a dedicated restore bucket: ${deleteError.message}`);
  }

  for (const bucket of buckets) {
    const options = { public: bucket.public };
    if (bucket.fileSizeLimit != null) options.fileSizeLimit = bucket.fileSizeLimit;
    if (Array.isArray(bucket.allowedMimeTypes)) options.allowedMimeTypes = bucket.allowedMimeTypes;
    const { error } = await client.storage.createBucket(bucket.id, options);
    if (error) fail(`Could not create a restore bucket: ${error.message}`);
  }

  for (const item of objects) {
    const { error: uploadError } = await client.storage.from(item.bucket).upload(item.name, item.bytesBuffer, {
      contentType: item.contentType || 'application/octet-stream',
      upsert: false,
    });
    if (uploadError) fail(`Could not restore a Storage object: ${uploadError.message}`);
    const { data, error: downloadError } = await client.storage.from(item.bucket).download(item.name);
    if (downloadError) fail(`Could not verify a restored Storage object: ${downloadError.message}`);
    const restored = Buffer.from(await data.arrayBuffer());
    if (restored.length !== item.bytes || sha256(restored) !== item.sha256) {
      fail('Restored Storage object failed end-to-end integrity verification.');
    }
  }

  console.log(`PASS Storage restore verified: ${buckets.length} bucket(s), ${objects.length} object(s).`);
}

main().catch((error) => {
  console.error(`::error::${error instanceof Error ? error.message : 'Storage restore failed.'}`);
  process.exitCode = 1;
});
