create function member_linking.create_driver(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lid uuid:=private.roster_admin_league(); di public.driver_identities%rowtype; did uuid;
begin
 perform 1 from public.league_members where league_id=lid and user_id=p_user_id for update;
 if not found then raise exception using errcode='P0002',message='MEMBER_NOT_FOUND'; end if;
 select * into di from public.driver_identities where user_id=p_user_id and status='active' for update;
 if di.id is null then raise exception using errcode='23514',message='MEMBER_IDENTITY_INACTIVE'; end if;
 if exists(select 1 from public.driver_identity_links l join public.drivers d on d.id=l.driver_id where l.driver_identity_id=di.id and d.league_id=lid) then
  raise exception using errcode='23505',message='MEMBER_ALREADY_LINKED'; end if;
 if nullif(btrim(di.gamertag),'') is null or nullif(btrim(coalesce(di.real_name,di.display_name)),'') is null then raise exception using errcode='22023',message='ENTRY_PROFILE_REQUIRED'; end if;
 if exists(select 1 from public.drivers d where d.league_id=lid and lower(btrim(d.gamertag))=lower(btrim(di.gamertag))) then
  raise exception using errcode='23505',message='MEMBER_MATCH_EXISTS'; end if;
 insert into public.drivers(league_id,display_name,gamertag,real_name,nationality_code,is_active)
 values(lid,coalesce(di.real_name,di.display_name),di.gamertag,di.real_name,di.nationality_code,true) returning id into did;
 perform public.link_league_member_driver(p_user_id,did);
 return jsonb_build_object('driver_id',did);
end; $$;
create function public.create_and_link_league_member_driver(p_user_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select member_linking.create_driver(p_user_id); $$;
revoke all on function member_linking.create_driver(uuid),public.create_and_link_league_member_driver(uuid) from public,anon,authenticated;
grant execute on function member_linking.create_driver(uuid),public.create_and_link_league_member_driver(uuid) to authenticated;
