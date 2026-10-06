-- Simplified external-review workflow. Historical decisions/votes remain immutable.
begin;
alter table public.steward_decision_versions alter column result_version_id drop not null;
alter table public.steward_penalties
  add column grid_positions integer,
  add column target_race_id uuid references public.races(id) on delete restrict;
create index steward_penalties_target_race_idx on public.steward_penalties(target_race_id) where target_race_id is not null;
alter table public.steward_penalties drop constraint steward_penalties_type_check;
alter table public.steward_penalties drop constraint steward_penalties_payload_check;
alter table public.steward_penalties add constraint steward_penalties_type_check
  check (penalty_type in ('warning','time_penalty','time_credit','grid_penalty','points_penalty','disqualification'));
alter table public.steward_penalties add constraint steward_penalties_payload_check check (
  (penalty_type in ('warning','disqualification') and time_delta_ms is null and points_delta is null and grid_positions is null and target_race_id is null)
  or (penalty_type = 'time_penalty' and time_delta_ms is not null and time_delta_ms > 0 and points_delta is null and grid_positions is null and target_race_id is null)
  or (penalty_type = 'time_credit' and time_delta_ms is not null and time_delta_ms < 0 and points_delta is null and grid_positions is null and target_race_id is null)
  or (penalty_type = 'points_penalty' and points_delta is not null and points_delta < 0 and time_delta_ms is null and grid_positions is null and target_race_id is null)
  or (penalty_type = 'grid_penalty' and grid_positions is not null and grid_positions between 1 and 99 and target_race_id is not null and time_delta_ms is null and points_delta is null)
);

-- Strict duration parser: no guessing of OCR mistakes, laps, DNF or empty cells.
create or replace function private.steward_duration_ms(p_text text) returns bigint
language plpgsql immutable set search_path='' as $$
declare parts text[]; value text := replace(btrim(p_text),',','.'); seconds numeric;
begin
  if value is null or value !~ '^\d+(:[0-5]?\d){0,2}(\.\d{1,3})?$' then return null; end if;
  parts := string_to_array(value,':');
  if cardinality(parts)=3 then seconds:=parts[1]::numeric*3600+parts[2]::numeric*60+parts[3]::numeric;
  elsif cardinality(parts)=2 then seconds:=parts[1]::numeric*60+parts[2]::numeric;
  else seconds:=parts[1]::numeric; end if;
  return round(seconds*1000)::bigint;
end $$;
revoke all on function private.steward_duration_ms(text) from public,anon,authenticated;

create or replace function private.record_simple_steward_decision(
  p_race_id uuid,p_reported_driver_id uuid,p_accused_driver_id uuid,
  p_title text,p_reasoning text,p_penalty_type text,p_amount numeric,
  p_target_race_id uuid,p_case_id uuid,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); race public.races%rowtype; season public.seasons%rowtype;
  target public.races%rowtype; item public.steward_cases%rowtype;
  decision public.steward_decision_versions%rowtype;
  v_case_id uuid; result_id uuid; decision_id uuid; delta integer;
  winner_time bigint; point_scale jsonb; fastest_id uuid;
  old_row record; duration bigint; old_bonus numeric; new_bonus numeric;
  old_base numeric; new_base numeric; points_adjustment numeric;
begin
  if actor is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  select * into race from public.races where id=p_race_id for update;
  select * into season from public.seasons where id=race.season_id;
  if race.id is null or not public.matches_requested_league(season.league_id)
    or not private.has_league_capability(season.league_id,'steward') then
    raise exception using errcode='42501',message='Steward access required.';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 160 then
    raise exception 'Invalid idempotency key.';
  end if;
  -- Serialize retries, including simultaneous identical requests for different races.
  perform pg_advisory_xact_lock(hashtextextended(actor::text||p_idempotency_key,0));
  select * into decision from public.steward_decision_versions where finalized_by=actor and idempotency_key=p_idempotency_key;
  if found then
    if not exists(select 1 from public.steward_cases c where c.id=decision.case_id and c.race_id=p_race_id
      and c.accused_driver_id=p_accused_driver_id and c.reported_driver_id=p_reported_driver_id) then
      raise exception 'Idempotency key belongs to another decision.';
    end if;
    return jsonb_build_object('id',decision.id,'case_id',decision.case_id,'result_version_id',decision.result_version_id);
  end if;
  if p_penalty_type is null or p_penalty_type not in ('no_action','time_penalty','time_credit','grid_penalty')
    or p_reasoning is null or length(btrim(p_reasoning)) not between 10 and 4000
    or p_title is null or length(btrim(p_title)) not between 4 and 140 then
    raise exception 'Please provide a title, decision and reasoning.';
  end if;
  if p_reported_driver_id is null or p_reported_driver_id=p_accused_driver_id
    or (select count(*) from public.drivers where league_id=season.league_id and id in(p_reported_driver_id,p_accused_driver_id))<>2 then
    raise exception 'Select two different drivers from this league.';
  end if;
  if race.status in ('cancelled','postponed') or
    (race.current_result_version_id is null and race.status<>'completed' and
      coalesce(race.race_start_at,(race.race_date::text||' '||coalesce(race.race_time,'00:00'))::timestamp at time zone 'Europe/Berlin','infinity'::timestamptz)>now()) then
    raise exception 'Select a race that has already taken place.';
  end if;
  if p_penalty_type<>'no_action' and (p_amount is null or p_amount<=0 or p_amount>3600 or p_amount::text='NaN') then
    raise exception 'Enter a positive penalty amount.';
  end if;
  if p_penalty_type='grid_penalty' then
    if p_amount<>trunc(p_amount) or p_amount>99 then raise exception 'Grid positions must be whole numbers from 1 to 99.'; end if;
    select * into target from public.races r where r.season_id=race.season_id and r.round_number>race.round_number
      and r.status not in ('cancelled','postponed') order by r.round_number limit 1 for update;
    if target.id is null or target.id is distinct from p_target_race_id or target.status='completed'
      or target.current_result_version_id is not null or
      coalesce(target.race_start_at,(target.race_date::text||' '||coalesce(target.race_time,'00:00'))::timestamp at time zone 'Europe/Berlin','-infinity'::timestamptz)<=now() then
      raise exception 'The next scheduled race is unavailable or has already started.';
    end if;
  elsif p_target_race_id is not null then raise exception 'Only grid penalties may have a target race.';
  end if;
  if p_case_id is not null then
    select * into item from public.steward_cases where id=p_case_id for update;
    if item.id is null or item.status<>'under_review' or item.race_id<>p_race_id
      or item.accused_driver_id<>p_accused_driver_id or item.reported_driver_id is distinct from p_reported_driver_id then
      raise exception 'The open case does not match the selected race and drivers.';
    end if;
    -- Preserve previously disclosed conflicts, even though voting is no longer required.
    if exists(select 1 from public.steward_votes v where v.case_id=p_case_id and v.steward_user_id=actor
      and v.conflict_disclosed and v.vote_version=(select max(v2.vote_version) from public.steward_votes v2 where v2.case_id=p_case_id and v2.steward_user_id=actor)) then
      raise exception 'A steward with a disclosed conflict cannot finalize this case.';
    end if;
    v_case_id:=p_case_id;
  else
    v_case_id:=(public.create_steward_case(p_race_id,p_reported_driver_id,p_accused_driver_id,p_title,p_reasoning,
      'Stewardentscheidung','1',p_idempotency_key)->>'id')::uuid;
    select * into item from public.steward_cases where id=v_case_id;
  end if;

  if p_penalty_type in ('time_penalty','time_credit') then
    if race.current_result_version_id is null then raise exception 'Publish the race result before applying a time correction.'; end if;
    if p_amount*1000<>trunc(p_amount*1000) then raise exception 'Use at most three decimal places for seconds.'; end if;
    delta:=(p_amount*1000)::integer * case when p_penalty_type='time_credit' then -1 else 1 end;
    result_id:=private.create_result_version(p_race_id,'Steward decision '||item.case_number,race.current_result_version_id,null);
    insert into public.result_version_rows(result_version_id,row_order,driver_id,team_id,source_assignment_id,car_name_snapshot,
      ai_driver_reference_snapshot,grid_position,finish_position,race_time_ms,fastest_lap_time_ms,pit_stops,participation_status,
      classification_status,base_points,penalty_time_delta_ms,awarded_points,notes,fastest_lap_time,race_time,points_owner_driver_id,
      points_team_name,points_car_name,points,fastest_lap_ms)
    select result_id,row_order,driver_id,team_id,source_assignment_id,car_name_snapshot,ai_driver_reference_snapshot,grid_position,
      finish_position,race_time_ms,fastest_lap_time_ms,pit_stops,participation_status,classification_status,base_points,
      penalty_time_delta_ms,awarded_points,notes,fastest_lap_time,race_time,points_owner_driver_id,points_team_name,points_car_name,points,fastest_lap_ms
    from public.result_version_rows where result_version_id=race.current_result_version_id;
    select coalesce(race_time_ms,private.steward_duration_ms(race_time)) into winner_time
      from public.result_version_rows where result_version_id=result_id and finish_position=1;
    -- Imported results commonly store the winner's total and everyone else's +gap.
    update public.result_version_rows set race_time_ms=case when btrim(race_time) like '+%'
      then winner_time+private.steward_duration_ms(substr(btrim(race_time),2)) else private.steward_duration_ms(race_time) end
      where result_version_id=result_id and race_time_ms is null;
    if not exists(select 1 from public.result_version_rows where result_version_id=result_id and driver_id=p_accused_driver_id
      and classification_status='classified' and race_time_ms is not null and finish_position is not null
      and coalesce(race_time,'') !~* '(lap|runde|dnf|dns|dsq)') then
      raise exception 'The affected driver needs a classified result with a valid race time.';
    end if;
    if exists(select 1 from public.result_version_rows where result_version_id=result_id and classification_status='classified'
      and coalesce(race_time,'') !~* '(lap|runde|dnf|dns|dsq)' and (race_time_ms is null or finish_position is null)) then
      raise exception 'Complete the race times before applying a time correction.';
    end if;
    update public.result_version_rows set penalty_time_delta_ms=penalty_time_delta_ms+delta,
      notes=concat_ws(E'\n',nullif(notes,''),item.case_number||': '||(delta/1000.0)::text||' s')
      where result_version_id=result_id and driver_id=p_accused_driver_id;
    if exists(select 1 from public.result_version_rows where result_version_id=result_id and race_time_ms+penalty_time_delta_ms<0) then
      raise exception 'A time credit cannot make the race time negative.';
    end if;
    -- Keep lapped/retired rows in their existing slots; never treat a lap deficit as seconds.
    with timed as (
      select id,finish_position,row_order,race_time_ms+penalty_time_delta_ms effective
      from public.result_version_rows where result_version_id=result_id and classification_status='classified'
        and race_time_ms is not null and coalesce(race_time,'') !~* '(lap|runde|dnf|dns|dsq)'
    ), slots as (select finish_position,row_number() over(order by finish_position) n from timed),
    ranked as (select id,row_number() over(order by effective,finish_position,row_order) n from timed)
    update public.result_version_rows r set finish_position=s.finish_position from ranked t join slots s using(n) where r.id=t.id;
    select coalesce(nullif(l.settings#>'{scoring,points}','[]'::jsonb),'[25,18,15,12,10,8,6,4,2,1]'::jsonb)
      into point_scale from public.leagues l where l.id=season.league_id;
    select driver_id into fastest_id from public.result_version_rows where result_version_id=race.current_result_version_id
      and coalesce(fastest_lap_time_ms,fastest_lap_ms,private.steward_duration_ms(fastest_lap_time))>0
      order by coalesce(fastest_lap_time_ms,fastest_lap_ms,private.steward_duration_ms(fastest_lap_time)),finish_position nulls last,row_order limit 1;
    for old_row in select a.*,b.finish_position new_position from public.result_version_rows a
      join public.result_version_rows b on b.result_version_id=result_id and b.driver_id=a.driver_id
      where a.result_version_id=race.current_result_version_id and a.classification_status='classified'
        and coalesce(a.race_time,'') !~* '(dnf|dns|dsq)'
    loop
      old_base:=coalesce((point_scale->>(old_row.finish_position-1))::numeric,0);
      new_base:=coalesce((point_scale->>(old_row.new_position-1))::numeric,0);
      old_bonus:=case when season.fastest_lap_bonus_enabled and old_row.driver_id=fastest_id and old_row.finish_position<=season.fastest_lap_bonus_max_finish_position then season.fastest_lap_bonus_points else 0 end;
      new_bonus:=case when season.fastest_lap_bonus_enabled and old_row.driver_id=fastest_id and old_row.new_position<=season.fastest_lap_bonus_max_finish_position then season.fastest_lap_bonus_points else 0 end;
      -- Preserve existing manual point adjustments rather than erasing them.
      points_adjustment:=old_row.awarded_points-old_base-old_bonus;
      update public.result_version_rows set base_points=new_base,awarded_points=greatest(0,new_base+new_bonus+points_adjustment),
        points=greatest(0,new_base+new_bonus+points_adjustment) where result_version_id=result_id and driver_id=old_row.driver_id;
    end loop;
    -- Display corrected totals; retain unmodified numeric base plus signed delta for future corrections.
    update public.result_version_rows set race_time=
      ((race_time_ms+penalty_time_delta_ms)/3600000)::text||':'||
      lpad((((race_time_ms+penalty_time_delta_ms)/60000)%60)::text,2,'0')||':'||
      lpad((((race_time_ms+penalty_time_delta_ms)/1000)%60)::text,2,'0')||'.'||
      lpad(((race_time_ms+penalty_time_delta_ms)%1000)::text,3,'0')
      where result_version_id=result_id and race_time_ms is not null and coalesce(race_time,'') !~* '(lap|runde|dnf|dns|dsq)';
    perform private.validate_result_version(result_id);
    perform private.activate_result_version(result_id);
  end if;
  insert into public.steward_decision_versions(case_id,version_number,outcome,reasoning,rule_code,rule_version,finalized_by,result_version_id,idempotency_key)
    values(v_case_id,1,case when p_penalty_type='no_action' then 'no_action' else 'penalty' end,btrim(p_reasoning),item.rule_code,item.rule_version,actor,result_id,p_idempotency_key)
    returning id into decision_id;
  if p_penalty_type<>'no_action' then
    insert into public.steward_penalties(decision_version_id,driver_id,penalty_type,time_delta_ms,grid_positions,target_race_id,reason)
      values(decision_id,p_accused_driver_id,p_penalty_type,delta,case when p_penalty_type='grid_penalty' then p_amount::integer end,p_target_race_id,left(btrim(p_reasoning),500));
  end if;
  update public.steward_cases set status='closed',closed_at=now(),current_decision_version=1 where id=v_case_id;
  insert into public.steward_case_events(case_id,event_type,actor_user_id,payload)
    values(v_case_id,'decision_finalized',actor,jsonb_build_object('decision_id',decision_id,'result_version_id',result_id,'target_race_id',p_target_race_id));
  perform private.emit_domain_event('steward.decision_finalized','steward_case',v_case_id,season.league_id,
    jsonb_build_object('case_number',item.case_number,'decision_id',decision_id,'race_id',p_race_id),
    'steward-case:'||v_case_id::text||':decision:1',result_id,actor,now());
  return jsonb_build_object('id',decision_id,'case_id',v_case_id,'result_version_id',result_id);
end $$;
revoke all on function private.record_simple_steward_decision(uuid,uuid,uuid,text,text,text,numeric,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.record_simple_steward_decision(uuid,uuid,uuid,text,text,text,numeric,uuid,uuid,text) to authenticated;
create or replace function public.record_steward_decision(p_race_id uuid,p_reported_driver_id uuid,p_accused_driver_id uuid,
  p_title text,p_reasoning text,p_penalty_type text,p_amount numeric,p_target_race_id uuid,p_case_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$
  select private.record_simple_steward_decision(p_race_id,p_reported_driver_id,p_accused_driver_id,p_title,p_reasoning,p_penalty_type,p_amount,p_target_race_id,p_case_id,p_idempotency_key);
$$;
revoke all on function public.record_steward_decision(uuid,uuid,uuid,text,text,text,numeric,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.record_steward_decision(uuid,uuid,uuid,text,text,text,numeric,uuid,uuid,text) to authenticated;
comment on function public.record_steward_decision(uuid,uuid,uuid,text,text,text,numeric,uuid,uuid,text) is
  'Human-confirmed external steward decision. Atomic, tenant-bound, idempotent. No voting prerequisite; old history is retained.';
-- Grid-only / no-action decisions do not create artificial result versions.
-- Keep the installed notification implementation, changing only its null-safe join.
do $$
declare definition text;
begin
  select pg_get_functiondef('private.process_notification_event(uuid,text)'::regprocedure) into definition;
  if strpos(definition,'sdv.result_version_id = event_record.result_version_id')=0 then
    raise exception 'Notification implementation changed; review its decision lookup before migrating.';
  end if;
  execute replace(definition,'sdv.result_version_id = event_record.result_version_id',
    'sdv.result_version_id is not distinct from event_record.result_version_id');
end $$;
commit;
