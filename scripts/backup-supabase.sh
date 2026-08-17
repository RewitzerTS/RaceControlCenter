#!/usr/bin/env bash
set -euo pipefail

umask 077

if ! command -v supabase >/dev/null 2>&1; then
  echo 'Supabase CLI not found. Install/update it from the official Supabase CLI documentation.' >&2
  exit 1
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo 'SUPABASE_DB_URL is required. Set it only in your local shell/secret manager; never commit it.' >&2
  exit 1
fi

backup_root="${RACEVORA_BACKUP_DIR:-$HOME/racevora-backups}"
timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
output_dir="${backup_root}/${timestamp}"

mkdir -p "$output_dir"

echo "Creating RaceVora Supabase logical backup in: ${output_dir}"

supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "${output_dir}/roles.sql" \
  --role-only

supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "${output_dir}/schema.sql"

supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "${output_dir}/data.sql" \
  --use-copy \
  --data-only \
  -x 'storage.buckets_vectors' \
  -x 'storage.vector_indexes'

(
  cd "$output_dir"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum roles.sql schema.sql data.sql > SHA256SUMS
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 roles.sql schema.sql data.sql > SHA256SUMS
  else
    echo 'No SHA-256 utility found; skipping checksum manifest.' >&2
  fi
)

cat > "${output_dir}/README.txt" <<EOF
RaceVora Supabase logical backup
Created (UTC): ${timestamp}
Source project: kjccstcbqygxuqkvdaqw

Contains:
- roles.sql
- schema.sql
- data.sql
- SHA256SUMS when supported

IMPORTANT:
- This directory can contain sensitive and personal data.
- Encrypt it and move it to an access-restricted off-site backup location.
- Do not commit these files to GitHub.
- Database dumps do not include the actual Supabase Storage object files.
- A full Supabase disaster recovery also needs Auth/project settings, Edge Functions,
  secrets and Storage recovery as described in docs/operations-runbook.md.
EOF

unset SUPABASE_DB_URL

echo 'Backup completed.'
echo "Next: encrypt and transfer ${output_dir} to the approved off-site backup location."
