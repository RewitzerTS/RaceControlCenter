-- Personal correction only. League drivers, identity links and racing history
-- are deliberately not changed; identity and Auth metadata commit together.
-- Dedicated non-exposed schema: do not grant access to the app's general private schema.
create schema profile_private;
revoke all on schema profile_private from public, anon, authenticated;
grant usage on schema profile_private to authenticated;

create or replace function profile_private.update_my_gamertag(p_gamertag text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  clean_tag text := btrim(coalesce(p_gamertag, ''), E' \t\n\r\f\v');
  identity_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if char_length(clean_tag) not between 2 and 60 or clean_tag ~ '[<>[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'Gamertag must contain 2 to 60 safe characters.';
  end if;

  -- Lock the account first, consistently with account removal. No caller-supplied ID.
  perform 1 from auth.users u where u.id = actor_id and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now()) for update;
  if not found then
    raise exception using errcode = '42501', message = 'Active account required.';
  end if;
  select di.id into identity_id from public.driver_identities di
    where di.user_id = actor_id and di.status = 'active' for update;
  if identity_id is null then
    raise exception using errcode = '42501', message = 'Active driver identity required.';
  end if;

  update public.driver_identities set gamertag = clean_tag where id = identity_id;
  update auth.users set
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('gamertag', clean_tag),
    updated_at = now()
  where id = actor_id;

  -- Aliases assist matching only; adding one never claims or links a league driver.
  insert into public.driver_aliases (driver_identity_id, alias, alias_type)
  select identity_id, clean_tag, 'gamertag'
  where not exists (select 1 from public.driver_aliases da
    where da.driver_identity_id = identity_id and da.normalized_alias = lower(clean_tag));
  return clean_tag;
end;
$$;

create or replace function public.update_my_gamertag(p_gamertag text)
returns text
language sql
security invoker
set search_path = ''
as $$ select profile_private.update_my_gamertag(p_gamertag); $$;

revoke all on function profile_private.update_my_gamertag(text) from public, anon, authenticated;
revoke all on function public.update_my_gamertag(text) from public, anon, authenticated;
grant execute on function profile_private.update_my_gamertag(text) to authenticated;
grant execute on function public.update_my_gamertag(text) to authenticated;
comment on function public.update_my_gamertag(text) is
  'Corrects only the authenticated active user''s personal gamertag and matching metadata atomically. Does not change driver links, league drivers or results.';
