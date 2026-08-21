#!/usr/bin/env bash
set -euo pipefail

umask 077

readonly expected_target_ref='lugedxtmfitxrkacmjpb'
readonly production_ref='kjccstcbqygxuqkvdaqw'
readonly staging_ref='znnkwjogtvzwfkwnmawp'
readonly session_pooler_host='aws-1-eu-west-1.pooler.supabase.com'

for required_name in TARGET_DB_URL TARGET_SUPABASE_SECRET_KEY R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY BACKUP_ENCRYPTION_PASSPHRASE; do
  if [ -z "${!required_name:-}" ]; then
    echo "::error::Missing required restore-drill secret: ${required_name}" >&2
    exit 1
  fi
done

if [[ "$TARGET_DB_URL" != *"$expected_target_ref"* ]]; then
  echo '::error::TARGET_DB_URL does not identify the dedicated restore-drill project.' >&2
  exit 1
fi
if [[ "$TARGET_DB_URL" == *"$production_ref"* || "$TARGET_DB_URL" == *"$staging_ref"* ]]; then
  echo '::error::Production and Beta Staging are forbidden restore targets.' >&2
  exit 1
fi

# GitHub-hosted runners are IPv4-only. Accept the dashboard's direct Drill URI,
# but rewrite only that exact host and role to the pinned IPv4 Session Pooler.
case "$TARGET_DB_URL" in
  postgresql://postgres:*@db.${expected_target_ref}.supabase.co:5432/*)
    TARGET_DB_URL="${TARGET_DB_URL/postgresql:\/\/postgres:/postgresql:\/\/postgres.${expected_target_ref}:}"
    TARGET_DB_URL="${TARGET_DB_URL/@db.${expected_target_ref}.supabase.co:5432/@${session_pooler_host}:5432}"
    ;;
  postgres://postgres:*@db.${expected_target_ref}.supabase.co:5432/*)
    TARGET_DB_URL="${TARGET_DB_URL/postgres:\/\/postgres:/postgres:\/\/postgres.${expected_target_ref}:}"
    TARGET_DB_URL="${TARGET_DB_URL/@db.${expected_target_ref}.supabase.co:5432/@${session_pooler_host}:5432}"
    ;;
esac

case "$TARGET_DB_URL" in
  postgresql://postgres.${expected_target_ref}:*@${session_pooler_host}:5432/* | \
  postgres://postgres.${expected_target_ref}:*@${session_pooler_host}:5432/*)
    ;;
  *)
    echo '::error::TARGET_DB_URL must resolve to the pinned Drill Session Pooler role and host.' >&2
    exit 1
    ;;
esac

psql "$TARGET_DB_URL" --variable ON_ERROR_STOP=1 --tuples-only --command 'select 1' >/dev/null

readonly restore_root="${RUNNER_TEMP:?RUNNER_TEMP is required}/racevora-v1-restore-drill"
rm -rf "$restore_root"
mkdir -p "$restore_root"

cleanup() {
  rm -rf "$restore_root"
}
trap cleanup EXIT

latest_key="$(aws s3api list-objects-v2 \
  --bucket "$R2_BUCKET" \
  --prefix 'daily/' \
  --endpoint-url "$R2_ENDPOINT" \
  --query "reverse(sort_by(Contents[?ends_with(Key, '.tar.gz.gpg')], &LastModified))[0].Key" \
  --output text)"

if [ -z "$latest_key" ] || [ "$latest_key" = 'None' ] || [[ "$latest_key" != *.tar.gz.gpg ]]; then
  echo '::error::No encrypted RaceVora database backup was found in the approved R2 prefix.' >&2
  exit 1
fi

encrypted="$restore_root/$(basename "$latest_key")"
checksum_file="${encrypted}.sha256"
archive="${encrypted%.gpg}"

aws s3 cp "s3://${R2_BUCKET}/${latest_key}" "$encrypted" \
  --endpoint-url "$R2_ENDPOINT" --no-progress --only-show-errors
aws s3 cp "s3://${R2_BUCKET}/${latest_key}.sha256" "$checksum_file" \
  --endpoint-url "$R2_ENDPOINT" --no-progress --only-show-errors

(
  cd "$restore_root"
  sha256sum -c "$(basename "$checksum_file")"
)

passfile="$restore_root/passphrase"
printf '%s' "$BACKUP_ENCRYPTION_PASSPHRASE" > "$passfile"
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$passfile" \
  --decrypt --output "$archive" "$encrypted"
rm -f "$passfile" "$encrypted" "$checksum_file"

tar -xzf "$archive" -C "$restore_root"
rm -f "$archive"

backup_dir="$(find "$restore_root" -mindepth 2 -maxdepth 2 -type f -name 'roles.sql' -printf '%h\n' | head -n 1)"
if [ -z "$backup_dir" ] || [ ! -f "$backup_dir/schema.sql" ] || [ ! -f "$backup_dir/data.sql" ] || \
  [ ! -f "$backup_dir/auth-data.dump" ] || [ ! -f "$backup_dir/auth-evidence.txt" ] || \
  [ "$(cat "$backup_dir/backup-format-version.txt" 2>/dev/null)" != '2' ]; then
  echo '::error::Latest backup is not a complete RaceVora recovery format v2 archive.' >&2
  exit 1
fi

if [ -f "$backup_dir/SHA256SUMS" ]; then
  (cd "$backup_dir" && sha256sum -c SHA256SUMS)
fi

# Hosted Supabase owns and protects its platform roles. The source roles dump is
# integrity-checked above, but must not be replayed into another hosted project.
echo 'Using the target project managed roles; verified roles.sql is not replayed.'

IFS='|' read -r expected_auth_users expected_auth_identities expected_credential_fingerprint < "$backup_dir/auth-evidence.txt"
if ! [[ "$expected_auth_users" =~ ^[0-9]+$ && "$expected_auth_identities" =~ ^[0-9]+$ && "$expected_credential_fingerprint" =~ ^[0-9a-f]{32}$ ]]; then
  echo '::error::Auth recovery evidence is malformed.' >&2
  exit 1
fi

# Supabase CLI data dumps can contain managed Auth COPY blocks even though Auth
# is restored and verified separately below. Remove only those table-data
# blocks from the disposable copy used by this drill. Keeping the original
# checksum-verified data.sql untouched preserves the backup evidence.
portable_data="$restore_root/portable-data.sql"
awk '
  BEGIN { skip_auth_copy = 0 }
  skip_auth_copy {
    if ($0 == "\\.") {
      skip_auth_copy = 0
    }
    next
  }
  /^COPY[[:space:]]+(auth\.|"auth"\.)/ {
    skip_auth_copy = 1
    next
  }
  { print }
  END {
    if (skip_auth_copy) {
      exit 42
    }
  }
' "$backup_dir/data.sql" > "$portable_data" || {
  echo '::error::Could not isolate managed Auth COPY data from the portable database restore.' >&2
  exit 1
}
if grep -Eq '^COPY[[:space:]]+(auth\.|"auth"\.)' "$portable_data"; then
  echo '::error::Portable database restore still contains managed Auth table data.' >&2
  exit 1
fi

psql "$TARGET_DB_URL" --variable ON_ERROR_STOP=1 --single-transaction <<'SQL'
drop schema if exists private cascade;
drop schema if exists public cascade;
create schema public authorization postgres;
comment on schema public is 'standard public schema';
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
delete from supabase_migrations.schema_migrations;
SQL

# The target is a disposable, explicitly confirmed restore project. Keep its
# managed Auth schema/migration state, clear only table data, then replay the
# source Auth data. Public is already absent, so app foreign keys cannot cascade
# unexpectedly into the restore.
psql "$TARGET_DB_URL" --variable ON_ERROR_STOP=1 --single-transaction <<'SQL'
do $reset_auth$
declare
  auth_table record;
begin
  for auth_table in
    select tablename
    from pg_tables
    where schemaname = 'auth'
      and tablename not in ('schema_migrations', 'instances')
    order by tablename
  loop
    execute format('truncate table auth.%I cascade', auth_table.tablename);
  end loop;
end
$reset_auth$;
SQL

pg_restore_major='0'
if command -v pg_restore >/dev/null 2>&1; then
  pg_restore_major="$(pg_restore --version | sed -E 's/.* ([0-9]+)(\..*)?$/\1/')"
fi
if [[ "$pg_restore_major" =~ ^[0-9]+$ ]] && [ "$pg_restore_major" -ge 17 ]; then
  PGOPTIONS='-c session_replication_role=replica' \
  pg_restore --exit-on-error --single-transaction --data-only \
    --no-owner --no-privileges --dbname "$TARGET_DB_URL" "$backup_dir/auth-data.dump"
elif command -v docker >/dev/null 2>&1; then
  docker run --rm \
    --env TARGET_DB_URL \
    --env PGOPTIONS='-c session_replication_role=replica' \
    --volume "${backup_dir}:/backup:ro" \
    postgres:17 \
    sh -ceu 'pg_restore --exit-on-error --single-transaction --data-only --no-owner --no-privileges --dbname "$TARGET_DB_URL" /backup/auth-data.dump'
else
  echo '::error::PostgreSQL 17 pg_restore (or Docker) is required for Auth recovery.' >&2
  exit 1
fi

# A restore into a new project intentionally does not preserve old JWT validity.
# Removing source sessions forces a clean password sign-in against the restored
# credential hash and the target project's own JWT secret.
psql "$TARGET_DB_URL" --variable ON_ERROR_STOP=1 --single-transaction <<'SQL'
truncate table auth.sessions cascade;
truncate table auth.refresh_tokens cascade;
SQL

psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$backup_dir/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$portable_data" \
  --dbname "$TARGET_DB_URL"

psql "$TARGET_DB_URL" --variable ON_ERROR_STOP=1 <<'SQL'
do $validation$
begin
  if to_regclass('public.leagues') is null then
    raise exception 'restored public.leagues table is missing';
  end if;
  if not exists (select 1 from public.leagues where slug = 'rcc') then
    raise exception 'protected rcc tenant is missing from restored data';
  end if;
  if not exists (select 1 from auth.users) then
    raise exception 'restored Auth user set is empty';
  end if;
end
$validation$;

select
  (select count(*) from auth.users) as restored_auth_users,
  (select count(*) from public.leagues) as restored_leagues,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') as restored_public_tables,
  (select count(*) from pg_tables where schemaname = 'public' and rowsecurity) as restored_public_rls_tables;
SQL

actual_auth_evidence="$(psql "$TARGET_DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c \
  "select (select count(*) from auth.users)::text || '|' || (select count(*) from auth.identities)::text || '|' || coalesce((select md5(string_agg(id::text || ':' || coalesce(encrypted_password, ''), '|' order by id)) from auth.users), md5(''));")"
expected_auth_evidence="${expected_auth_users}|${expected_auth_identities}|${expected_credential_fingerprint}"
if [ "$actual_auth_evidence" != "$expected_auth_evidence" ]; then
  echo '::error::Auth user, identity or credential recovery evidence does not match the source backup.' >&2
  exit 1
fi

export TARGET_SUPABASE_URL="https://${expected_target_ref}.supabase.co"
export RACEVORA_RESTORE_BACKUP_DIR="$backup_dir"
node scripts/restore-public-storage.mjs
unset TARGET_SUPABASE_SECRET_KEY TARGET_SUPABASE_URL RACEVORA_RESTORE_BACKUP_DIR

echo "PASS encrypted V1 database, Auth credential and Storage restore completed in dedicated target ${expected_target_ref}."

