-- Phase 6 hardening: audit evidence may change only during its exact lifecycle transition.

create or replace function private.protect_result_version_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception using
        errcode = '23514',
        message = 'An official result version cannot be deleted.';
    end if;
    return old;
  end if;

  if new.id <> old.id
     or new.race_id <> old.race_id
     or new.version_number <> old.version_number
     or new.previous_version_id is distinct from old.previous_version_id
     or new.created_by is distinct from old.created_by
     or new.created_at <> old.created_at then
    raise exception using
      errcode = '23514',
      message = 'Result version identity and lineage are immutable.';
  end if;

  if old.status <> 'draft' and (
    new.source_import_id is distinct from old.source_import_id
    or new.change_reason <> old.change_reason
  ) then
    raise exception using
      errcode = '23514',
      message = 'Official result version metadata is immutable.';
  end if;

  if not (
    (old.status = 'draft' and new.status in ('draft', 'validated'))
    or (old.status = 'validated' and new.status in ('validated', 'active'))
    or (old.status = 'active' and new.status in ('active', 'superseded', 'void'))
    or (old.status = 'superseded' and new.status = 'superseded')
    or (old.status = 'void' and new.status = 'void')
  ) then
    raise exception using
      errcode = '23514',
      message = 'Invalid result version lifecycle transition.';
  end if;

  if old.status = 'draft' and new.status = 'draft' and (
    new.validated_by is not null or new.validated_at is not null
    or new.activated_by is not null or new.activated_at is not null
    or new.superseded_at is not null
    or new.voided_by is not null or new.voided_at is not null or new.void_reason is not null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Draft result versions cannot contain lifecycle audit evidence.';
  end if;

  if old.status <> 'draft' and (
    new.validated_by is distinct from old.validated_by
    or new.validated_at is distinct from old.validated_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'Result validation evidence is immutable.';
  end if;

  if not (old.status = 'validated' and new.status = 'active') and (
    new.activated_by is distinct from old.activated_by
    or new.activated_at is distinct from old.activated_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'Result activation evidence is immutable.';
  end if;

  if not (old.status = 'active' and new.status = 'superseded')
     and new.superseded_at is distinct from old.superseded_at then
    raise exception using
      errcode = '23514',
      message = 'Result supersession evidence is immutable.';
  end if;

  if not (old.status = 'active' and new.status = 'void') and (
    new.voided_by is distinct from old.voided_by
    or new.voided_at is distinct from old.voided_at
    or new.void_reason is distinct from old.void_reason
  ) then
    raise exception using
      errcode = '23514',
      message = 'Result void evidence is immutable.';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_result_version_history()
  from public, anon, authenticated, service_role;
