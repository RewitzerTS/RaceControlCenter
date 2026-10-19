-- Entry 2.0: identity first; joining and explicit driver linking are separate.
-- No existing race, driver, link, start number or reward is changed.
create schema if not exists entry_private;
revoke all on schema entry_private from public, anon, authenticated;
grant usage on schema entry_private to authenticated;

alter table public.driver_identities
  add column racevora_number bigint generated always as identity (start with 100001),
  add column entry_step smallint not null default 1 check (entry_step between 1 and 3),
  add constraint driver_identities_racevora_number_unique unique (racevora_number);

create function entry_private.keep_number() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.racevora_number is distinct from old.racevora_number then
    raise exception using errcode='23514', message='RaceVora ID is immutable.';
  end if;
  return new;
end; $$;
create trigger entry_keep_number before update on public.driver_identities
for each row execute function entry_private.keep_number();

create function entry_private.ensure_identity() returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); identity_id uuid;
begin
  if actor is null then raise exception using errcode='42501', message='Authentication required.'; end if;
  -- Serialize provisioning/profile edits per account. Unconfirmed or banned accounts cannot provision.
  perform 1 from auth.users where id=actor and deleted_at is null
    and (email_confirmed_at is not null or phone_confirmed_at is not null)
    and (banned_until is null or banned_until<=now()) for update;
  if not found then raise exception using errcode='42501', message='Confirmed active account required.'; end if;
  insert into public.driver_identities(user_id) values(actor) on conflict(user_id) do nothing;
  select id into identity_id from public.driver_identities where user_id=actor and status='active';
  if identity_id is null then raise exception using errcode='42501', message='Active identity required.'; end if;
  return identity_id;
end; $$;

create function entry_private.state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare identity_id uuid := entry_private.ensure_identity(); di public.driver_identities%rowtype;
begin
  select * into di from public.driver_identities where id=identity_id;
  return jsonb_build_object('identity_id',di.id,'racevora_id','RV-'||di.racevora_number::text,
    'display_name',di.display_name,'gamertag',di.gamertag,
    'profile_complete',di.display_name is not null and di.gamertag is not null,
    'step',case when di.display_name is null or di.gamertag is null then 1
      when di.entry_step=1 then 3 else di.entry_step end);
end; $$;

create function entry_private.save_profile(p_display_name text,p_gamertag text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare identity_id uuid := entry_private.ensure_identity(); di public.driver_identities%rowtype;
begin
  if p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 60
    or p_display_name ~ '[<>[:cntrl:]]' or p_gamertag is null
    or char_length(btrim(p_gamertag)) not between 2 and 60 or p_gamertag ~ '[<>[:cntrl:]]' then
    raise exception using errcode='22023', message='ENTRY_PROFILE_INVALID';
  end if;
  select * into di from public.driver_identities where id=identity_id for update;
  -- Preserve nationality, real name, existing aliases and all league driver records.
  perform public.complete_driver_onboarding(btrim(p_display_name),btrim(p_gamertag),di.real_name,di.nationality_code,null);
  update public.driver_identities set entry_step=greatest(entry_step,2) where id=identity_id;
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)
    || jsonb_build_object('display_name',btrim(p_display_name),'gamertag',btrim(p_gamertag)) where id=auth.uid();
  return entry_private.state();
end; $$;

create function entry_private.advance(p_step integer,p_finish boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare identity_id uuid := entry_private.ensure_identity();
begin
  if p_step is null or p_step not in (2,3) or p_finish is null then raise exception using errcode='22023',message='ENTRY_STEP'; end if;
  -- Skipping dismisses the wizard, not the missing profile. Its first step remains resumable.
  if not p_finish then update public.driver_identities set entry_step=greatest(entry_step,p_step) where id=identity_id; end if;
  if p_finish then
    update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('onboarding_complete',true) where id=auth.uid();
  end if;
  return entry_private.state();
end; $$;

create function entry_private.request_league(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare identity_id uuid := entry_private.ensure_identity(); di public.driver_identities%rowtype;
  league public.leagues%rowtype; request_id uuid;
begin
  if p_code is null or btrim(p_code) !~ '^[0-9]{5}$' then raise exception using errcode='22023',message='ENTRY_CODE'; end if;
  select * into di from public.driver_identities where id=identity_id;
  if di.display_name is null or di.gamertag is null then raise exception using errcode='22023',message='ENTRY_PROFILE_REQUIRED'; end if;
  select * into league from public.leagues where join_code=btrim(p_code) and status='active';
  if league.id is null then raise exception using errcode='P0002',message='ENTRY_CODE'; end if;
  if exists(select 1 from public.league_members where league_id=league.id and user_id=auth.uid()) then
    return jsonb_build_object('league_name',league.name,'request_status','already_member');
  end if;
  insert into public.league_join_requests(league_id,user_id,driver_identity_id)
    values(league.id,auth.uid(),identity_id)
    on conflict(league_id,user_id) where status='pending' do nothing returning id into request_id;
  -- Retry must not reset the original request date or emit duplicate notifications.
  return jsonb_build_object('league_name',league.name,'request_status','pending');
end; $$;

create function public.get_my_entry_state() returns jsonb language sql security invoker set search_path='' as $$ select entry_private.state(); $$;
create function public.save_my_entry_profile(p_display_name text,p_gamertag text) returns jsonb language sql security invoker set search_path='' as $$ select entry_private.save_profile(p_display_name,p_gamertag); $$;
create function public.advance_my_entry(p_step integer,p_finish boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select entry_private.advance(p_step,p_finish); $$;
create function public.request_my_entry_league(p_code text) returns jsonb language sql security invoker set search_path='' as $$ select entry_private.request_league(p_code); $$;

create function entry_private.candidates(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.league_join_requests%rowtype; target_league_id uuid;
begin
  select id into target_league_id from public.leagues where slug=public.requested_league_slug();
  if auth.uid() is null or target_league_id is null or not private.has_league_capability(target_league_id,'league_admin') then
    raise exception using errcode='42501',message='MEMBER_LINK_DENIED'; end if;
  select * into r from public.league_join_requests where id=p_request_id and league_id=target_league_id and status='pending';
  if r.id is null then raise exception using errcode='P0002',message='Pending join request not found.'; end if;
  return coalesce((select jsonb_agg(item || jsonb_build_object('matched',exists(
    select 1 from public.driver_aliases personal where personal.driver_identity_id=r.driver_identity_id
      and personal.alias_type<>'display_name' and (personal.normalized_alias=lower(btrim(item->>'gamertag'))
        or exists(select 1 from public.driver_aliases da where da.driver_id=(item->>'id')::uuid
          and da.alias_type<>'display_name' and da.normalized_alias=personal.normalized_alias))
  ))) from jsonb_array_elements(public.get_linkable_league_drivers()) item),'[]'::jsonb);
end; $$;

create function entry_private.review(p_request_id uuid,p_decision text,p_driver_id uuid,p_create_driver boolean,p_admin_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target_league_id uuid; r public.league_join_requests%rowtype;
  di public.driver_identities%rowtype; driver_id uuid; clean_note text:=nullif(btrim(p_admin_note),'');
begin
  select id into target_league_id from public.leagues where slug=public.requested_league_slug();
  if actor is null or target_league_id is null or not private.has_league_capability(target_league_id,'league_admin') then
    raise exception using errcode='42501',message='MEMBER_LINK_DENIED'; end if;
  select * into r from public.league_join_requests where id=p_request_id and league_id=target_league_id for update;
  if r.id is null or r.status<>'pending' then raise exception using errcode='P0002',message='Pending join request not found.'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') or p_create_driver is null
    or (clean_note is not null and (char_length(clean_note)>500 or clean_note ~ '[<>]')) then
    raise exception using errcode='22023',message='Invalid decision.'; end if;
  if p_decision='approved' then
    if (p_driver_id is null and not p_create_driver) or (p_driver_id is not null and p_create_driver) then
      raise exception using errcode='22023',message='ENTRY_DRIVER_CHOICE_REQUIRED'; end if;
    insert into public.league_members(league_id,user_id,role) values(r.league_id,r.user_id,'driver')
      on conflict(league_id,user_id) do nothing;
    perform 1 from public.league_members where league_id=r.league_id and user_id=r.user_id for update;
    select * into di from public.driver_identities where id=r.driver_identity_id and user_id=r.user_id and status='active' for update;
    if di.id is null then raise exception using errcode='42501',message='Active identity required.'; end if;
    if p_create_driver then
      if di.display_name is null or di.gamertag is null then raise exception using errcode='22023',message='ENTRY_PROFILE_REQUIRED'; end if;
      insert into public.drivers(league_id,display_name,gamertag,real_name,nationality_code,is_active)
        values(r.league_id,di.display_name,di.gamertag,di.real_name,di.nationality_code,true) returning id into driver_id;
    else driver_id:=p_driver_id; end if;
    -- Established, concurrency-safe linking enforces one account per driver and one driver per league.
    perform public.link_league_member_driver(r.user_id,driver_id);
  end if;
  update public.league_join_requests set status=p_decision,reviewed_at=now(),reviewed_by=actor,admin_note=clean_note where id=r.id;
  insert into public.user_notifications(recipient_user_id,league_id,notification_kind,title_key,body_key,payload,dedupe_key)
    values(r.user_id,r.league_id,'system',
      case when p_decision='approved' then 'league.joinApproved.title' else 'league.joinRejected.title' end,
      case when p_decision='approved' then 'league.joinApproved.body' else 'league.joinRejected.body' end,
      jsonb_build_object('request_id',r.id,'decision',p_decision,'admin_note',clean_note),
      'league-join:'||r.id::text||':'||p_decision) on conflict(recipient_user_id,dedupe_key) do nothing;
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata)
    values('league',r.league_id,actor,'league.join_request.'||p_decision,'league_join_request',r.id,
      jsonb_build_object('user_id',r.user_id,'driver_id',driver_id,'explicit_choice',true));
  return jsonb_build_object('request_id',r.id,'status',p_decision,'driver_id',driver_id);
end; $$;
create function public.get_join_request_driver_candidates(p_request_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select entry_private.candidates(p_request_id); $$;
create function public.review_league_join_request_explicit(p_request_id uuid,p_decision text,p_driver_id uuid default null,p_create_driver boolean default false,p_admin_note text default null)
returns jsonb language sql security invoker set search_path='' as $$ select entry_private.review(p_request_id,p_decision,p_driver_id,p_create_driver,p_admin_note); $$;
-- Old browser sessions must not retain the unsafe first-name-match approval path.
create or replace function public.review_league_join_request(p_request_id uuid,p_decision text,p_admin_note text default null)
returns jsonb language sql security invoker set search_path='' as $$ select entry_private.review(p_request_id,p_decision,null,false,p_admin_note); $$;

revoke all on all functions in schema entry_private from public,anon,authenticated;
grant execute on function entry_private.state(),entry_private.save_profile(text,text),entry_private.advance(integer,boolean),entry_private.request_league(text),entry_private.candidates(uuid),entry_private.review(uuid,text,uuid,boolean,text) to authenticated;
revoke all on function public.get_my_entry_state(),public.save_my_entry_profile(text,text),public.advance_my_entry(integer,boolean),public.request_my_entry_league(text),public.get_join_request_driver_candidates(uuid),public.review_league_join_request_explicit(uuid,text,uuid,boolean,text),public.review_league_join_request(uuid,text,text) from public,anon,authenticated;
grant execute on function public.get_my_entry_state(),public.save_my_entry_profile(text,text),public.advance_my_entry(integer,boolean),public.request_my_entry_league(text),public.get_join_request_driver_candidates(uuid),public.review_league_join_request_explicit(uuid,text,uuid,boolean,text),public.review_league_join_request(uuid,text,text) to authenticated;
notify pgrst, 'reload schema';
