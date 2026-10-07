-- Self-reports and audited, atomic removal of a case and its sporting effects.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.steward_cases add column deleted_at timestamptz;
create table private.steward_case_deletions (
  case_id uuid primary key references public.steward_cases(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check(length(btrim(reason)) between 10 and 2000),
  previous_result_version_id uuid references public.result_versions(id) on delete restrict,
  result_version_id uuid references public.result_versions(id) on delete restrict,
  deleted_at timestamptz not null default now()
);
alter table private.steward_case_deletions enable row level security;
revoke all on private.steward_case_deletions from public,anon,authenticated,service_role;
create index steward_deletions_actor_idx on private.steward_case_deletions(actor_id);
create index steward_deletions_previous_result_idx on private.steward_case_deletions(previous_result_version_id);
create index steward_deletions_result_idx on private.steward_case_deletions(result_version_id);
create trigger steward_deletions_protect before update or delete on private.steward_case_deletions
for each row execute function private.protect_steward_history();

-- Guarded edits preserve the already deployed function bodies and grants.
do $$ declare body text; changed text; signature text; begin
  signature:='private.record_simple_steward_decision(uuid,uuid,uuid,text,text,text,numeric,uuid,uuid,text)';
  body:=replace(pg_get_functiondef(signature::regprocedure),chr(13),'');
  changed:=replace(body,$old$if p_reported_driver_id is null or p_reported_driver_id=p_accused_driver_id
    or (select count(*) from public.drivers where league_id=season.league_id and id in(p_reported_driver_id,p_accused_driver_id))<>2 then
    raise exception 'Select two different drivers from this league.';$old$,
  $new$if not exists(select 1 from public.drivers where league_id=season.league_id and id=p_reported_driver_id)
    or not exists(select 1 from public.drivers where league_id=season.league_id and id=p_accused_driver_id) then
    raise exception 'Select drivers from this league.';$new$);
  if changed=body then raise exception 'Self-report source guard mismatch'; end if;
  execute changed;

  foreach signature in array array['private.can_read_steward_case(uuid)','private.can_read_private_steward_case(uuid)'] loop
    body:=pg_get_functiondef(signature::regprocedure);
    changed:=replace(body,'sc.id = p_case_id','sc.id = p_case_id and sc.deleted_at is null');
    if changed=body then raise exception 'Case visibility source guard mismatch'; end if;
    execute changed;
  end loop;
  body:=pg_get_functiondef('public.publish_league_result_draft(uuid)'::regprocedure);
  changed:=replace(body,'where c.race_id=v_target_race_id and','where c.race_id=v_target_race_id and c.deleted_at is null and');
  if changed=body then raise exception 'Pending correction source guard mismatch'; end if;
  execute changed;
  body:=pg_get_functiondef('private.process_notification_event(uuid,text)'::regprocedure);
  changed:=replace(body,$old$elsif event_record.event_type = 'steward.decision_finalized' then$old$,
    $new$elsif event_record.event_type = 'steward.decision_finalized' and not exists (
      select 1 from public.steward_cases c where c.id=event_record.aggregate_id and c.deleted_at is not null
    ) then$new$);
  if changed=body then raise exception 'Notification source guard mismatch'; end if;
  execute changed;
end $$;

create function private.delete_steward_case(
  p_case_id uuid,p_reason text,p_expected_decision_version integer,p_expected_result_version_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); item public.steward_cases%rowtype; race public.races%rowtype;
  receipt private.steward_case_deletions%rowtype; result_id uuid; lineage uuid[];
  corrections jsonb; affected record; expected_delta bigint;
begin
  if actor is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  select * into item from public.steward_cases where id=p_case_id;
  if item.id is null or not public.matches_requested_league(item.league_id)
    or not private.has_league_capability(item.league_id,'steward') then
    raise exception using errcode='42501',message='Steward access required.';
  end if;
  -- Same lock order as recording/publishing decisions: race first, then case.
  select * into race from public.races where id=item.race_id for update;
  select * into item from public.steward_cases where id=p_case_id for update;
  select * into receipt from private.steward_case_deletions where case_id=p_case_id;
  if found then
    return jsonb_build_object('id',p_case_id,'deleted',true,'result_version_id',receipt.result_version_id);
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise exception 'Explain why this case is being deleted.'; end if;
  if item.current_decision_version is distinct from p_expected_decision_version
    or race.current_result_version_id is distinct from p_expected_result_version_id then
    raise exception 'Case or result changed. Reload before deleting.';
  end if;
  -- Do not guess how an old disqualification/points-only decision should be undone.
  if exists(select 1 from public.steward_penalties p join public.steward_decision_versions d on d.id=p.decision_version_id
    where d.case_id=p_case_id and p.penalty_type not in ('time_penalty','time_credit','grid_penalty')) then
    raise exception 'Legacy penalty requires a reviewed result correction before deletion.';
  end if;
  if race.current_result_version_id is not null then
    with recursive chain as (
      select id,previous_version_id from public.result_versions where id=race.current_result_version_id
      union select v.id,v.previous_version_id from public.result_versions v join chain c on v.id=c.previous_version_id
    ) select array_agg(id) into lineage from chain;
    if exists(select 1 from public.steward_penalties p join public.steward_decision_versions d on d.id=p.decision_version_id
      join public.steward_penalty_applications a on a.penalty_id=p.id
      where d.case_id=p_case_id and not(a.result_version_id=any(lineage))) then
      raise exception 'Result history changed. Review the result before deleting.';
    end if;
    -- A fresh reimport or manual delta change must never receive a blind inverse.
    for affected in select distinct p.driver_id from public.steward_penalties p
      join public.steward_decision_versions d on d.id=p.decision_version_id
      join public.steward_penalty_applications a on a.penalty_id=p.id
      where d.case_id=p_case_id and p.penalty_type in ('time_penalty','time_credit')
    loop
      select coalesce(sum(p.time_delta_ms),0) into expected_delta from public.steward_penalties p
        join public.steward_decision_versions d on d.id=p.decision_version_id
        join public.steward_cases c on c.id=d.case_id
        join public.steward_penalty_applications a on a.penalty_id=p.id
        where c.race_id=race.id and c.deleted_at is null and p.driver_id=affected.driver_id
          and p.penalty_type in ('time_penalty','time_credit') and a.result_version_id=any(lineage);
      if not exists(select 1 from public.result_version_rows r where r.result_version_id=race.current_result_version_id
        and r.driver_id=affected.driver_id and r.penalty_time_delta_ms=expected_delta) then
        raise exception 'Result history changed. Review the result before deleting.';
      end if;
    end loop;
    select jsonb_agg(jsonb_build_object('driver_id',driver_id,'delta',delta)) into corrections from (
      select p.driver_id,-sum(p.time_delta_ms) delta from public.steward_penalties p
        join public.steward_decision_versions d on d.id=p.decision_version_id
        join public.steward_penalty_applications a on a.penalty_id=p.id
        where d.case_id=p_case_id and p.penalty_type in ('time_penalty','time_credit') group by p.driver_id
    ) changes;
    if corrections is not null then
      result_id:=private.prepare_steward_time_corrections(race.current_result_version_id,corrections,'Fall zurückgenommen '||item.case_number);
      perform private.validate_result_version(result_id);
      perform private.activate_result_version(result_id);
    end if;
  end if;
  insert into private.steward_case_deletions(case_id,actor_id,reason,previous_result_version_id,result_version_id)
    values(p_case_id,actor,btrim(p_reason),race.current_result_version_id,result_id);
  update public.steward_cases set deleted_at=now(),status='withdrawn',current_decision_version=null where id=p_case_id;
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata)
    values('league',item.league_id,actor,'steward.case_deleted','steward_case',p_case_id,
      jsonb_build_object('case_number',item.case_number,'reason',btrim(p_reason),'previous_result_version_id',race.current_result_version_id,'result_version_id',result_id));
  return jsonb_build_object('id',p_case_id,'deleted',true,'result_version_id',result_id);
end $$;
revoke all on function private.delete_steward_case(uuid,text,integer,uuid) from public,anon,authenticated,service_role;

-- Narrow API facade: private schema remains inaccessible; all authorization is above.
create function public.delete_steward_case(p_case_id uuid,p_reason text,p_expected_decision_version integer,p_expected_result_version_id uuid)
returns jsonb language sql security definer set search_path='' as $$
  select private.delete_steward_case(p_case_id,p_reason,p_expected_decision_version,p_expected_result_version_id);
$$;
revoke all on function public.delete_steward_case(uuid,text,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.delete_steward_case(uuid,text,integer,uuid) to authenticated;

-- Retained cases cannot be resurrected through historical write APIs.
create function private.protect_deleted_steward_case() returns trigger language plpgsql set search_path='' as $$
begin
  if old.deleted_at is not null then raise exception 'Deleted steward cases cannot be changed.'; end if;
  return new;
end $$;
revoke all on function private.protect_deleted_steward_case() from public,anon,authenticated,service_role;
create trigger steward_deleted_case_protect before update on public.steward_cases
for each row execute function private.protect_deleted_steward_case();
commit;
