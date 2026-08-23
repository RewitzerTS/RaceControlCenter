-- RaceVora V2: complete remaining V1 admin workflows.
-- Additive, tenant-bound and revision-safe. Never apply to the archived V1 project.

create or replace function public.get_league_configuration_workspace()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); target_league public.leagues%rowtype;
begin
  if actor_id is null then raise exception using errcode='42501', message='Authentication required.'; end if;
  select l.* into target_league from public.leagues l where l.slug=public.requested_league_slug();
  if target_league.id is null or not private.has_league_capability(target_league.id,'league_admin') then
    raise exception using errcode='42501', message='League configuration access denied.';
  end if;
  return jsonb_build_object(
    'league', jsonb_build_object('id',target_league.id,'name',target_league.name,'slug',target_league.slug),
    'rules', coalesce(target_league.settings->'rules','{}'::jsonb),
    'faqs', coalesce(target_league.settings->'faqs','[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'entity_type',a.entity_type,'entity_id',a.entity_id,'metadata',a.metadata,'occurred_at',a.occurred_at) order by a.occurred_at desc) from (select * from public.v2_audit_events where league_id=target_league.id order by occurred_at desc limit 100) a),'[]'::jsonb),
    'result_drafts', coalesce((select jsonb_agg(jsonb_build_object('id',rv.id,'race_id',rv.race_id,'race_name',r.grand_prix_name,'version_number',rv.version_number,'status',rv.status,'change_reason',rv.change_reason,'created_at',rv.created_at,'row_count',(select count(*) from public.result_version_rows x where x.result_version_id=rv.id)) order by rv.created_at desc) from public.result_versions rv join public.races r on r.id=rv.race_id join public.seasons s on s.id=r.season_id where s.league_id=target_league.id and rv.status in ('draft','validated')),'[]'::jsonb)
  );
end $$;

create or replace function public.update_league_rules(p_rules jsonb, p_faqs jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); target_league public.leagues%rowtype; clean_rules jsonb:=coalesce(p_rules,'{}'::jsonb); clean_faqs jsonb:=coalesce(p_faqs,'[]'::jsonb);
begin
  if actor_id is null then raise exception using errcode='42501', message='Authentication required.'; end if;
  select l.* into target_league from public.leagues l where l.slug=public.requested_league_slug();
  if target_league.id is null or not private.has_league_capability(target_league.id,'league_admin') then raise exception using errcode='42501', message='League rules access denied.'; end if;
  if jsonb_typeof(clean_rules)<>'object' or jsonb_typeof(clean_faqs)<>'array' or jsonb_array_length(clean_faqs)>40 or pg_column_size(clean_rules)+pg_column_size(clean_faqs)>65536 then raise exception using errcode='22023', message='Rules or FAQ payload is invalid.'; end if;
  if exists(select 1 from jsonb_array_elements(clean_faqs) f where jsonb_typeof(f)<>'object' or char_length(btrim(coalesce(f->>'question',''))) not between 3 and 200 or char_length(btrim(coalesce(f->>'answer',''))) not between 3 and 2000) then raise exception using errcode='22023', message='Every FAQ needs a valid question and answer.'; end if;
  update public.leagues set settings=jsonb_set(jsonb_set(settings,'{rules}',clean_rules,true),'{faqs}',clean_faqs,true) where id=target_league.id;
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata) values('league',target_league.id,actor_id,'league.rules.updated','league',target_league.id,jsonb_build_object('faq_count',jsonb_array_length(clean_faqs)));
  return jsonb_build_object('rules',clean_rules,'faqs',clean_faqs);
end $$;

create or replace function public.rename_league_team(p_current_name text,p_new_name text,p_car_name text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); target_league public.leagues%rowtype; current_name text:=btrim(coalesce(p_current_name,'')); new_name text:=btrim(coalesce(p_new_name,'')); clean_car text:=nullif(btrim(coalesce(p_car_name,'')),''); changed integer;
begin
  if actor_id is null then raise exception using errcode='42501', message='Authentication required.'; end if;
  select l.* into target_league from public.leagues l where l.slug=public.requested_league_slug();
  if target_league.id is null or not private.has_league_capability(target_league.id,'league_admin') then raise exception using errcode='42501', message='League team access denied.'; end if;
  if char_length(current_name) not between 1 and 80 or char_length(new_name) not between 2 and 80 or current_name~'[<>]' or new_name~'[<>]' or coalesce(char_length(clean_car),0)>80 then raise exception using errcode='22023', message='Team or car name is invalid.'; end if;
  update public.drivers set league_team=new_name, car_name=coalesce(clean_car,car_name) where league_id=target_league.id and lower(btrim(coalesce(league_team,'')))=lower(current_name);
  get diagnostics changed=row_count;
  if changed=0 then raise exception using errcode='P0002', message='Team not found in this league.'; end if;
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata) values('league',target_league.id,actor_id,'team.updated','team',null,jsonb_build_object('from',current_name,'to',new_name,'car_name',clean_car,'drivers',changed));
  return jsonb_build_object('team_name',new_name,'car_name',clean_car,'drivers_updated',changed);
end $$;

create or replace function public.create_league_result_draft(p_race_id uuid,p_rows jsonb,p_change_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); target_league_id uuid; current_version_id uuid; new_version_id uuid; clean_reason text:=btrim(coalesce(p_change_reason,'')); row_item jsonb; row_no integer:=0; target_driver public.drivers%rowtype; finish_value integer; points_value numeric;
begin
  if actor_id is null then raise exception using errcode='42501', message='Authentication required.'; end if;
  select s.league_id,r.current_result_version_id into target_league_id,current_version_id from public.races r join public.seasons s on s.id=r.season_id join public.leagues l on l.id=s.league_id where r.id=p_race_id and l.slug=public.requested_league_slug();
  if target_league_id is null or not private.has_league_capability(target_league_id,'league_admin') then raise exception using errcode='42501', message='League result access denied.'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 40 or char_length(clean_reason) not between 3 and 500 then raise exception using errcode='22023', message='Result rows or change reason are invalid.'; end if;
  new_version_id:=private.create_result_version(p_race_id,clean_reason,current_version_id,null);
  for row_item in select value from jsonb_array_elements(p_rows) loop
    row_no:=row_no+1;
    select d.* into target_driver from public.drivers d where d.league_id=target_league_id and (d.id::text=nullif(row_item->>'driver_id','') or lower(d.display_name)=lower(btrim(coalesce(row_item->>'driver_name',''))) or lower(coalesce(d.gamertag,''))=lower(btrim(coalesce(row_item->>'driver_name','')))) limit 1;
    if target_driver.id is null then raise exception using errcode='P0002', message=format('Unknown driver in row %s.',row_no); end if;
    begin finish_value:=nullif(row_item->>'finish_position','')::integer; points_value:=coalesce(nullif(row_item->>'points','')::numeric,0); exception when invalid_text_representation then raise exception using errcode='22023', message=format('Invalid position or points in row %s.',row_no); end;
    if finish_value is not null and finish_value not between 1 and 99 then raise exception using errcode='22023', message=format('Invalid finish position in row %s.',row_no); end if;
    insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,grid_position,participation_status,awarded_points,base_points,points,points_team_name,points_car_name,car_name_snapshot)
    values(new_version_id,row_no,target_driver.id,finish_value,nullif(row_item->>'grid_position','')::integer,'PLAYER',points_value,points_value,points_value,coalesce(nullif(row_item->>'team_name',''),target_driver.league_team),coalesce(nullif(row_item->>'car_name',''),target_driver.car_name),target_driver.car_name);
  end loop;
  perform private.validate_result_version(new_version_id);
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata) values('league',target_league_id,actor_id,'result.draft_created','result_version',new_version_id,jsonb_build_object('race_id',p_race_id,'rows',row_no,'base_version_id',current_version_id));
  return jsonb_build_object('id',new_version_id,'status','validated','rows',row_no);
exception when unique_violation then raise exception using errcode='23505', message='A driver or finish row occurs more than once.';
end $$;

create or replace function public.publish_league_result_draft(p_result_version_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); target_league_id uuid; target_race_id uuid;
begin
  if actor_id is null then raise exception using errcode='42501', message='Authentication required.'; end if;
  select s.league_id,rv.race_id into target_league_id,target_race_id from public.result_versions rv join public.races r on r.id=rv.race_id join public.seasons s on s.id=r.season_id join public.leagues l on l.id=s.league_id where rv.id=p_result_version_id and rv.status='validated' and l.slug=public.requested_league_slug();
  if target_league_id is null or not private.has_league_capability(target_league_id,'league_admin') then raise exception using errcode='42501', message='Validated league result draft not found or access denied.'; end if;
  perform private.activate_result_version(p_result_version_id);
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata) values('league',target_league_id,actor_id,'result.published','result_version',p_result_version_id,jsonb_build_object('race_id',target_race_id));
  return jsonb_build_object('id',p_result_version_id,'race_id',target_race_id,'status','active');
end $$;

revoke all on function public.get_league_configuration_workspace() from public,anon,authenticated,service_role;
revoke all on function public.update_league_rules(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.rename_league_team(text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.create_league_result_draft(uuid,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.publish_league_result_draft(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_league_configuration_workspace() to authenticated,service_role;
grant execute on function public.update_league_rules(jsonb,jsonb) to authenticated,service_role;
grant execute on function public.rename_league_team(text,text,text) to authenticated,service_role;
grant execute on function public.create_league_result_draft(uuid,jsonb,text) to authenticated,service_role;
grant execute on function public.publish_league_result_draft(uuid) to authenticated,service_role;
