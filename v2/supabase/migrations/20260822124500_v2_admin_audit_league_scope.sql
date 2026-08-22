-- RaceVora V2: keep league-scoped admin audit writes complete and tenant-visible.
-- Admin RPCs carry the league id in immutable metadata; this trigger copies it
-- into the indexed audit scope column before constraints are evaluated.

create or replace function private.attach_v2_audit_league_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.scope = 'league' and new.league_id is null then
    begin
      new.league_id := nullif(new.metadata ->> 'league_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'League audit metadata contains an invalid league id.';
    end;
  end if;
  return new;
end;
$$;

revoke all on function private.attach_v2_audit_league_scope()
  from public, anon, authenticated, service_role;

create trigger v2_audit_events_attach_league_scope
before insert on public.v2_audit_events
for each row execute function private.attach_v2_audit_league_scope();
