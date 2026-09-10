begin;
do $$
declare actor uuid := gen_random_uuid(); league uuid := gen_random_uuid(); season uuid := gen_random_uuid();
  snapshot jsonb; race jsonb; payload jsonb; result jsonb; current_stamp timestamptz;
begin
  insert into auth.users(id,email) values(actor,actor||'@example.invalid');
  insert into public.driver_identities(user_id) values(actor);
  insert into public.leagues(id,name,slug,is_public) values(league,'Transient Calendar QA','qa-calendar-'||league,false);
  insert into public.league_members(league_id,user_id,role) values(league,actor,'league_admin');
  insert into public.seasons(id,league_id,slug,name,is_active,game_key) values(season,league,'calendar','Calendar',true,'f1_25');
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.headers',jsonb_build_object('x-rcc-league-slug','qa-calendar-'||league)::text,true);
  snapshot := public.get_editable_race_calendar();
  race := snapshot->'races'->0;
  assert race is not null, 'Calendar should contain seeded races';
  payload := jsonb_build_object('track_key',race->>'track_key','date','2026-11-20','time','20:30','weather','regen','has_sprint',true);
  result := public.update_league_calendar_race((race->>'id')::uuid,(race->>'updated_at')::timestamptz,payload);
  assert result->>'saved' = 'true', 'Edit should save';
  assert (select race_date='2026-11-20' and race_time='20:30' and weather='regen' and has_sprint from public.races where id=(race->>'id')::uuid), 'Fields saved';
  assert (select count(*) from public.races where season_id=season) = jsonb_array_length(snapshot->'races'), 'No races deleted';
  begin
    perform public.update_league_calendar_race((race->>'id')::uuid,'2000-01-01'::timestamptz,payload);
    raise exception 'ASSERT: stale edit was accepted';
  exception when others then
    if sqlerrm like 'ASSERT:%' then raise; end if;
    assert sqlerrm like '%inzwischen geändert%', 'Expected conflict';
  end;
  perform private.create_result_version((race->>'id')::uuid,'Calendar lock test');
  select updated_at into current_stamp from public.races where id=(race->>'id')::uuid;
  begin
    perform public.update_league_calendar_race((race->>'id')::uuid,current_stamp,payload);
    raise exception 'ASSERT: result race edit was accepted';
  exception when others then
    if sqlerrm like 'ASSERT:%' then raise; end if;
    assert sqlerrm like '%Ergebnissen%', 'Expected result protection';
  end;
  perform set_config('request.headers','{"x-rcc-league-slug":"nonexistent"}',true);
  begin
    perform public.get_editable_race_calendar();
    raise exception 'ASSERT: tenant access accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
