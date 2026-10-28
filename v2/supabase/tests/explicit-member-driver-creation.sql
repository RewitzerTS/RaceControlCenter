begin;
create temporary table ux_fixture as select gen_random_uuid() lid,gen_random_uuid() actor,gen_random_uuid() member,gen_random_uuid() outsider,null::uuid did;
grant select,update on ux_fixture to authenticated;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
select id,'authenticated','authenticated',id||'@ux.invalid','{}','{}' from ux_fixture cross join lateral unnest(array[actor,member,outsider]) id;
insert into public.leagues(id,name,slug,is_public,settings) select lid,'UX synthetic','ux-'||lid,false,'{}' from ux_fixture;
insert into public.driver_identities(user_id,status,display_name,gamertag,real_name,public_name_mode)
select member,'active','Legacy','UniqueTag','Test Driver','gamertag' from ux_fixture;
insert into public.driver_identities(user_id,status,display_name,gamertag) select actor,'active','Synthetic Admin','AdminTag' from ux_fixture;
insert into public.league_members(league_id,user_id,role) select lid,actor,'league_admin' from ux_fixture union all select lid,member,'driver' from ux_fixture;
select set_config('request.headers',jsonb_build_object('x-rcc-league-slug','ux-'||lid)::text,true),
set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true) from ux_fixture;
set local role authenticated;
do $$ declare f record; result jsonb; begin
 select * into f from ux_fixture;
 result:=public.create_and_link_league_member_driver(f.member);
 update ux_fixture set did=(result->>'driver_id')::uuid;
 if not exists(select 1 from public.drivers where id=(result->>'driver_id')::uuid and gamertag='UniqueTag' and public_name='UniqueTag') then raise exception 'Public name lost'; end if;
 begin perform public.create_and_link_league_member_driver(f.member); raise exception 'Duplicate accepted'; exception when unique_violation then null; end;
 if (select count(*) from public.drivers where league_id=f.lid)<>1 then raise exception 'Retry created duplicate'; end if;
 begin perform public.create_and_link_league_member_driver(f.outsider); raise exception 'Nonmember accepted'; exception when no_data_found then null; end;
end; $$;
reset role;
do $$ begin if not exists(select 1 from public.driver_identity_links l join ux_fixture f on f.did=l.driver_id) then raise exception 'Link missing'; end if; end; $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true) from ux_fixture;
set local role authenticated;
do $$ begin
 begin perform public.create_and_link_league_member_driver((select member from ux_fixture)); raise exception 'Driver could create'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
set constraints all immediate;
select 'explicit new profile, link, public name, retries and permission checks passed' result;
rollback;
