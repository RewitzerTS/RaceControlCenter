-- Synthetic accounts only. Every fixture and write is rolled back.
begin;
create temporary table gamertag_test_fixture as
select gen_random_uuid() as actor, gen_random_uuid() as other_actor,
       gen_random_uuid() as identity_id, gen_random_uuid() as other_identity;
grant select on gamertag_test_fixture to authenticated;
insert into auth.users(id,email,raw_user_meta_data)
select actor, actor::text || '@gamertag-test.invalid', '{"gamertag":"Raucher7575","display_name":"Test Driver","theme_preset":2}'::jsonb from gamertag_test_fixture
union all select other_actor,other_actor::text || '@gamertag-test.invalid','{"gamertag":"Other"}'::jsonb from gamertag_test_fixture;
insert into public.driver_identities(id,user_id,status,display_name,gamertag)
select identity_id,actor,'active','Test Driver','Raucher7575' from gamertag_test_fixture
union all select other_identity,other_actor,'active','Other Driver','Other' from gamertag_test_fixture;

do $$ begin
  if has_function_privilege('anon','public.update_my_gamertag(text)','execute')
    or has_function_privilege('anon','profile_private.update_my_gamertag(text)','execute') then
    raise exception 'Anonymous callers must not have access';
  end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true) from gamertag_test_fixture;
set local role authenticated;
select public.update_my_gamertag('  Ratcher7575  ');
select public.update_my_gamertag('Ratcher7575');
do $$
declare invalid_tag text;
begin
  foreach invalid_tag in array array['',' ','x',repeat('x',61),'<bad>',E'two\nlines'] loop
    begin
      perform public.update_my_gamertag(invalid_tag);
      raise exception 'Invalid gamertag accepted';
    exception when sqlstate '22023' then null;
    end;
  end loop;
end $$;
reset role;
do $$
declare f record;
begin
  select * into f from gamertag_test_fixture;
  if (select gamertag from public.driver_identities where id=f.identity_id) <> 'Ratcher7575'
    or (select raw_user_meta_data->>'gamertag' from auth.users where id=f.actor) <> 'Ratcher7575' then
    raise exception 'Canonical identity and metadata must agree';
  end if;
  if (select raw_user_meta_data->>'display_name' from auth.users where id=f.actor) <> 'Test Driver'
    or (select raw_user_meta_data->>'theme_preset' from auth.users where id=f.actor) <> '2' then
    raise exception 'Unrelated metadata changed';
  end if;
  if (select gamertag from public.driver_identities where id=f.other_identity) <> 'Other'
    or (select raw_user_meta_data->>'gamertag' from auth.users where id=f.other_actor) <> 'Other' then
    raise exception 'Another user was modified';
  end if;
  if (select count(*) from public.driver_aliases where driver_identity_id=f.identity_id and normalized_alias='ratcher7575') <> 1 then
    raise exception 'Alias must be idempotent';
  end if;
  if exists(select 1 from public.driver_identity_links where driver_identity_id in(f.identity_id,f.other_identity)) then
    raise exception 'Gamertag change must never create a driver link';
  end if;
  update public.driver_identities set status='suspended' where id=f.identity_id;
end $$;
set local role authenticated;
do $$ begin
  begin
    perform public.update_my_gamertag('Must not save');
    raise exception 'Suspended identity was accepted';
  exception when sqlstate '42501' then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $$ begin
  begin
    perform public.update_my_gamertag('Must not save');
    raise exception 'Missing actor was accepted';
  exception when sqlstate '42501' then null;
  end;
end $$;
reset role;
rollback;
