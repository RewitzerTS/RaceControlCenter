-- More varied weekly tasks. Preserve the running cycle and all earned history.
select pg_advisory_xact_lock(hashtextextended('racevora-active-challenge-limit', 0));

alter table public.challenge_definitions drop constraint challenge_definitions_metric_check;
alter table public.challenge_definitions add constraint challenge_definitions_metric_check check (
  metric in ('starts','classified_finishes','wins','podiums','poles','fastest_laps',
    'top_ten','top_five','positions_gained','gain_three','comeback_top_ten','hold_position')
);

-- Existing six metrics deliberately retain their historic semantics.
create or replace function private.challenge_contribution(
  p_metric text, p_classification_status text, p_finish_position integer,
  p_grid_position integer, p_is_fastest_lap boolean
) returns integer language sql immutable parallel safe set search_path = ''
as $$
  select case p_metric
    when 'starts' then case when p_classification_status <> 'dns' then 1 else 0 end
    when 'classified_finishes' then case when p_classification_status = 'classified' then 1 else 0 end
    when 'wins' then case when p_classification_status = 'classified' and p_finish_position = 1 then 1 else 0 end
    when 'podiums' then case when p_classification_status = 'classified' and p_finish_position between 1 and 3 then 1 else 0 end
    when 'poles' then case when p_grid_position = 1 then 1 else 0 end
    when 'fastest_laps' then case when p_is_fastest_lap then 1 else 0 end
    when 'top_ten' then case when p_classification_status = 'classified' and p_finish_position between 1 and 10 then 1 else 0 end
    when 'top_five' then case when p_classification_status = 'classified' and p_finish_position between 1 and 5 then 1 else 0 end
    when 'positions_gained' then case when p_classification_status = 'classified' and p_finish_position > 0 and p_grid_position > 0
      then greatest(p_grid_position - p_finish_position, 0) else 0 end
    when 'gain_three' then case when p_classification_status = 'classified' and p_finish_position > 0
      and p_grid_position - p_finish_position >= 3 then 1 else 0 end
    when 'comeback_top_ten' then case when p_classification_status = 'classified'
      and p_grid_position > 10 and p_finish_position between 1 and 10 then 1 else 0 end
    when 'hold_position' then case when p_classification_status = 'classified' and p_finish_position > 0
      and p_grid_position > 0 and p_finish_position <= p_grid_position then 1 else 0 end
    else 0
  end;
$$;
revoke all on function private.challenge_contribution(text,text,integer,integer,boolean)
  from public, anon, authenticated, service_role;

-- Eight weekly sets, twelve metrics. Adjacent weeks share no metric, including wraparound.
create function private.weekly_challenge_plan(p_week bigint)
returns table(slot integer, metric text, target integer, reward integer)
language sql immutable parallel safe set search_path = ''
as $$
  select tasks.slot, tasks.metric, tasks.target, tasks.reward
  from (values
    (0,1,'starts',1,100),(0,2,'top_ten',1,150),(0,3,'podiums',1,250),
    (1,1,'classified_finishes',1,100),(1,2,'positions_gained',3,150),(1,3,'fastest_laps',1,250),
    (2,1,'hold_position',1,100),(2,2,'top_five',1,150),(2,3,'poles',1,250),
    (3,1,'gain_three',1,100),(3,2,'comeback_top_ten',1,150),(3,3,'wins',1,250),
    (4,1,'starts',2,100),(4,2,'top_ten',2,150),(4,3,'podiums',1,250),
    (5,1,'classified_finishes',2,100),(5,2,'positions_gained',5,150),(5,3,'fastest_laps',1,250),
    (6,1,'hold_position',2,100),(6,2,'top_five',2,150),(6,3,'poles',1,250),
    (7,1,'gain_three',2,100),(7,2,'comeback_top_ten',1,150),(7,3,'wins',1,250)
  ) tasks(week,slot,metric,target,reward)
  where tasks.week = ((p_week % 8 + 8) % 8)::integer
  order by tasks.slot;
$$;
revoke all on function private.weekly_challenge_plan(bigint) from public, anon, authenticated, service_role;

alter table private.challenge_rotation_state
  add column variety_start_cycle bigint,
  add column variety_offset integer;

do $$
declare first_cycle bigint; chosen_offset integer;
begin
  select greatest(0, floor(extract(epoch from (now()-anchor_at))/604800)::bigint)+1
    into first_cycle from private.challenge_rotation_state where singleton;
  -- Pick a disjoint first set relative to the actual running legacy week.
  select candidate into chosen_offset from generate_series(0,3) candidate
  order by (select count(*) from private.weekly_challenge_plan(candidate) plan
    join public.challenge_definitions cd on cd.metric=plan.metric
    where cd.is_active and cd.active_from<=now() and cd.active_until>now()), candidate
  limit 1;
  update private.challenge_rotation_state set variety_start_cycle=first_cycle, variety_offset=chosen_offset;
  if exists (select 1 from public.challenge_definitions cd
    where cd.rule_version=2 and cd.is_active and cd.active_from>now()
      and (exists(select 1 from public.challenge_races cr where cr.challenge_code=cd.code)
        or exists(select 1 from public.driver_challenges dc where dc.challenge_code=cd.code)
        or exists(select 1 from public.driver_challenge_events ce where ce.challenge_code=cd.code))) then
    raise exception 'Future challenges unexpectedly have history; refusing to replace them.';
  end if;
  -- Keep the old definitions for auditing; replace only future, unused weekly tasks.
  update public.challenge_definitions set is_active=false
    where rule_version=2 and is_active and active_from>now();
end;
$$;
alter table private.challenge_rotation_state
  alter column variety_start_cycle set not null,
  alter column variety_offset set not null,
  add constraint challenge_variety_offset_check check(variety_offset between 0 and 3);

create or replace function private.maintain_weekly_challenges()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  anchor timestamptz; cycle bigint; first_cycle bigint; cutoff bigint; plan_offset integer;
  starts_at timestamptz; ordering integer; task record; pending record; task_code text;
begin
  perform pg_advisory_xact_lock(hashtextextended('racevora-active-challenge-limit', 0));
  select anchor_at,variety_start_cycle,variety_offset into strict anchor,cutoff,plan_offset
    from private.challenge_rotation_state where singleton;
  first_cycle := greatest(0, floor(extract(epoch from (now() - anchor)) / 604800)::bigint);
  for cycle in first_cycle..first_cycle + 2 loop
    starts_at := anchor + cycle * interval '7 days';
    for task in
      select metric,target,reward from private.weekly_challenge_plan(cycle-cutoff+plan_offset)
      where cycle>=cutoff
      union all
      select * from (values
        ('starts'::text,1,100),('classified_finishes'::text,1,150),
        ((array['podiums','fastest_laps','poles','wins'])[1+(cycle%4)::integer],1,250)
      ) legacy(metric,target,reward) where cycle<cutoff
    loop
      task_code := case when cycle>=cutoff then format('weekly_variety_%s_%s',cycle,task.metric)
                        else format('weekly_%s_%s',cycle,task.metric) end;
      if not exists(select 1 from public.challenge_definitions where code=task_code) then
        select coalesce(max(sort_order),0)+1 into ordering from public.challenge_definitions;
        insert into public.challenge_definitions(
          code,metric,target_value,title_key,description_key,reward_vc,
          rule_version,active_from,active_until,is_active,sort_order
        ) values (
          task_code,task.metric,task.target,'challenge.metric.title','challenge.metric.description',
          task.reward,2,starts_at,starts_at+interval '7 days',true,ordering
        );
      end if;
    end loop;
  end loop;
  -- Retain the tested expiry settlement and correction path, including idempotency.
  for pending in
    select dc.driver_identity_id,dc.challenge_code
    from public.driver_challenges dc
    join public.challenge_definitions cd on cd.code=dc.challenge_code
    where cd.rule_version=2 and cd.active_until<=now()
      and dc.status='completed' and dc.reward_eligible
      and not exists(select 1 from public.credit_ledger cl
        where cl.idempotency_key=format('credit:challenge-event:%s',dc.last_event_id))
    order by dc.driver_identity_id,dc.challenge_code
    for update of dc skip locked
  loop
    perform private.settle_weekly_challenge(pending.driver_identity_id,pending.challenge_code);
  end loop;
end;
$$;
revoke all on function private.maintain_weekly_challenges() from public, anon, authenticated, service_role;
select private.maintain_weekly_challenges();

