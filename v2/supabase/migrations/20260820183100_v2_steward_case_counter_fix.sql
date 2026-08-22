-- Phase 16 staging correction: disambiguate the case-year variable in the case counter.

create or replace function public.create_steward_case(
  p_race_id uuid,
  p_reported_driver_id uuid,
  p_accused_driver_id uuid,
  p_title text,
  p_description text,
  p_rule_code text,
  p_rule_version text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_league_id uuid;
  target_case public.steward_cases%rowtype;
  sequence_number integer;
  target_case_year integer := extract(year from current_date)::integer;
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;

  select s.league_id into target_league_id
  from public.races r join public.seasons s on s.id = r.season_id
  where r.id = p_race_id;

  if target_league_id is null or not public.matches_requested_league(target_league_id)
     or not private.has_league_capability(target_league_id, 'steward') then
    raise exception using errcode = '42501', message = 'Steward capability required for the requested league.';
  end if;

  if not exists (select 1 from public.drivers d where d.id = p_accused_driver_id and d.league_id = target_league_id)
     or (p_reported_driver_id is not null and not exists (
       select 1 from public.drivers d where d.id = p_reported_driver_id and d.league_id = target_league_id
     )) then
    raise exception using errcode = '23514', message = 'Case drivers must belong to the race league.';
  end if;

  select * into target_case from public.steward_cases
  where created_by = actor_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id', target_case.id, 'case_number', target_case.case_number, 'status', target_case.status);
  end if;

  insert into private.steward_case_counters (league_id, case_year, next_number)
  values (target_league_id, target_case_year, 2)
  on conflict (league_id, case_year) do update
    set next_number = private.steward_case_counters.next_number + 1
  returning next_number - 1 into sequence_number;

  insert into public.steward_cases (
    league_id, race_id, case_number, title, description, reported_driver_id,
    accused_driver_id, rule_code, rule_version, created_by, idempotency_key
  ) values (
    target_league_id, p_race_id,
    format('RV-%s-%s', target_case_year, lpad(sequence_number::text, 4, '0')),
    btrim(p_title), btrim(p_description), p_reported_driver_id,
    p_accused_driver_id, btrim(p_rule_code), btrim(p_rule_version), actor_id, p_idempotency_key
  ) returning * into target_case;

  insert into public.steward_case_events (case_id, event_type, actor_user_id, payload)
  values (target_case.id, 'case_created', actor_id, jsonb_build_object('case_number', target_case.case_number));

  return jsonb_build_object('id', target_case.id, 'case_number', target_case.case_number, 'status', target_case.status);
end;
$$;
