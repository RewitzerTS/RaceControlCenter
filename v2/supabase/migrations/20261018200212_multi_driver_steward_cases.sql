-- Additive multi-driver cases. No historical cases/results are rewritten.
-- Timestamp matches the Staging migration ledger (MCP application).
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table public.steward_case_participants (
  case_id uuid not null references public.steward_cases(id) on delete restrict,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  role text not null check(role in ('reporter','accused')),
  primary key(case_id,role,driver_id)
);
create index steward_participants_driver_idx on public.steward_case_participants(driver_id);
create table public.steward_driver_decisions (
  decision_version_id uuid not null references public.steward_decision_versions(id) on delete restrict,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  penalty_type text not null check(penalty_type in ('time_penalty','time_credit','grid_penalty','no_action')),
  amount numeric,
  target_race_id uuid references public.races(id) on delete restrict,
  reasoning text not null check(length(btrim(reasoning)) between 10 and 4000),
  primary key(decision_version_id,driver_id),
  check ((penalty_type='no_action' and amount is null and target_race_id is null)
    or (penalty_type in ('time_penalty','time_credit') and amount is not null and amount>0 and amount<=3600 and amount*1000=trunc(amount*1000) and target_race_id is null)
    or (penalty_type='grid_penalty' and amount is not null and amount>=1 and amount<=99 and amount=trunc(amount) and target_race_id is not null))
);
create index steward_driver_decisions_driver_idx on public.steward_driver_decisions(driver_id);
create index steward_driver_decisions_target_idx on public.steward_driver_decisions(target_race_id) where target_race_id is not null;
alter table public.steward_case_participants enable row level security;
alter table public.steward_driver_decisions enable row level security;
revoke all on public.steward_case_participants,public.steward_driver_decisions from public,anon,authenticated,service_role;
grant select on public.steward_case_participants,public.steward_driver_decisions to anon,authenticated,service_role;
create policy "read case participants" on public.steward_case_participants for select to anon,authenticated
using ((select private.can_read_steward_case(case_id)));
create policy "read driver decisions" on public.steward_driver_decisions for select to anon,authenticated
using (exists(select 1 from public.steward_decision_versions d where d.id=decision_version_id and (select private.can_read_steward_case(d.case_id))));
create trigger steward_participants_protect before update or delete on public.steward_case_participants
for each row execute function private.protect_steward_history();
create trigger steward_driver_decisions_protect before update or delete on public.steward_driver_decisions
for each row execute function private.protect_steward_history();

create table private.steward_group_receipts (
  actor_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null,
  request jsonb not null,
  response jsonb not null,
  primary key(actor_id,idempotency_key)
);
alter table private.steward_group_receipts enable row level security;
revoke all on private.steward_group_receipts from public,anon,authenticated,service_role;

create function private.save_steward_group_case(
  p_race_id uuid,p_reporter_ids uuid[],p_accused_ids uuid[],p_title text,p_description text,
  p_decisions jsonb,p_draft boolean,p_case_id uuid,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); race public.races%rowtype; season public.seasons%rowtype; target public.races%rowtype;
  item public.steward_cases%rowtype; receipt private.steward_group_receipts%rowtype;
  reporters uuid[]; accused uuid[]; stored_reporters uuid[]; stored_accused uuid[];
  entry jsonb; driver uuid; kind text; amount numeric; target_id uuid; reason text;
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
      if driver is null or not(driver=any(accused)) or kind is null or kind not in ('time_penalty','time_credit','grid_penalty','no_action')
        or reason is null or length(btrim(reason)) not between 10 and 4000 then raise exception 'Invalid driver decision.'; end if;
      if kind='no_action' then
        if amount is not null or target_id is not null then raise exception 'No action cannot include a penalty amount.'; end if;
      else
        if amount is null or amount<=0 or amount>3600 or amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter a positive penalty amount.'; end if;
        if kind='grid_penalty' then
          if amount<>trunc(amount) or amount>99 then raise exception 'Grid positions must be whole numbers from 1 to 99.'; end if;
          select * into target from public.races r where r.season_id=race.season_id and r.round_number>race.round_number
            and r.status not in ('cancelled','postponed') order by r.round_number limit 1 for update;
          if target.id is null or target.id is distinct from target_id or target.status='completed' or target.current_result_version_id is not null
            or coalesce(target.race_start_at,(target.race_date::text||' '||coalesce(target.race_time,'00:00'))::timestamp at time zone 'Europe/Berlin','-infinity'::timestamptz)<=now() then
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
    if item.id is null or item.race_id<>race.id or item.status<>'under_review' or item.deleted_at is not null then raise exception 'The open case changed. Reload before publishing.'; end if;
    select array_agg(driver_id order by driver_id) into stored_reporters from public.steward_case_participants where case_id=item.id and role='reporter';
    select array_agg(driver_id order by driver_id) into stored_accused from public.steward_case_participants where case_id=item.id and role='accused';
    stored_reporters:=coalesce(stored_reporters,array[item.reported_driver_id]); stored_accused:=coalesce(stored_accused,array[item.accused_driver_id]);
    if reporters is distinct from stored_reporters or accused is distinct from stored_accused or btrim(p_title)<>item.title then raise exception 'The open case does not match the selected drivers.'; end if;
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
      values(v_case_id,1,case when exists(select 1 from jsonb_array_elements(p_decisions) e where e->>'penalty_type'<>'no_action') then 'penalty' else 'no_action' end,
      btrim(p_description),item.rule_code,item.rule_version,actor,result_id,p_idempotency_key) returning id into decision_id;
    for entry in select value from jsonb_array_elements(p_decisions) loop
      driver:=(entry->>'driver_id')::uuid; kind:=entry->>'penalty_type'; amount:=(entry->>'amount')::numeric;
      target_id:=(entry->>'target_race_id')::uuid; reason:=btrim(entry->>'reasoning');
      insert into public.steward_driver_decisions(decision_version_id,driver_id,penalty_type,amount,target_race_id,reasoning)
        values(decision_id,driver,kind,amount,target_id,reason);
      if kind<>'no_action' then
        insert into public.steward_penalties(decision_version_id,driver_id,penalty_type,time_delta_ms,grid_positions,target_race_id,reason)
          values(decision_id,driver,kind,case when kind in ('time_penalty','time_credit') then (amount*1000)::integer*case when kind='time_credit' then -1 else 1 end end,
          case when kind='grid_penalty' then amount::integer end,target_id,left(reason,500));
      end if;
    end loop;
    if result_id is not null then
      insert into public.steward_penalty_applications(penalty_id,result_version_id)
        select id,result_id from public.steward_penalties where decision_version_id=decision_id and penalty_type in ('time_penalty','time_credit');
    end if;
    update public.steward_cases set status='closed',closed_at=now(),current_decision_version=1 where id=v_case_id;
    insert into public.steward_case_events(case_id,event_type,actor_user_id,payload)
      values(v_case_id,'decision_finalized',actor,jsonb_build_object('decision_id',decision_id,'result_version_id',result_id,'driver_count',cardinality(accused)));
    perform private.emit_domain_event('steward.decision_finalized','steward_case',v_case_id,season.league_id,
      jsonb_build_object('case_number',item.case_number,'decision_id',decision_id,'race_id',race.id),
      'steward-case:'||v_case_id::text||':decision:1',result_id,actor,now());
  end if;
  response:=jsonb_build_object('id',coalesce(decision_id,v_case_id),'case_id',v_case_id,'result_version_id',result_id,'status',case when p_draft then 'under_review' else 'closed' end);
  insert into private.steward_group_receipts values(actor,p_idempotency_key,request,response);
  return response;
end $$;
revoke all on function private.save_steward_group_case(uuid,uuid[],uuid[],text,text,jsonb,boolean,uuid,text) from public,anon,authenticated,service_role;
create function public.save_steward_group_case(p_race_id uuid,p_reporter_ids uuid[],p_accused_ids uuid[],p_title text,p_description text,p_decisions jsonb,p_draft boolean,p_case_id uuid,p_idempotency_key text)
returns jsonb language sql security definer set search_path='' as $$
  select private.save_steward_group_case(p_race_id,p_reporter_ids,p_accused_ids,p_title,p_description,p_decisions,p_draft,p_case_id,p_idempotency_key);
$$;
revoke all on function public.save_steward_group_case(uuid,uuid[],uuid[],text,text,jsonb,boolean,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.save_steward_group_case(uuid,uuid[],uuid[],text,text,jsonb,boolean,uuid,text) to authenticated;

-- Extend existing visibility, appeals and notifications without changing legacy cases.
do $$ declare body text; changed text; signature text; needle text; replacement text; begin
  foreach signature in array array['private.can_read_steward_case(uuid)','public.submit_steward_appeal(uuid,text,text)','private.process_notification_event(uuid,text)'] loop
    body:=pg_get_functiondef(signature::regprocedure);
    if signature like 'private.can_read%' then
      needle:='dil.driver_id in (sc.reported_driver_id, sc.accused_driver_id)';
      replacement:='(dil.driver_id in (sc.reported_driver_id, sc.accused_driver_id) or exists(select 1 from public.steward_case_participants cp where cp.case_id=sc.id and cp.driver_id=dil.driver_id))';
    else
      needle:=case when signature like 'public.submit%' then 'dil.driver_id in (target_case.reported_driver_id, target_case.accused_driver_id)' else 'dil.driver_id in (target_case.accused_driver_id, target_case.reported_driver_id)' end;
      replacement:='(dil.driver_id in (target_case.reported_driver_id, target_case.accused_driver_id) or exists(select 1 from public.steward_case_participants cp where cp.case_id=target_case.id and cp.driver_id=dil.driver_id))';
    end if;
    changed:=replace(body,needle,replacement);
    if changed=body then raise exception 'Multi-driver participant source guard mismatch: %',signature; end if;
    execute changed;
  end loop;
  -- Old clients must not accidentally close a new group case for only one driver.
  foreach signature in array array['private.record_simple_steward_decision(uuid,uuid,uuid,text,text,text,numeric,uuid,uuid,text)','public.finalize_steward_decision(uuid,text,text,text,text,jsonb,text)'] loop
    body:=pg_get_functiondef(signature::regprocedure);
    needle:='begin';
    replacement:='begin
      if auth.uid() is not null and exists(select 1 from public.steward_case_participants cp join public.steward_cases c on c.id=cp.case_id
        where cp.case_id=p_case_id and public.matches_requested_league(c.league_id) and private.has_league_capability(c.league_id,''steward'')) then
        raise exception ''Use the multi-driver case workflow.'';
      end if;';
    -- Only the first BEGIN belongs to the function; insert rather than replacing nested blocks.
    if strpos(body,needle)=0 then raise exception 'Legacy workflow source guard mismatch'; end if;
    changed:=overlay(body placing replacement from strpos(body,needle) for length(needle));
    execute changed;
  end loop;
end $$;
commit;
