-- Recover unpublished imports without removing sporting history or steward decisions.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create or replace function private.steward_duration_ms(p_text text)
returns bigint language plpgsql immutable set search_path='' as $$
declare parts text[]; value text:=replace(btrim(p_text),',','.'); seconds numeric;
begin
  -- OCR sometimes substitutes the millisecond decimal separator: 14:337 = 14.337s.
  -- Exactly three trailing digits makes this unambiguous; 1:23 remains 1m23s.
  if value ~ '^\d+:\d{3}$' then value:=replace(value,':','.'); end if;
  if value is null or length(value)>32 or value !~ '^\d+(:[0-5]?\d){0,2}(\.\d{1,3})?$' then return null; end if;
  parts:=string_to_array(value,':');
  if cardinality(parts)=3 then seconds:=parts[1]::numeric*3600+parts[2]::numeric*60+parts[3]::numeric;
  elsif cardinality(parts)=2 then seconds:=parts[1]::numeric*60+parts[2]::numeric;
  else seconds:=parts[1]::numeric; end if;
  return round(seconds*1000)::bigint;
exception when numeric_value_out_of_range then return null;
end $$;

create table private.result_draft_discards (
  result_version_id uuid primary key references public.result_versions(id) on delete restrict,
  actor_id uuid not null,
  discarded_at timestamptz not null default now()
);
alter table private.result_draft_discards enable row level security;
revoke all on private.result_draft_discards from public,anon,authenticated,service_role;
create trigger result_draft_discards_immutable before update or delete on private.result_draft_discards
for each row execute function private.protect_steward_history();

create or replace function private.discard_league_result_draft(p_result_version_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); source public.result_versions%rowtype; race public.races%rowtype; league_id uuid;
begin
  if actor is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  select * into source from public.result_versions where id=p_result_version_id;
  -- Publication and withdrawal serialize on the same race, in the same lock order.
  select r.* into race from public.races r where r.id=source.race_id for update;
  select s.league_id into league_id from public.seasons s where s.id=race.season_id;
  if league_id is null or not public.matches_requested_league(league_id)
    or not private.has_league_capability(league_id,'league_admin') then
    raise exception using errcode='42501',message='League result access denied.';
  end if;
  select * into source from public.result_versions where id=p_result_version_id for update;
  if exists(select 1 from private.result_draft_discards where result_version_id=source.id) then
    return jsonb_build_object('id',source.id,'race_id',race.id,'status','discarded');
  end if;
  if source.status not in ('draft','validated') or source.activated_at is not null
    or race.current_result_version_id=source.id
    or exists(select 1 from private.steward_publication_receipts where source_version_id=source.id or result_version_id=source.id)
    or exists(select 1 from public.steward_penalty_applications where result_version_id=source.id)
    or exists(select 1 from public.steward_decision_versions where result_version_id=source.id) then
    raise exception 'Only unpublished result drafts can be discarded.';
  end if;
  insert into private.result_draft_discards(result_version_id,actor_id) values(source.id,actor);
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata)
    values('league',league_id,actor,'result.draft_discarded','result_version',source.id,jsonb_build_object('race_id',race.id));
  return jsonb_build_object('id',source.id,'race_id',race.id,'status','discarded');
end $$;
revoke all on function private.discard_league_result_draft(uuid) from public,anon,authenticated,service_role;
create or replace function public.discard_league_result_draft(p_result_version_id uuid)
returns jsonb language sql security definer set search_path='' as $$
  select private.discard_league_result_draft(p_result_version_id);
$$;
revoke all on function public.discard_league_result_draft(uuid) from public,anon,authenticated,service_role;
grant execute on function public.discard_league_result_draft(uuid) to authenticated;

-- Keep the immutable source for audit but prevent any later validation/activation.
create or replace function private.protect_discarded_result_draft()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from private.result_draft_discards where result_version_id=old.id) then
    raise exception 'This result draft was discarded. Upload the images again to create a new draft.';
  end if;
  return new;
end $$;
revoke all on function private.protect_discarded_result_draft() from public,anon,authenticated,service_role;
create trigger protect_discarded_result_draft before update on public.result_versions
for each row execute function private.protect_discarded_result_draft();

do $patch$
declare body text; needle text;
begin
  body:=replace(pg_get_functiondef('public.get_league_configuration_workspace()'::regprocedure),chr(13),'');
  needle:='and rv.status in (''draft'',''validated'')';
  if position(needle in body)=0 then raise exception 'Draft list patch target missing.'; end if;
  execute replace(body,needle,needle||' and not exists(select 1 from private.result_draft_discards discarded where discarded.result_version_id=rv.id)');
  body:=replace(pg_get_functiondef('public.publish_league_result_draft(uuid)'::regprocedure),chr(13),'');
  needle:='  v_target_race_id:=race.id;';
  if position(needle in body)=0 then raise exception 'Publication patch target missing.'; end if;
  execute replace(body,needle,needle||E'\n  if exists(select 1 from private.result_draft_discards where result_version_id=p_result_version_id) then\n    raise exception ''This result draft was discarded. Upload the images again to create a new draft.'';\n  end if;');
end $patch$;
commit;
