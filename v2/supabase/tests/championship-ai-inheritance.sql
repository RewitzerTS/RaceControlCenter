-- Staging only. Synthetic fixtures and all writes are rolled back.
begin;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('f8700000-0000-4000-8000-000000000001','authenticated','authenticated','wm-inheritance@example.invalid','{}','{}',now(),now()),
      ('f8700000-0000-4000-8000-000000000002','authenticated','authenticated','wm-outsider@example.invalid','{}','{}',now(),now());
insert into public.leagues(id,name,slug,is_public,settings)
values('f8710000-0000-4000-8000-000000000001','WM inheritance test','wm-inheritance-test',false,'{"published":false}'),
      ('f8710000-0000-4000-8000-000000000002','Other WM test','wm-other-test',false,'{"published":false}');
insert into public.driver_identities(user_id) values('f8700000-0000-4000-8000-000000000001'),('f8700000-0000-4000-8000-000000000002');
insert into public.league_members(league_id,user_id,role)
values('f8710000-0000-4000-8000-000000000001','f8700000-0000-4000-8000-000000000001','driver');
insert into public.seasons(id,league_id,slug,name,is_active,game_key,game_label)
values('f8720000-0000-4000-8000-000000000001','f8710000-0000-4000-8000-000000000001','s1','S1',true,'f1_25','F1 25'),
      ('f8720000-0000-4000-8000-000000000002','f8710000-0000-4000-8000-000000000002','other','Other',true,'f1_25','F1 25');
insert into public.races(season_id,round_number,grand_prix_name)
select 'f8720000-0000-4000-8000-000000000001',i,'Test GP '||i from generate_series(1,4) i
where not exists(select 1 from public.races where season_id='f8720000-0000-4000-8000-000000000001' and round_number=i);
insert into public.drivers(id,league_id,display_name,gamertag,is_active,ai_driver_reference)
values('f8740000-0000-4000-8000-000000000001','f8710000-0000-4000-8000-000000000001','Robin','alpine_wolf',true,null),
      ('f8740000-0000-4000-8000-000000000002','f8710000-0000-4000-8000-000000000001','Later driver','LaterTag',true,null),
      ('f8740000-0000-4000-8000-000000000003','f8710000-0000-4000-8000-000000000001','Pierre Gasly',null,true,'f1_25:alpine-gasly');
insert into private.season_driver_ai_assignments(season_id,human_driver_id,ai_driver_id,seat_code,effective_from_round,effective_to_round)
values('f8720000-0000-4000-8000-000000000001','f8740000-0000-4000-8000-000000000001','f8740000-0000-4000-8000-000000000003','alpine-gasly',2,2),
      ('f8720000-0000-4000-8000-000000000001','f8740000-0000-4000-8000-000000000002','f8740000-0000-4000-8000-000000000003','alpine-gasly',4,null);
set constraints all immediate;
select set_config('request.headers','{"x-rcc-league-slug":"wm-inheritance-test"}',true);
select set_config('request.jwt.claims','{"sub":"f8700000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.get_season_championship_ai_assignments('f8720000-0000-4000-8000-000000000001')) then
    raise exception 'Future takeover exposed too soon'; end if;
  begin
    perform public.get_season_championship_ai_assignments('f8720000-0000-4000-8000-000000000002');
    raise exception 'Cross-league season allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.headers','{"x-rcc-league-slug":"wm-other-test"}',true);
  begin
    perform public.get_season_championship_ai_assignments('f8720000-0000-4000-8000-000000000001');
    raise exception 'Mismatched header allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.headers','{"x-rcc-league-slug":"wm-inheritance-test"}',true);
end $$;
reset role;
update public.races set status='completed' where season_id='f8720000-0000-4000-8000-000000000001' and round_number=1;
set local role authenticated;
do $$ begin
  if (select count(*) from public.get_season_championship_ai_assignments('f8720000-0000-4000-8000-000000000001'))<>1 then raise exception 'First takeover missing'; end if;
end $$;
reset role;
update public.races set status='completed' where season_id='f8720000-0000-4000-8000-000000000001' and round_number<=3;
set local role authenticated;
do $$ begin
  if (select count(*) from public.get_season_championship_ai_assignments('f8720000-0000-4000-8000-000000000001'))<>2 then raise exception 'Ended takeover lost or new takeover missing'; end if;
  if (select effective_to_round from public.get_season_championship_ai_assignments('f8720000-0000-4000-8000-000000000001') where human_driver_id='f8740000-0000-4000-8000-000000000001') is distinct from 2 then raise exception 'Previous ownership changed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"f8700000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin
    perform public.get_season_championship_ai_assignments('f8720000-0000-4000-8000-000000000001');
    raise exception 'Nonmember allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ begin
  begin
    perform public.get_season_championship_ai_assignments('f8720000-0000-4000-8000-000000000001');
    raise exception 'Anonymous access allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: effective rounds, retained ownership, league access and anonymous denial' as test_result;
rollback;
