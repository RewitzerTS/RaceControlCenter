-- Entire synthetic late-link journey is rolled back, including rewards.
begin;
do $$
declare
  actor uuid := gen_random_uuid(); member uuid := gen_random_uuid();
  league uuid := gen_random_uuid(); season uuid := gen_random_uuid();
  driver uuid := gen_random_uuid(); race uuid; version uuid; identity_id uuid; link_id uuid;
  event_id uuid; receipt jsonb; before_rows jsonb; after_rows jsonb;
  xp bigint; credits bigint; xp_entries bigint; credit_entries bigint;
begin
  insert into auth.users(id,email) values(actor,actor||'@example.invalid'),(member,member||'@example.invalid');
  insert into public.driver_identities(user_id) values(actor);
  insert into public.driver_identities(user_id) values(member) returning id into identity_id;
  insert into public.leagues(id,name,slug,is_public) values(league,'Transient Career QA','qa-career-'||league,false);
  insert into public.league_members(league_id,user_id,role) values(league,actor,'league_admin'),(league,member,'driver');
  insert into public.seasons(id,league_id,slug,name) values(season,league,'late-link','Late Link');
  insert into public.drivers(id,league_id,display_name) values(driver,league,'Late-linked driver');
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.headers',jsonb_build_object('x-rcc-league-slug','qa-career-'||league)::text,true);
  for n in 1..2 loop
    select id into race from public.races where season_id=season and round_number=n;
    if race is null then
      insert into public.races(season_id,round_number,grand_prix_name,race_date)
      values(season,n,'Late Link '||n,'2026-02-01'::date+n) returning id into race;
    end if;
    version := private.create_result_version(race,'Synthetic late-link result');
    insert into public.result_version_rows(result_version_id,row_order,driver_id,grid_position,finish_position,
      participation_status,classification_status,awarded_points,points,fastest_lap_time_ms)
    values(version,1,driver,1,1,case when n=1 then 'PLAYER' else 'BOT' end,'classified',25,25,90000);
    perform private.validate_result_version(version);
    perform private.activate_result_version(version);
    for event_id in select id from public.domain_events where result_version_id=version loop
      receipt := private.process_domain_event_queue(1,event_id);
      assert (receipt->>'failed')::int=0, 'Initial publication failed';
    end loop;
  end loop;
  assert not exists(select 1 from public.driver_career_stats where driver_identity_id=identity_id), 'Unlinked account has no career';
  select jsonb_agg(to_jsonb(rr) order by rr.id) into before_rows from public.result_version_rows rr where rr.driver_id=driver;
  perform public.link_league_member_driver(member,driver);
  select id into link_id from public.driver_identity_links where driver_id=driver;
  assert (select count(*) from public.domain_events where payload->>'link_id'=link_id::text)=1, 'Only PLAYER race queued';
  assert private.enqueue_linked_driver_career(link_id)=0, 'Queue is idempotent';
  assert not exists(select 1 from private.domain_event_processing p join public.domain_events e on e.id=p.event_id
    where e.payload->>'link_id'=link_id::text and p.processor not in ('career','xp','achievements')), 'No notification/challenge side effects';
  for event_id in select id from public.domain_events where payload->>'link_id'=link_id::text loop
    receipt := private.process_domain_event_queue(1,event_id);
    assert (receipt->>'failed')::int=0, 'Late-link processing failed';
  end loop;
  assert exists(select 1 from public.driver_career_stats where driver_identity_id=identity_id and starts=1 and wins=1 and total_points=25), 'Existing career was not restored';
  select lifetime_xp into xp from public.driver_progression where driver_identity_id=identity_id;
  assert xp > 0, 'XP was not restored';
  assert exists(select 1 from public.driver_achievements where driver_identity_id=identity_id and status='unlocked'), 'Achievements were not restored';
  select balance into credits from public.driver_wallets where driver_identity_id=identity_id;
  select count(*) into xp_entries from public.xp_ledger where driver_identity_id=identity_id;
  select count(*) into credit_entries from public.credit_ledger where driver_identity_id=identity_id;
  perform public.link_league_member_driver(member,driver);
  for event_id in select id from public.domain_events where payload->>'link_id'=link_id::text loop
    perform private.process_domain_event_queue(1,event_id);
  end loop;
  assert (select lifetime_xp from public.driver_progression where driver_identity_id=identity_id)=xp, 'XP duplicated';
  assert (select balance from public.driver_wallets where driver_identity_id=identity_id)=credits, 'Credits duplicated';
  assert (select count(*) from public.xp_ledger where driver_identity_id=identity_id)=xp_entries, 'Extra XP ledger entries';
  assert (select count(*) from public.credit_ledger where driver_identity_id=identity_id)=credit_entries, 'Extra credit ledger entries';
  select jsonb_agg(to_jsonb(rr) order by rr.id) into after_rows from public.result_version_rows rr where rr.driver_id=driver;
  assert before_rows=after_rows, 'Authoritative results changed';
  -- A later official correction must still replace the imported Career result.
  select rr.race_id into race from public.career_result_facts rr where rr.driver_identity_id=identity_id limit 1;
  version := private.create_result_version(race,'Synthetic correction after late link',
    (select current_result_version_id from public.races where id=race));
  insert into public.result_version_rows(result_version_id,row_order,driver_id,grid_position,finish_position,
    participation_status,classification_status,awarded_points,points,fastest_lap_time_ms)
  values(version,1,driver,2,2,'PLAYER','classified',18,18,90000);
  perform private.validate_result_version(version);
  perform private.activate_result_version(version);
  for event_id in select id from public.domain_events where result_version_id=version loop
    receipt := private.process_domain_event_queue(1,event_id);
    assert (receipt->>'failed')::int=0, 'Correction processing failed';
  end loop;
  assert exists(select 1 from public.driver_career_stats where driver_identity_id=identity_id and starts=1 and wins=0 and total_points=18), 'Correction duplicated or retained old statistics';
  assert (select lifetime_xp from public.driver_progression where driver_identity_id=identity_id)<xp, 'Correction did not reconcile XP';
  assert not has_function_privilege('authenticated','private.enqueue_linked_driver_career(uuid)','execute'), 'Browser can replay rewards';
  assert not has_function_privilege('anon','private.enqueue_linked_driver_career(uuid)','execute'), 'Anonymous replay';
end;
$$;
select 'late-link career, BOT exclusion, XP, achievements, retry, immutable results: passed' result;
rollback;
