-- New identities use their chosen public label for future compatibility records.
-- Existing labels remain immutable matching evidence; no existing rows are rewritten.
create or replace function profile_private.save_names(p_name text,p_public_name_mode text,p_revision text) returns jsonb
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
    display_name=coalesce(display_name,case p_public_name_mode when 'gamertag' then di.gamertag else clean_name end) where id=di.id;
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}')
    ||jsonb_build_object('real_name',clean_name,'public_name_mode',p_public_name_mode),updated_at=now() where id=actor;
  return profile_private.name_settings();
end; $$;


-- A newly linked identity must never inherit another account's public-name projection.
create or replace function profile_private.project_linked_name() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.drivers d set public_name=case di.public_name_mode
    when 'gamertag' then di.gamertag when 'name' then di.real_name else null end
    from public.driver_identities di where d.id=new.driver_id and di.id=new.driver_identity_id;
  return new;
end; $$;
notify pgrst,'reload schema';
