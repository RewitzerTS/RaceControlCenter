-- Explicit publication receipt and unambiguous race variable.
begin;
create or replace function public.publish_league_result_draft(p_result_version_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid:=auth.uid(); target_league_id uuid; v_target_race_id uuid;
  source public.result_versions%rowtype; race public.races%rowtype;
  actual_version uuid; corrections jsonb; penalty_ids uuid[];
begin
  if actor_id is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  select * into source from public.result_versions where id=p_result_version_id;
  select r.* into race from public.races r where r.id=source.race_id for update;
  select s.league_id into target_league_id from public.seasons s where s.id=race.season_id;
  if target_league_id is null or not public.matches_requested_league(target_league_id)
    or not private.has_league_capability(target_league_id,'league_admin') then
    raise exception using errcode='42501',message='Validated league result draft not found or access denied.';
  end if;
  v_target_race_id:=race.id;
  select result_version_id into actual_version from private.steward_publication_receipts where source_version_id=p_result_version_id;
  if actual_version is not null then
    return jsonb_build_object('id',actual_version,'race_id',v_target_race_id,'status','active','source_version_id',p_result_version_id);
  end if;
  if source.status='active' and race.current_result_version_id=source.id then
    return jsonb_build_object('id',source.id,'race_id',v_target_race_id,'status','active','source_version_id',p_result_version_id);
  end if;
  if source.status<>'validated' or source.previous_version_id is distinct from race.current_result_version_id then
    raise exception 'The result draft is no longer current. Reload the result before publishing.';
  end if;
  select jsonb_agg(jsonb_build_object('driver_id',p.driver_id,'delta',p.time_delta_ms) order by d.finalized_at,p.id),array_agg(p.id)
    into corrections,penalty_ids
    from public.steward_penalties p join public.steward_decision_versions d on d.id=p.decision_version_id
    join public.steward_cases c on c.id=d.case_id
    where c.race_id=v_target_race_id and p.penalty_type in ('time_penalty','time_credit')
      and not exists(select 1 from public.steward_penalty_applications a where a.penalty_id=p.id);
  actual_version:=p_result_version_id;
  if corrections is not null then
    actual_version:=private.prepare_steward_time_corrections(p_result_version_id,corrections,'Vorgemerkte Stewardentscheidungen');
    perform private.validate_result_version(actual_version);
  end if;
  perform private.activate_result_version(actual_version);
  if corrections is not null then
    insert into public.steward_penalty_applications(penalty_id,result_version_id) select unnest(penalty_ids),actual_version;
    insert into private.steward_publication_receipts(source_version_id,result_version_id) values(p_result_version_id,actual_version);
  end if;
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata)
    values('league',target_league_id,actor_id,'result.published','result_version',actual_version,
      jsonb_build_object('race_id',v_target_race_id,'source_version_id',p_result_version_id,'steward_penalties',coalesce(cardinality(penalty_ids),0)));
  return jsonb_build_object('id',actual_version,'race_id',v_target_race_id,'status','active','source_version_id',p_result_version_id);
end $$;
commit;
