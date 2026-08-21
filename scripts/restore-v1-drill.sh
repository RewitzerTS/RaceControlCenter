#!/usr/bin/env bash
set -euo pipefail

umask 077

readonly expected_target_ref='lugedxtmfitxrkacmjpb'
readonly production_ref='kjccstcbqygxuqkvdaqw'
readonly staging_ref='znnkwjogtvzwfkwnmawp'
readonly session_pooler_host='aws-1-eu-west-1.pooler.supabase.com'

for required_name in TARGET_DB_URL R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY BACKUP_ENCRYPTION_PASSPHRASE; do
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
if [ -z "$backup_dir" ] || [ ! -f "$backup_dir/schema.sql" ] || [ ! -f "$backup_dir/data.sql" ]; then
  echo '::error::Decrypted backup does not contain roles.sql, schema.sql and data.sql.' >&2
  exit 1
fi

if [ -f "$backup_dir/SHA256SUMS" ]; then
  (cd "$backup_dir" && sha256sum -c SHA256SUMS)
fi

# Hosted Supabase owns and protects its platform roles. The source roles dump is
# integrity-checked above, but must not be replayed into another hosted project.
echo 'Using the target project managed roles; verified roles.sql is not replayed.'

psql "$TARGET_DB_URL" --variable ON_ERROR_STOP=1 --single-transaction <<'SQL'
drop schema if exists private cascade;
drop schema if exists public cascade;
create schema public authorization postgres;
comment on schema public is 'standard public schema';
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
delete from supabase_migrations.schema_migrations;
SQL

psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$backup_dir/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$backup_dir/data.sql" \
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

storage_file_count="$(find "$backup_dir/storage" -type f 2>/dev/null | wc -l | tr -d ' ')"
echo "PASS encrypted V1 database restore completed in dedicated target ${expected_target_ref}."
echo "Storage backup files present in archive: ${storage_file_count}."
