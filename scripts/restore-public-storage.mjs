#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

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

function encodeObjectPath(bucket, name) {
  return [bucket, ...name.split('/')].map(encodeURIComponent).join('/');
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

  const storageUrl = `${targetUrl}/storage/v1`;
  const baseHeaders = {
    apikey: secretKey,
    authorization: `Bearer ${secretKey}`,
  };
  async function storageRequest(endpoint, { method = 'GET', body, raw = false, headers = {} } = {}) {
    const response = await fetch(`${storageUrl}${endpoint}`, {
      method,
      headers: {
        ...baseHeaders,
        ...(body != null && !Buffer.isBuffer(body) ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body == null ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
    });
    if (!response.ok) {
      const responseText = await response.text();
      let effectiveStatus = response.status;
      let errorCode;
      try {
        const payload = JSON.parse(responseText);
        if (Number.isInteger(payload?.statusCode)) effectiveStatus = payload.statusCode;
        if (typeof payload?.code === 'string') errorCode = payload.code;
      } catch {
        // Preserve the HTTP status when the Storage API does not return JSON.
      }
      const detail = responseText.slice(0, 300).replace(/[\r\n]+/g, ' ');
      const error = new Error(`Storage API ${method} ${endpoint} failed (${response.status}): ${detail}`);
      error.status = effectiveStatus;
      error.code = errorCode;
      throw error;
    }
    if (raw) return Buffer.from(await response.arrayBuffer());
    const text = await response.text();
    return text ? JSON.parse(text) : null;
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

  const targetBuckets = await storageRequest('/bucket');
  if (!Array.isArray(targetBuckets)) fail('Could not inventory restore target buckets.');
  const unknownBuckets = targetBuckets.filter((bucket) => !bucketIds.has(bucket.id));
  if (unknownBuckets.length > 0) fail('Dedicated restore target contains unexpected Storage buckets; refusing a partial reset.');

  for (const targetBucket of targetBuckets) {
    const bucketPath = `/bucket/${encodeURIComponent(targetBucket.id)}`;
    await storageRequest(`${bucketPath}/empty`, { method: 'POST', body: {} });
    let deleted = false;
    for (let attempt = 0; attempt < 90; attempt += 1) {
      try {
        await storageRequest(bucketPath, { method: 'DELETE', body: {} });
        deleted = true;
        break;
      } catch (error) {
        if (error?.status !== 409) throw error;
        await wait(1000);
      }
    }
    if (!deleted) fail('Dedicated restore bucket did not become empty within the guarded reset window.');
  }

  for (const bucket of buckets) {
    await storageRequest('/bucket', {
      method: 'POST',
      body: {
        id: bucket.id,
        name: bucket.id,
        public: bucket.public,
        file_size_limit: bucket.fileSizeLimit ?? null,
        allowed_mime_types: Array.isArray(bucket.allowedMimeTypes) ? bucket.allowedMimeTypes : null,
      },
    });
  }

  for (const item of objects) {
    const objectPath = encodeObjectPath(item.bucket, item.name);
    await storageRequest(`/object/${objectPath}`, {
      method: 'POST',
      body: item.bytesBuffer,
      headers: {
        'content-type': item.contentType || 'application/octet-stream',
        'cache-control': 'max-age=3600',
        'x-upsert': 'false',
      },
    });
    const restored = await storageRequest(`/object/${objectPath}`, { raw: true });
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

