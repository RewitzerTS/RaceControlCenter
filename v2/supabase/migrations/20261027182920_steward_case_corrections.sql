-- Append-only corrections: replace effects atomically; preserve earlier decisions.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.steward_driver_decisions drop constraint steward_driver_decisions_penalty_type_check;
alter table public.steward_driver_decisions add constraint steward_driver_decisions_penalty_type_check check(penalty_type in ('time_penalty','time_credit','grid_penalty','no_action','dismissed'));
alter table public.steward_driver_decisions drop constraint steward_driver_decisions_check;
alter table public.steward_driver_decisions add constraint steward_driver_decisions_check check(
 (penalty_type in ('no_action','dismissed') and amount is null and target_race_id is null)
 or (penalty_type in ('time_penalty','time_credit') and amount is not null and amount>0 and amount<=3600 and amount*1000=trunc(amount*1000) and target_race_id is null)
 or (penalty_type='grid_penalty' and amount is not null and amount>=1 and amount<=99 and amount=trunc(amount) and target_race_id is not null));
create function private.steward_decision_is_current(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.steward_decision_versions d join public.steward_cases c on c.id=d.case_id where d.id=p_id and c.deleted_at is null and d.version_number=c.current_decision_version);
$$;
revoke all on function private.steward_decision_is_current(uuid) from public,anon,authenticated,service_role;
create function private.steward_case_inverse_adjustments(p_case_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare race public.races%rowtype; lineage uuid[]; corrections jsonb; affected record; expected_delta bigint;
begin
 select r.* into race from public.races r join public.steward_cases c on c.race_id=r.id where c.id=p_case_id for update of r;
  -- Do not guess how an old disqualification/points-only decision should be undone.
  if exists(select 1 from public.steward_penalties p join public.steward_decision_versions d on d.id=p.decision_version_id
    where d.case_id=p_case_id and private.steward_decision_is_current(d.id) and p.penalty_type not in ('time_penalty','time_credit','grid_penalty')) then
    raise exception 'Legacy penalty requires a reviewed result correction before deletion.';
  end if;
  if race.current_result_version_id is not null then
    with recursive chain as (
      select id,previous_version_id from public.result_versions where id=race.current_result_version_id
      union select v.id,v.previous_version_id from public.result_versions v join chain c on v.id=c.previous_version_id
    ) select array_agg(id) into lineage from chain;
    if exists(select 1 from public.steward_penalties p join public.steward_decision_versions d on d.id=p.decision_version_id
      join public.steward_penalty_applications a on a.penalty_id=p.id
      where d.case_id=p_case_id and private.steward_decision_is_current(d.id) and not(a.result_version_id=any(lineage))) then
      raise exception 'Result history changed. Review the result before deleting.';
    end if;
    -- A fresh reimport or manual delta change must never receive a blind inverse.
    for affected in select distinct p.driver_id from public.steward_penalties p
      join public.steward_decision_versions d on d.id=p.decision_version_id
      join public.steward_penalty_applications a on a.penalty_id=p.id
      where d.case_id=p_case_id and private.steward_decision_is_current(d.id) and p.penalty_type in ('time_penalty','time_credit')
    loop
      select coalesce(sum(p.time_delta_ms),0) into expected_delta from public.steward_penalties p
        join public.steward_decision_versions d on d.id=p.decision_version_id
        join public.steward_cases c on c.id=d.case_id
        join public.steward_penalty_applications a on a.penalty_id=p.id
        where c.race_id=race.id and c.deleted_at is null and d.version_number=c.current_decision_version and p.driver_id=affected.driver_id
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
        where d.case_id=p_case_id and private.steward_decision_is_current(d.id) and p.penalty_type in ('time_penalty','time_credit') group by p.driver_id
    ) changes;
  end if;

 return coalesce(corrections,'[]'::jsonb);
end $$;
revoke all on function private.steward_case_inverse_adjustments(uuid) from public,anon,authenticated,service_role;
create function private.save_steward_group_case_revision(
  p_race_id uuid,p_reporter_ids uuid[],p_accused_ids uuid[],p_title text,p_description text,
  p_decisions jsonb,p_draft boolean,p_case_id uuid,p_idempotency_key text,
  p_expected_decision_version integer,p_expected_result_version_id uuid,p_correction_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); race public.races%rowtype; season public.seasons%rowtype; target public.races%rowtype;
  item public.steward_cases%rowtype; receipt private.steward_group_receipts%rowtype;
  reporters uuid[]; accused uuid[]; stored_reporters uuid[]; stored_accused uuid[];
  entry jsonb; driver uuid; kind text; amount numeric; target_id uuid; reason text;
  decision_number integer:=1; is_revision boolean:=false; inverse jsonb;
  request jsonb; response jsonb; corrections jsonb:='[]'; decision_id uuid; result_id uuid; v_case_id uuid;
begin
  if actor is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  select * into race from public.races where id=p_race_id for update;
  select * into season from public.seasons where id=race.season_id;
  if race.id is null or not public.matches_requested_league(season.league_id)
    or not private.has_league_capability(season.league_id,'steward') then
    raise exception using errcode='42501',message='Steward access required.';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 160 then raise exception 'Invalid idempotency key.'; end if;
  if p_draft is null or p_title is null or length(btrim(p_title)) not between 4 and 140
    or p_description is null or length(btrim(p_description)) not between 10 and 4000 then raise exception 'Provide a title and incident description.'; end if;
  select array_agg(distinct selected.driver_id order by selected.driver_id) into reporters from unnest(p_reporter_ids) as selected(driver_id);
  select array_agg(distinct selected.driver_id order by selected.driver_id) into accused from unnest(p_accused_ids) as selected(driver_id);
  if coalesce(cardinality(reporters),0) not between 1 and 100 or coalesce(cardinality(accused),0) not between 1 and 100
    or cardinality(reporters)<>cardinality(p_reporter_ids) or cardinality(accused)<>cardinality(p_accused_ids)
    or array_position(reporters,null) is not null or array_position(accused,null) is not null then
    raise exception 'Select unique reporters and accused drivers.';
  end if;
  if exists(select 1 from unnest(reporters||accused) as selected(driver_id) where not exists(select 1 from public.drivers d where d.id=selected.driver_id and d.league_id=season.league_id)) then
    raise exception 'Select drivers from this league.';
  end if;
  request:=jsonb_build_object('race',p_race_id,'reporters',reporters,'accused',accused,'title',btrim(p_title),'description',btrim(p_description),'decisions',p_decisions,'draft',p_draft,'case',p_case_id);
  if p_expected_decision_version is not null then
    request:=request||jsonb_build_object('expected_decision',p_expected_decision_version,'expected_result',p_expected_result_version_id,'correction_reason',p_correction_reason);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||p_idempotency_key,0));
  select * into receipt from private.steward_group_receipts where actor_id=actor and idempotency_key=p_idempotency_key;
  if found then
    if receipt.request<>request then raise exception 'Idempotency key belongs to another request.'; end if;
    return receipt.response;
  end if;
  if not season.is_active then raise exception 'Select a race in the active season.'; end if;
  if race.status in ('cancelled','postponed') or (race.current_result_version_id is null and race.status<>'completed'
    and coalesce(race.race_start_at,(race.race_date::text||' '||coalesce(race.race_time,'00:00'))::timestamp at time zone 'Europe/Berlin','infinity'::timestamptz)>now()) then
    raise exception 'Select a race that has already taken place.';
  end if;
  if p_draft then
    if p_case_id is not null or p_decisions is distinct from '[]'::jsonb then raise exception 'An open draft only stores the incident and participants.'; end if;
  else
    if p_decisions is null or jsonb_typeof(p_decisions)<>'array' then raise exception 'Provide one decision per accused driver.'; end if;
    if jsonb_array_length(p_decisions)<>cardinality(accused)
      or (select count(distinct (value->>'driver_id')::uuid) from jsonb_array_elements(p_decisions))<>cardinality(accused) then
      raise exception 'Provide exactly one decision per accused driver.';
    end if;
    for entry in select value from jsonb_array_elements(p_decisions) loop
      driver:=(entry->>'driver_id')::uuid; kind:=entry->>'penalty_type'; amount:=(entry->>'amount')::numeric;
      target_id:=(entry->>'target_race_id')::uuid; reason:=entry->>'reasoning';
      if driver is null or not(driver=any(accused)) or kind is null or kind not in ('time_penalty','time_credit','grid_penalty','no_action','dismissed')
        or reason is null or length(btrim(reason)) not between 10 and 4000 then raise exception 'Invalid driver decision.'; end if;
      if kind in ('no_action','dismissed') then
        if amount is not null or target_id is not null then raise exception 'No action cannot include a penalty amount.'; end if;
      else
        if amount is null or amount<=0 or amount>3600 or amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter a positive penalty amount.'; end if;
        if kind='grid_penalty' then
          if amount<>trunc(amount) or amount>99 then raise exception 'Grid positions must be whole numbers from 1 to 99.'; end if;
          select * into target from public.races r where r.season_id=race.season_id and r.round_number>race.round_number
            and r.status not in ('cancelled','postponed') order by r.round_number limit 1 for update;
          if (target.id is null or target.id is distinct from target_id or target.status='completed' or target.current_result_version_id is not null
            or coalesce(target.race_start_at,(target.race_date::text||' '||coalesce(target.race_time,'00:00'))::timestamp at time zone 'Europe/Berlin','-infinity'::timestamptz)<=now())
            and not exists(select 1 from public.steward_driver_decisions dd join public.steward_decision_versions dv on dv.id=dd.decision_version_id join public.steward_cases sc on sc.id=dv.case_id
              where sc.id=p_case_id and sc.status='closed' and dv.version_number=sc.current_decision_version and dd.driver_id=driver and dd.penalty_type='grid_penalty' and dd.amount=amount and dd.target_race_id=target_id) then
            raise exception 'The next scheduled race is unavailable or has already started.';
          end if;
        else
          if target_id is not null or amount*1000<>trunc(amount*1000) then raise exception 'Use at most three decimal places for seconds and no target race.'; end if;
          corrections:=corrections||jsonb_build_array(jsonb_build_object('driver_id',driver,'delta',(amount*1000)::integer*case when kind='time_credit' then -1 else 1 end));
        end if;
      end if;
    end loop;
  end if;
  if p_case_id is not null then
    select * into item from public.steward_cases where id=p_case_id for update;
    if item.id is null or item.race_id<>race.id or item.status not in ('under_review','closed') or item.deleted_at is not null then raise exception 'The case changed. Reload before publishing.'; end if;
    if item.status='closed' then
      if item.current_decision_version is distinct from p_expected_decision_version or race.current_result_version_id is distinct from p_expected_result_version_id then raise exception 'Case or result changed. Reload before correcting.'; end if;
      if p_correction_reason is null or length(btrim(p_correction_reason)) not between 10 and 2000 then raise exception 'Explain the correction.'; end if;
      is_revision:=true; decision_number:=item.current_decision_version+1;
      inverse:=private.steward_case_inverse_adjustments(item.id);
      select coalesce(jsonb_agg(jsonb_build_object('driver_id',driver_id,'delta',delta)), '[]'::jsonb) into corrections
      from (select e->>'driver_id' driver_id,sum((e->>'delta')::integer) delta from jsonb_array_elements(corrections||inverse) e group by e->>'driver_id' having sum((e->>'delta')::integer)<>0) changes;
    elsif p_expected_decision_version is not null then raise exception 'Case changed. Reload before correcting.';
    end if;
    select array_agg(driver_id order by driver_id) into stored_reporters from public.steward_case_participants where case_id=item.id and role='reporter';
    select array_agg(driver_id order by driver_id) into stored_accused from public.steward_case_participants where case_id=item.id and role='accused';
    stored_reporters:=coalesce(stored_reporters,array[item.reported_driver_id]); stored_accused:=coalesce(stored_accused,array[item.accused_driver_id]);
    if reporters is distinct from stored_reporters or accused is distinct from stored_accused or (not is_revision and btrim(p_title)<>item.title) then raise exception 'The open case does not match the selected drivers.'; end if;
    if exists(select 1 from public.steward_votes v where v.case_id=item.id and v.steward_user_id=actor and v.conflict_disclosed
      and v.vote_version=(select max(v2.vote_version) from public.steward_votes v2 where v2.case_id=item.id and v2.steward_user_id=actor)) then
      raise exception 'A steward with a disclosed conflict cannot finalize this case.';
    end if;
    v_case_id:=item.id;
  else
    -- Do not reuse a legacy RPC key as a new multi-driver case.
    if exists(select 1 from public.steward_cases where created_by=actor and idempotency_key=p_idempotency_key)
      or exists(select 1 from public.steward_decision_versions where finalized_by=actor and idempotency_key=p_idempotency_key) then raise exception 'Idempotency key belongs to another request.'; end if;
    v_case_id:=(public.create_steward_case(race.id,reporters[1],accused[1],p_title,p_description,'Stewardentscheidung','1',p_idempotency_key)->>'id')::uuid;
    select * into item from public.steward_cases where id=v_case_id;
    insert into public.steward_case_participants(case_id,driver_id,role) select v_case_id,selected.driver_id,'reporter' from unnest(reporters) as selected(driver_id);
    insert into public.steward_case_participants(case_id,driver_id,role) select v_case_id,selected.driver_id,'accused' from unnest(accused) as selected(driver_id);
  end if;
  if not p_draft then
    if jsonb_array_length(corrections)>0 and race.current_result_version_id is not null then
      result_id:=private.prepare_steward_time_corrections(race.current_result_version_id,corrections,item.case_number);
      perform private.validate_result_version(result_id); perform private.activate_result_version(result_id);
    end if;
    insert into public.steward_decision_versions(case_id,version_number,outcome,reasoning,rule_code,rule_version,finalized_by,result_version_id,idempotency_key)
      values(v_case_id,decision_number,case when exists(select 1 from jsonb_array_elements(p_decisions) e where e->>'penalty_type' not in ('no_action','dismissed')) then 'penalty' when not exists(select 1 from jsonb_array_elements(p_decisions) e where e->>'penalty_type'<>'dismissed') then 'dismissed' else 'no_action' end,
      btrim(p_description),item.rule_code,item.rule_version,actor,result_id,p_idempotency_key) returning id into decision_id;
    for entry in select value from jsonb_array_elements(p_decisions) loop
      driver:=(entry->>'driver_id')::uuid; kind:=entry->>'penalty_type'; amount:=(entry->>'amount')::numeric;
      target_id:=(entry->>'target_race_id')::uuid; reason:=btrim(entry->>'reasoning');
      insert into public.steward_driver_decisions(decision_version_id,driver_id,penalty_type,amount,target_race_id,reasoning)
        values(decision_id,driver,kind,amount,target_id,reason);
      if kind not in ('no_action','dismissed') then
        insert into public.steward_penalties(decision_version_id,driver_id,penalty_type,time_delta_ms,grid_positions,target_race_id,reason)
          values(decision_id,driver,kind,case when kind in ('time_penalty','time_credit') then (amount*1000)::integer*case when kind='time_credit' then -1 else 1 end end,
          case when kind='grid_penalty' then amount::integer end,target_id,left(reason,500));
      end if;
    end loop;
    if race.current_result_version_id is not null then
      insert into public.steward_penalty_applications(penalty_id,result_version_id)
        select id,coalesce(result_id,race.current_result_version_id) from public.steward_penalties where decision_version_id=decision_id and penalty_type in ('time_penalty','time_credit');
    end if;
    update public.steward_cases set status='closed',closed_at=now(),current_decision_version=decision_number,title=btrim(p_title),description=btrim(p_description) where id=v_case_id;
    insert into public.steward_case_events(case_id,event_type,actor_user_id,payload)
      values(v_case_id,'decision_finalized',actor,jsonb_build_object('decision_id',decision_id,'result_version_id',result_id,'driver_count',cardinality(accused),'correction_reason',p_correction_reason,'previous_decision_version',p_expected_decision_version));
    perform private.emit_domain_event('steward.decision_finalized','steward_case',v_case_id,season.league_id,
      jsonb_build_object('case_number',item.case_number,'decision_id',decision_id,'race_id',race.id),
      'steward-case:'||v_case_id::text||':decision:'||decision_number::text,result_id,actor,now());
  end if;
  response:=jsonb_build_object('id',coalesce(decision_id,v_case_id),'case_id',v_case_id,'result_version_id',result_id,'status',case when p_draft then 'under_review' else 'closed' end);
  insert into private.steward_group_receipts values(actor,p_idempotency_key,request,response);
  return response;
end $$;

revoke all on function private.save_steward_group_case_revision(uuid,uuid[],uuid[],text,text,jsonb,boolean,uuid,text,integer,uuid,text) from public,anon,authenticated,service_role;
create or replace function private.save_steward_group_case(p_race_id uuid,p_reporter_ids uuid[],p_accused_ids uuid[],p_title text,p_description text,p_decisions jsonb,p_draft boolean,p_case_id uuid,p_idempotency_key text)
returns jsonb language sql security definer set search_path='' as $$
 select private.save_steward_group_case_revision(p_race_id,p_reporter_ids,p_accused_ids,p_title,p_description,p_decisions,p_draft,p_case_id,p_idempotency_key,null,null,null);
$$;
create function public.correct_steward_group_case(p_race_id uuid,p_reporter_ids uuid[],p_accused_ids uuid[],p_title text,p_description text,p_decisions jsonb,p_case_id uuid,p_idempotency_key text,p_expected_decision_version integer,p_expected_result_version_id uuid,p_correction_reason text)
returns jsonb language sql security definer set search_path='' as $$
 select private.save_steward_group_case_revision(p_race_id,p_reporter_ids,p_accused_ids,p_title,p_description,p_decisions,false,p_case_id,p_idempotency_key,p_expected_decision_version,p_expected_result_version_id,p_correction_reason);
$$;
revoke all on function public.correct_steward_group_case(uuid,uuid[],uuid[],text,text,jsonb,uuid,text,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.correct_steward_group_case(uuid,uuid[],uuid[],text,text,jsonb,uuid,text,integer,uuid,text) to authenticated;
-- All effect consumers must ignore superseded versions, including deletion and deferred publication.
do $$ declare signature text; body text; changed text; begin
 foreach signature in array array['private.delete_steward_case(uuid,text,integer,uuid)','private.preview_result_rows(uuid)','public.get_result_draft_championship_preview(uuid)','public.publish_league_result_draft(uuid)'] loop
  body:=pg_get_functiondef(signature::regprocedure);
  changed:=replace(body,'d.id=p.decision_version_id','d.id=p.decision_version_id and private.steward_decision_is_current(d.id)');
  if changed=body then raise exception 'Steward effect consumer source mismatch: %',signature; end if;
  execute changed;
 end loop;
end $$;
create function public.get_incoming_steward_grid_penalties(p_race_id uuid)
returns table(id uuid,driver_id uuid,grid_positions integer,reason text) language sql stable security invoker set search_path='' as $$
 select p.id,p.driver_id,p.grid_positions,p.reason from public.steward_penalties p
 join public.steward_decision_versions d on d.id=p.decision_version_id join public.steward_cases c on c.id=d.case_id
 where p.target_race_id=p_race_id and p.penalty_type='grid_penalty' and c.deleted_at is null and d.version_number=c.current_decision_version;
$$;
revoke all on function public.get_incoming_steward_grid_penalties(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_incoming_steward_grid_penalties(uuid) to anon,authenticated,service_role;
commit;
