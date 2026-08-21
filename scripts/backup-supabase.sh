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

# Supabase CLI intentionally excludes managed Auth data from its portable app
# dump. Keep a separate data-only Auth archive inside the same encrypted outer
# archive. Project-owned configuration (JWT secret, redirects, SMTP, CAPTCHA)
# remains outside the database and is handled by the recovery checklist.
auth_dump="${output_dir}/auth-data.dump"
auth_dump_args=(
  --dbname "$SUPABASE_DB_URL"
  --format custom
  --data-only
  --schema auth
  --no-owner
  --no-privileges
  --exclude-table-data auth.schema_migrations
  --exclude-table-data auth.instances
  --file "$auth_dump"
)

pg_dump_major='0'
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump_major="$(pg_dump --version | sed -E 's/.* ([0-9]+)(\..*)?$/\1/')"
fi

if [[ "$pg_dump_major" =~ ^[0-9]+$ ]] && [ "$pg_dump_major" -ge 17 ]; then
  pg_dump "${auth_dump_args[@]}"
elif command -v docker >/dev/null 2>&1; then
  docker run --rm \
    --env SUPABASE_DB_URL \
    --volume "${output_dir}:/backup" \
    postgres:17 \
    sh -ceu 'pg_dump --dbname "$SUPABASE_DB_URL" --format custom --data-only --schema auth --no-owner --no-privileges --exclude-table-data auth.schema_migrations --exclude-table-data auth.instances --file /backup/auth-data.dump'
else
  echo 'PostgreSQL 17 pg_dump (or Docker) is required for the Auth backup.' >&2
  exit 1
fi

if [ ! -s "$auth_dump" ]; then
  echo 'Auth data dump was not created.' >&2
  exit 1
fi

psql "$SUPABASE_DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c \
  "select (select count(*) from auth.users)::text || '|' || (select count(*) from auth.identities)::text || '|' || coalesce((select md5(string_agg(id::text || ':' || coalesce(encrypted_password, ''), '|' order by id)) from auth.users), md5(''));" \
  > "${output_dir}/auth-evidence.txt"

if ! grep -Eq '^[0-9]+\|[0-9]+\|[0-9a-f]{32}$' "${output_dir}/auth-evidence.txt"; then
  echo 'Auth evidence is malformed.' >&2
  exit 1
fi

printf '%s\n' '2' > "${output_dir}/backup-format-version.txt"

(
  cd "$output_dir"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum roles.sql schema.sql data.sql auth-data.dump auth-evidence.txt backup-format-version.txt > SHA256SUMS
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 roles.sql schema.sql data.sql auth-data.dump auth-evidence.txt backup-format-version.txt > SHA256SUMS
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
- auth-data.dump (Auth data only; managed Auth schema/configuration excluded)
- auth-evidence.txt (aggregate recovery proof; no e-mail addresses or passwords)
- backup-format-version.txt
- SHA256SUMS when supported

IMPORTANT:
- This directory can contain sensitive and personal data.
- Encrypt it and move it to an access-restricted off-site backup location.
- Do not commit these files to GitHub.
- Storage object bytes are added separately before the outer archive is encrypted.
- A full Supabase disaster recovery also needs project settings, Edge Functions
  and secrets as described in docs/operations-runbook.md.
EOF

unset SUPABASE_DB_URL

echo 'Backup completed.'
echo "Next: encrypt and transfer ${output_dir} to the approved off-site backup location."
