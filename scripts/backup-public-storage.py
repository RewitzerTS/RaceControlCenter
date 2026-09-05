#!/usr/bin/env python3
"""Back up files from currently public Supabase Storage buckets.

The database connection is used only to inventory buckets and object names. Object
bytes are fetched through each bucket's public Storage URL. If a private bucket
exists, this script fails closed instead of silently producing an incomplete
backup.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
from urllib.parse import quote, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

PROJECT_REF = "kjccstcbqygxuqkvdaqw"
SUPABASE_URL = f"https://{PROJECT_REF}.supabase.co"
SUPABASE_HOST = urlparse(SUPABASE_URL).hostname


class SameOriginRedirectHandler(HTTPRedirectHandler):
    """Allow Storage redirects only when they remain on the pinned Supabase host."""

    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        parsed = urlparse(new_url)
        if parsed.scheme != "https" or parsed.hostname != SUPABASE_HOST:
            raise RuntimeError(f"Refusing cross-origin Storage redirect to {parsed.hostname or 'unknown host'}")
        return super().redirect_request(request, file_pointer, code, message, headers, new_url)


SAFE_URL_OPENER = build_opener(SameOriginRedirectHandler())


def query_json(db_url: str, sql: str):
    result = subprocess.run(
        [
            "psql",
            db_url,
            "-X",
            "-qAt",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            sql,
        ],
        check=True,
        capture_output=True,
        text=True,
        env={**os.environ, "PGCONNECT_TIMEOUT": "15"},
    )
    payload = result.stdout.strip() or "[]"
    return json.loads(payload)


def safe_target(root: Path, bucket: str, object_name: str) -> Path:
    pure_name = PurePosixPath(object_name)
    if not object_name or pure_name.is_absolute() or ".." in pure_name.parts:
        raise RuntimeError(f"Unsafe Storage object path: {object_name!r}")

    target = root.joinpath(bucket, *pure_name.parts)
    root_resolved = root.resolve()
    target_resolved = target.resolve()
    try:
        target_resolved.relative_to(root_resolved)
    except ValueError as exc:
        raise RuntimeError(f"Storage object escapes backup root: {object_name!r}") from exc
    return target


def download_object(bucket: str, object_name: str, content_type: str | None, target: Path) -> dict:
    bucket_url = quote(bucket, safe="")
    object_url = quote(object_name, safe="/")
    url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket_url}/{object_url}"

    target.parent.mkdir(parents=True, exist_ok=True)
    request = Request(url, headers={"User-Agent": "RaceVora-Backup/1.0"})

    digest = hashlib.sha256()
    size = 0
    with SAFE_URL_OPENER.open(request, timeout=60) as response, target.open("wb") as handle:
        if getattr(response, "status", 200) != 200:
            raise RuntimeError(f"Unexpected HTTP status for {bucket}/{object_name}: {response.status}")
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            handle.write(chunk)
            digest.update(chunk)
            size += len(chunk)

    return {
        "bucket": bucket,
        "name": object_name,
        "bytes": size,
        "sha256": digest.hexdigest(),
        "contentType": content_type or "application/octet-stream",
    }


def main() -> int:
    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    output_arg = os.environ.get("RACEVORA_STORAGE_BACKUP_DIR", "").strip()
    if not db_url:
        print("SUPABASE_DB_URL is required.", file=sys.stderr)
        return 2
    if not output_arg:
        print("RACEVORA_STORAGE_BACKUP_DIR is required.", file=sys.stderr)
        return 2

    output_dir = Path(output_arg)
    output_dir.mkdir(parents=True, exist_ok=True)

    buckets = query_json(
        db_url,
        """
        select coalesce(
          json_agg(json_build_object(
            'id', id,
            'name', name,
            'public', public,
            'fileSizeLimit', file_size_limit,
            'allowedMimeTypes', allowed_mime_types
          ) order by name),
          '[]'::json
        )::text
        from storage.buckets;
        """,
    )

    private_buckets = [str(bucket["name"]) for bucket in buckets if not bucket.get("public")]
    if private_buckets:
        print(
            "Private Supabase Storage bucket(s) detected; refusing an incomplete public-URL backup: "
            + ", ".join(private_buckets),
            file=sys.stderr,
        )
        return 3

    objects = query_json(
        db_url,
        """
        select coalesce(
          json_agg(json_build_object(
            'bucket', bucket_id,
            'name', name,
            'contentType', metadata ->> 'mimetype'
          ) order by bucket_id, name),
          '[]'::json
        )::text
        from storage.objects;
        """,
    )

    (output_dir / "buckets.json").write_text(
        json.dumps(buckets, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    storage_root = output_dir / "objects"
    manifest = []
    for item in objects:
        bucket = str(item["bucket"])
        object_name = str(item["name"])
        target = safe_target(storage_root, bucket, object_name)
        content_type = item.get("contentType")
        manifest.append(download_object(bucket, object_name, content_type, target))

    (output_dir / "storage-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Storage backup completed: {len(buckets)} bucket(s), {len(manifest)} object(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
