-- Synthetic staging-only regression. Every inserted record is rolled back.
begin;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('f8600000-0000-4000-8000-000000000001','authenticated','authenticated','standings-roster@example.invalid','{}','{}',now(),now()),
      ('f8600000-0000-4000-8000-000000000002','authenticated','authenticated','standings-outsider@example.invalid','{}','{}',now(),now());
insert into public.leagues(id,name,slug,is_public,settings)
values('f8610000-0000-4000-8000-000000000001','Championship roster test','championship-roster-test',false,'{"published":false}'),
      ('f8610000-0000-4000-8000-000000000002','Other championship test','championship-other-test',false,'{"published":false}');
insert into public.driver_identities(user_id)
values('f8600000-0000-4000-8000-000000000001'),('f8600000-0000-4000-8000-000000000002');
insert into public.league_members(league_id,user_id,role)
values('f8610000-0000-4000-8000-000000000001','f8600000-0000-4000-8000-000000000001','driver');
insert into public.seasons(id,league_id,slug,name,is_active,game_key,game_label)
values('f8620000-0000-4000-8000-000000000001','f8610000-0000-4000-8000-000000000001','season-15','Season 15',true,'f1_25','F1 25'),
      ('f8620000-0000-4000-8000-000000000002','f8610000-0000-4000-8000-000000000002','other-season','Other season',true,'f1_25','F1 25');
insert into public.races(season_id,round_number,grand_prix_name)
select 'f8620000-0000-4000-8000-000000000001',i,'Test GP '||i from generate_series(1,3) i
where not exists(select 1 from public.races where season_id='f8620000-0000-4000-8000-000000000001' and round_number=i);
insert into public.drivers(id,league_id,display_name,gamertag,league_team,car_name,is_active)
select ('f8640000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'f8610000-0000-4000-8000-000000000001',
  'Test Driver '||i,'TestTag'||i,'Previous season team','Old car',true from generate_series(1,7) i;
insert into public.season_driver_assignments(season_id,driver_id,seat_code,ai_driver_name,number,nationality_code,team_name,car_name,participant_type)
select 'f8620000-0000-4000-8000-000000000001',('f8640000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  'test-seat-'||i,'Test AI '||i,i,'DE',case when i<=2 then 'Team One' else '' end,'Current car','PLAYER' from generate_series(1,6) i;
insert into private.season_vehicle_assignments(season_id,driver_id,effective_from_round,team_name,car_name)
select 'f8620000-0000-4000-8000-000000000001',('f8640000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  1,case when i<=2 then 'Team One' when i<=4 then 'Team Two' else 'Team Three' end,'Current car' from generate_series(1,6) i;
insert into private.season_vehicle_assignments(season_id,driver_id,effective_from_round,team_name,car_name)
values('f8620000-0000-4000-8000-000000000001','f8640000-0000-4000-8000-000000000003',3,'Future Team','Future car');
set constraints all immediate;
select set_config('request.headers','{"x-rcc-league-slug":"championship-roster-test"}',true);
select set_config('request.jwt.claims','{"sub":"f8600000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare roster jsonb; begin
  select jsonb_agg(to_jsonb(r)) into roster from public.get_season_championship_roster('f8620000-0000-4000-8000-000000000001') r;
  if jsonb_array_length(roster)<>6 then raise exception 'Expected six season participants, not the unassigned old profile'; end if;
  if (select count(distinct r->>'team_name') from jsonb_array_elements(roster) r)<>3 then raise exception 'The three current teams are missing'; end if;
  if exists(select 1 from jsonb_array_elements(roster) r where r->>'team_name'='Future Team') then raise exception 'Future switch applied too soon'; end if;
  if (select r->>'team_name' from jsonb_array_elements(roster) r where r->>'driver_id'='f8640000-0000-4000-8000-000000000003') is distinct from 'Team Two' then raise exception 'Initial empty team overrode effective lineup'; end if;
  begin
    perform public.get_season_championship_roster('f8620000-0000-4000-8000-000000000002');
    raise exception 'Cross-league season allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.headers','{"x-rcc-league-slug":"championship-other-test"}',true);
  begin
    perform public.get_season_championship_roster('f8620000-0000-4000-8000-000000000001');
    raise exception 'Mismatched league header allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.headers','{"x-rcc-league-slug":"championship-roster-test"}',true);
end $$;
reset role;
-- At round three the scheduled switch becomes the current display. Old base
-- assignments and published scoring are not rewritten by the read endpoint.
update public.races set status='completed' where season_id='f8620000-0000-4000-8000-000000000001' and round_number<3;
set local role authenticated;
do $$ begin
  if (select team_name from public.get_season_championship_roster('f8620000-0000-4000-8000-000000000001') where driver_id='f8640000-0000-4000-8000-000000000003') is distinct from 'Future Team' then raise exception 'Scheduled team did not become effective'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"f8600000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin
    perform public.get_season_championship_roster('f8620000-0000-4000-8000-000000000001');
    raise exception 'Nonmember allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ begin
  begin
    perform public.get_season_championship_roster('f8620000-0000-4000-8000-000000000001');
    raise exception 'Anonymous roster access allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
