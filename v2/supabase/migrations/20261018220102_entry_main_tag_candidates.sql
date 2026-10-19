-- The primary gamertag is a matching hint even when the shared alias row is
-- classified as display_name. Hints never create a link or preselect a driver.
create or replace function entry_private.candidates(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.league_join_requests%rowtype; target_league_id uuid;
begin
  select id into target_league_id from public.leagues where slug=public.requested_league_slug();
  if auth.uid() is null or target_league_id is null or not private.has_league_capability(target_league_id,'league_admin') then
    raise exception using errcode='42501',message='MEMBER_LINK_DENIED'; end if;
  select * into r from public.league_join_requests where id=p_request_id and league_id=target_league_id and status='pending';
  if r.id is null then raise exception using errcode='P0002',message='Pending join request not found.'; end if;
  return coalesce((select jsonb_agg(item || jsonb_build_object('matched',exists(
    select 1 from (
      select lower(btrim(di.gamertag)) as tag from public.driver_identities di where di.id=r.driver_identity_id and di.gamertag is not null
      union select personal.normalized_alias from public.driver_aliases personal
        where personal.driver_identity_id=r.driver_identity_id and personal.alias_type<>'display_name'
    ) names where names.tag=lower(btrim(item->>'gamertag'))
      or exists(select 1 from public.driver_aliases da where da.driver_id=(item->>'id')::uuid
        and da.alias_type<>'display_name' and da.normalized_alias=names.tag)
  ))) from jsonb_array_elements(public.get_linkable_league_drivers()) item),'[]'::jsonb);
end; $$;
revoke all on function entry_private.candidates(uuid) from public,anon;
grant execute on function entry_private.candidates(uuid) to authenticated;
