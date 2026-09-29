-- Synthetic, rolled-back checks of ownership, league scope, aliases and matching data.
begin;
create temporary table alias_test as select gen_random_uuid() actor,gen_random_uuid() outsider,gen_random_uuid() identity_id,
  gen_random_uuid() league_id,gen_random_uuid() other_league,gen_random_uuid() driver_id,gen_random_uuid() other_driver;
grant select on alias_test to authenticated;
insert into auth.users(id,email) select actor,actor||'@alias.invalid' from alias_test union all select outsider,outsider||'@alias.invalid' from alias_test;
insert into public.driver_identities(id,user_id,status,display_name,gamertag) select identity_id,actor,'active','Aaron','Darkqz' from alias_test;
insert into public.leagues(id,slug,name) select league_id,'alias-'||league_id,'Synthetic aliases' from alias_test union all select other_league,'alias-'||other_league,'Other synthetic' from alias_test;
insert into public.league_members(league_id,user_id,role) select league_id,actor,'league_admin' from alias_test;
insert into public.drivers(id,league_id,display_name,gamertag,is_active) select driver_id,league_id,'Aaron','Darkqz',true from alias_test union all select other_driver,other_league,'Other','Other',true from alias_test;
select set_config('request.headers',jsonb_build_object('x-rcc-league-slug','alias-'||league_id)::text,true) from alias_test;
select set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true) from alias_test;
set local role authenticated;
select public.link_league_member_driver(actor,driver_id) from alias_test;
select public.add_driver_gamertag('D4RK','ea');
select public.add_driver_gamertag('Fabiylolboi','steam',driver_id) from alias_test;
do $$ declare f record; data jsonb; alias_id uuid; begin
  select * into f from alias_test;
  data := public.get_driver_gamertags();
  if jsonb_array_length(data->'aliases') <> 1 or data->'aliases'->0->>'platform'<>'ea' then raise exception 'Personal list incorrect'; end if;
  alias_id := (data->'aliases'->0->>'id')::uuid;
  data := public.get_driver_gamertags(f.driver_id);
  if jsonb_array_length(data->'aliases') <> 2 then raise exception 'Admin must see own league and personal aliases'; end if;
  begin perform public.remove_driver_gamertag(alias_id,f.driver_id); raise exception 'Admin removed personal alias'; exception when insufficient_privilege then null; end;
  begin perform public.add_driver_gamertag('d4rk'); raise exception 'Duplicate accepted'; exception when unique_violation then null; end;
  begin perform public.add_driver_gamertag('<bad>'); raise exception 'Unsafe alias accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.get_driver_gamertags(f.other_driver); raise exception 'Cross league read'; exception when insufficient_privilege then null; end;
  begin perform public.add_driver_gamertag('Foreign','ea',f.other_driver); raise exception 'Cross league write'; exception when insufficient_privilege then null; end;
  data := public.get_league_driver_admin_workspace();
  if not (data->'drivers'->0->'gamertag_aliases' @> '["D4RK","Fabiylolboi","Darkqz"]'::jsonb) then raise exception 'Import aliases missing: %',data; end if;
  perform public.update_my_gamertag('NewMain');
  data := public.get_driver_gamertags();
  if not exists(select 1 from jsonb_array_elements(data->'aliases') a where a->>'alias'='Darkqz') then raise exception 'Previous main lost'; end if;
  perform public.remove_driver_gamertag(alias_id);
  if exists(select 1 from jsonb_array_elements(public.get_driver_gamertags()->'aliases') a where a->>'alias'='D4RK') then raise exception 'Delete failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true) from alias_test;
set local role authenticated;
do $$ begin
  begin perform public.get_league_driver_admin_workspace(); raise exception 'Outsider workspace'; exception when insufficient_privilege then null; end;
  begin perform public.add_driver_gamertag('NoIdentity'); raise exception 'Missing identity accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.add_driver_gamertag(text,text,uuid)','execute') or has_table_privilege('authenticated','public.driver_aliases','insert') then raise exception 'Excess privilege'; end if;
  if (select count(*) from public.driver_identity_links where driver_id=(select driver_id from alias_test))<>1 then raise exception 'Identity link changed'; end if;
end $$;
rollback;
