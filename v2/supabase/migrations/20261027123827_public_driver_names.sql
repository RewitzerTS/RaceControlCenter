-- Presentation only: never rewrite historical names, aliases, links, results or rewards.
-- NULL means the owner has not confirmed the new preference; existing labels stay intact.
alter table public.driver_identities add column public_name_mode text
  check (public_name_mode in ('name','gamertag'));
alter table public.drivers add column public_name text;
-- Real names remain available through authorized management RPCs, not public table reads.
revoke select on public.drivers from anon,authenticated;
grant select(id,display_name,gamertag,nationality_code,number,is_active,notes,created_at,updated_at,
  ai_driver_reference,car_name,league_team,nationality,avatar_url,league_id,public_name)
  on public.drivers to anon,authenticated;

create function profile_private.project_public_names() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.public_name_mode is not null then
    update public.drivers d set public_name=case new.public_name_mode
      when 'gamertag' then new.gamertag else new.real_name end
    from public.driver_identity_links l where l.driver_id=d.id and l.driver_identity_id=new.id
      and d.public_name is distinct from case new.public_name_mode when 'gamertag' then new.gamertag else new.real_name end;
  end if;
  return new;
end; $$;
create trigger driver_identity_public_name after update of real_name,gamertag,public_name_mode
on public.driver_identities for each row execute function profile_private.project_public_names();

create function profile_private.project_linked_name() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.drivers d set public_name=case di.public_name_mode when 'gamertag' then di.gamertag else di.real_name end
    from public.driver_identities di where d.id=new.driver_id and di.id=new.driver_identity_id and di.public_name_mode is not null;
  return new;
end; $$;
create trigger driver_link_public_name after insert or update of driver_identity_id,driver_id
on public.driver_identity_links for each row execute function profile_private.project_linked_name();

create function profile_private.name_settings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare di public.driver_identities%rowtype; result jsonb;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  select * into di from public.driver_identities where user_id=auth.uid() and status='active';
  if di.id is null then return null; end if;
  result:=jsonb_build_object('name',coalesce(nullif(btrim(di.real_name),''),di.display_name,''),
    'gamertag',di.gamertag,'public_name_mode',di.public_name_mode,
    'needs_confirmation',di.real_name is null or di.public_name_mode is null);
  return result||jsonb_build_object('revision',md5(result::text));
end; $$;

create function profile_private.save_names(p_name text,p_public_name_mode text,p_revision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); di public.driver_identities%rowtype; clean_name text:=btrim(p_name);
begin
  if actor is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  if clean_name is null or char_length(clean_name) not between 2 and 60 or clean_name ~ '[<>[:cntrl:]]'
    or p_public_name_mode is null or p_public_name_mode not in ('name','gamertag') then
    raise exception using errcode='22023',message='NAME_SETTINGS_INVALID'; end if;
  perform 1 from auth.users where id=actor and deleted_at is null and (banned_until is null or banned_until<=now()) for update;
  if not found then raise exception using errcode='42501',message='Active account required.'; end if;
  select * into di from public.driver_identities where user_id=actor and status='active' for update;
  if di.id is null then raise exception using errcode='42501',message='Active identity required.'; end if;
  if p_revision is distinct from (profile_private.name_settings()->>'revision') then
    raise exception using errcode='40001',message='NAME_SETTINGS_STALE'; end if;
  if p_public_name_mode='gamertag' and nullif(btrim(di.gamertag),'') is null then
    raise exception using errcode='22023',message='NAME_SETTINGS_TAG_REQUIRED'; end if;
  -- Keep the old display_name as compatibility/matching data, not a separately editable field.
  update public.driver_identities set real_name=clean_name,public_name_mode=p_public_name_mode,
    display_name=coalesce(display_name,clean_name) where id=di.id;
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}')
    ||jsonb_build_object('real_name',clean_name,'public_name_mode',p_public_name_mode),updated_at=now() where id=actor;
  return profile_private.name_settings();
end; $$;

create function public.get_my_name_settings() returns jsonb language sql security invoker set search_path=''
as $$ select profile_private.name_settings(); $$;
create function public.save_my_name_settings(p_name text,p_public_name_mode text,p_revision text) returns jsonb
language sql security invoker set search_path='' as $$ select profile_private.save_names(p_name,p_public_name_mode,p_revision); $$;

create or replace function entry_private.state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity_id uuid:=entry_private.ensure_identity(); di public.driver_identities%rowtype;
begin
  select * into di from public.driver_identities where id=identity_id;
  return jsonb_build_object('identity_id',di.id,'racevora_id','RV-'||di.racevora_number::text,
    'display_name',di.display_name,'real_name',di.real_name,'gamertag',di.gamertag,'public_name_mode',di.public_name_mode,
    'profile_complete',di.display_name is not null and di.gamertag is not null,
    'step',case when di.display_name is null or di.gamertag is null then 1 when di.entry_step=1 then 3 else di.entry_step end);
end; $$;
create function profile_private.save_entry_names(p_name text,p_gamertag text,p_public_name_mode text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity_id uuid:=entry_private.ensure_identity();
begin
  perform profile_private.update_my_gamertag(p_gamertag);
  perform profile_private.save_names(p_name,p_public_name_mode,profile_private.name_settings()->>'revision');
  update public.driver_identities set entry_step=greatest(entry_step,2) where id=identity_id;
  return entry_private.state();
end; $$;
create function public.save_my_entry_names(p_name text,p_gamertag text,p_public_name_mode text) returns jsonb
language sql security invoker set search_path='' as $$ select profile_private.save_entry_names(p_name,p_gamertag,p_public_name_mode); $$;

-- Admin graphics retain legacy keys for old saved payloads, but never return an opted-out real name.
create function profile_private.graphic_names() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare lid uuid:=private.roster_admin_league();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('driverId',d.id,'leagueDriverName',d.display_name,
    'driverName',case when di.public_name_mode='gamertag' then di.gamertag
      when di.public_name_mode='name' then di.real_name else coalesce(di.real_name,d.real_name,d.display_name) end,
    'displayName',coalesce(d.public_name,d.display_name),'publicName',coalesce(d.public_name,d.display_name),
    'publicNameMode',di.public_name_mode,'gamertag',coalesce(di.gamertag,d.gamertag)) order by d.id)
    from public.drivers d left join public.driver_identity_links l on l.driver_id=d.id
    left join public.driver_identities di on di.id=l.driver_identity_id where d.league_id=lid),'[]');
end; $$;
create or replace function public.get_social_graphics_driver_labels() returns jsonb
language sql stable security invoker set search_path='' as $$ select profile_private.graphic_names(); $$;

revoke all on function profile_private.project_public_names(),profile_private.project_linked_name(),
  profile_private.name_settings(),profile_private.save_names(text,text,text),profile_private.save_entry_names(text,text,text),
  profile_private.graphic_names(),public.get_my_name_settings(),public.save_my_name_settings(text,text,text),
  public.save_my_entry_names(text,text,text) from public,anon,authenticated;
grant execute on function profile_private.name_settings(),profile_private.save_names(text,text,text),
  profile_private.save_entry_names(text,text,text),profile_private.graphic_names(),public.get_my_name_settings(),
  public.save_my_name_settings(text,text,text),public.save_my_entry_names(text,text,text) to authenticated;
create function profile_private.league_name_editor(p_driver_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare state jsonb:=league_roster_private.driver_editor(p_driver_id); di public.driver_identities%rowtype; d public.drivers%rowtype;
begin
  if p_driver_id is null then return state||jsonb_build_object('name',null,'public_name_mode','name','name_managed_by_driver',false); end if;
  select * into d from public.drivers where id=p_driver_id;
  select i.* into di from public.driver_identities i join public.driver_identity_links l on l.driver_identity_id=i.id where l.driver_id=p_driver_id;
  return state||jsonb_build_object('name',coalesce(di.real_name,d.real_name,d.display_name),
    'public_name_mode',case when di.id is not null then di.public_name_mode
      when d.public_name is not null and d.public_name=d.gamertag then 'gamertag' else 'name' end,
    'name_managed_by_driver',di.id is not null);
end; $$;
create or replace function public.get_league_driver_editor(p_driver_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select profile_private.league_name_editor(p_driver_id); $$;

create function profile_private.save_league_names(p_driver_id uuid,p_profile jsonb,p_aliases jsonb,p_ai_driver_id uuid,p_round integer,p_revision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lid uuid:=private.roster_admin_league(); previous jsonb; result jsonb; d public.drivers%rowtype;
  clean_name text:=btrim(p_profile->>'name'); mode text:=p_profile->>'public_name_mode';
begin
  perform 1 from public.leagues where id=lid for update;
  previous:=profile_private.league_name_editor(p_driver_id);
  if clean_name is null or char_length(clean_name) not between 2 and 60 or clean_name ~ '[<>[:cntrl:]]' then
    raise exception using errcode='22023',message='NAME_SETTINGS_INVALID'; end if;
  if (previous->>'name_managed_by_driver')::boolean then
    if clean_name is distinct from previous->>'name' or mode is distinct from previous->>'public_name_mode' then
      raise exception using errcode='42501',message='NAME_SETTINGS_PERSONAL'; end if;
  elsif mode is null or mode not in ('name','gamertag') or (mode='gamertag' and nullif(btrim(p_profile->>'gamertag'),'') is null) then
    raise exception using errcode='22023',message='NAME_SETTINGS_INVALID';
  end if;
  -- Use the existing editor transaction for aliases, AI assignment and concurrency checks.
  -- Keep its historical/matching display_name unchanged for an existing driver.
  result:=league_roster_private.save_driver_editor(p_driver_id,
    (p_profile-'name'-'public_name_mode')||jsonb_build_object('display_name',coalesce(previous->'driver'->>'display_name',clean_name)),
    p_aliases,p_ai_driver_id,p_round,p_revision);
  select * into d from public.drivers where id=(result->'driver'->>'id')::uuid;
  if not (previous->>'name_managed_by_driver')::boolean then
    update public.drivers set real_name=clean_name,public_name=case mode when 'name' then clean_name else btrim(p_profile->>'gamertag') end where id=d.id;
  end if;
  return profile_private.league_name_editor(d.id);
end; $$;
create function public.save_league_named_driver(p_driver_id uuid,p_profile jsonb,p_aliases jsonb,p_ai_driver_id uuid,p_round integer,p_revision text) returns jsonb
language sql security invoker set search_path='' as $$ select profile_private.save_league_names(p_driver_id,p_profile,p_aliases,p_ai_driver_id,p_round,p_revision); $$;
revoke all on function profile_private.league_name_editor(uuid),profile_private.save_league_names(uuid,jsonb,jsonb,uuid,integer,text),
  public.save_league_named_driver(uuid,jsonb,jsonb,uuid,integer,text) from public,anon,authenticated;
grant execute on function profile_private.league_name_editor(uuid),profile_private.save_league_names(uuid,jsonb,jsonb,uuid,integer,text),
  public.save_league_named_driver(uuid,jsonb,jsonb,uuid,integer,text) to authenticated;

create function profile_private.named_driver_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare workspace jsonb:=profile_private.driver_workspace();
begin
  return jsonb_set(workspace,'{drivers}',coalesce((select jsonb_agg(item||jsonb_build_object(
    'name',coalesce(di.real_name,d.real_name,d.display_name),'public_name',d.public_name) order by ord)
    from jsonb_array_elements(workspace->'drivers') with ordinality a(item,ord)
    join public.drivers d on d.id=(item->>'id')::uuid
    left join public.driver_identity_links l on l.driver_id=d.id
    left join public.driver_identities di on di.id=l.driver_identity_id),'[]'));
end; $$;
create or replace function public.get_league_driver_admin_workspace() returns jsonb
language sql stable security invoker set search_path='' as $$ select profile_private.named_driver_workspace(); $$;
revoke all on function profile_private.named_driver_workspace() from public,anon,authenticated;
grant execute on function profile_private.named_driver_workspace() to authenticated;
notify pgrst,'reload schema';
