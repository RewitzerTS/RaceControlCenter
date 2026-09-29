-- Matching hints, never identity proof. Existing results, links and XP remain untouched.
alter table public.driver_aliases add column platform text not null default 'other'
  check (platform in ('other', 'ea', 'playstation', 'xbox', 'steam'));

-- Explicitly reviewed duplicate profiles may share an import destination only.
-- No client writes: populated only after an owner confirms the exact pair.
create table profile_private.import_targets (
  driver_id uuid primary key references public.drivers(id),
  target_driver_id uuid not null references public.drivers(id),
  check (driver_id <> target_driver_id)
);
create index import_targets_target_idx on profile_private.import_targets(target_driver_id);
alter table profile_private.import_targets enable row level security;
revoke all on profile_private.import_targets from public, anon, authenticated;

create function profile_private.alias_subject(p_driver_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); subject uuid; league uuid;
begin
  if actor is null then raise exception using errcode='42501', message='Authentication required.'; end if;
  perform 1 from auth.users where id=actor and deleted_at is null and (banned_until is null or banned_until <= now()) for update;
  if not found then raise exception using errcode='42501', message='Active account required.'; end if;
  if p_driver_id is null then
    select id into subject from public.driver_identities where user_id=actor and status='active' for update;
  else
    league := private.roster_admin_league();
    select d.id into subject from public.drivers d where d.id=p_driver_id and d.league_id=league
      and private.result_participation_status(d.ai_driver_reference,null)='PLAYER' for update;
  end if;
  if subject is null then raise exception using errcode='42501', message='Driver profile access denied.'; end if;
  return subject;
end; $$;

create function profile_private.get_gamertags(p_driver_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare subject uuid := profile_private.alias_subject(p_driver_id); identity_id uuid; tag text;
begin
  if p_driver_id is null then
    identity_id := subject;
    select gamertag into tag from public.driver_identities where id=subject;
  else
    select dl.driver_identity_id into identity_id from public.driver_identity_links dl
      join public.driver_identities di on di.id=dl.driver_identity_id and di.status='active' where dl.driver_id=subject;
    select coalesce((select gamertag from public.driver_identities where id=identity_id),d.gamertag) into tag from public.drivers d where d.id=subject;
  end if;
  return jsonb_build_object('main',tag,'aliases',coalesce((select jsonb_agg(jsonb_build_object(
    'id',a.id,'alias',a.alias,'platform',a.platform,'editable',
    case when p_driver_id is null then a.driver_identity_id=subject else a.driver_id=subject end,
    'scope',case when a.driver_identity_id is null then 'league' else 'personal' end
  ) order by lower(a.alias)) from public.driver_aliases a
    where a.driver_identity_id=identity_id or (p_driver_id is not null and a.driver_id=subject)), '[]'::jsonb));
end; $$;

create function profile_private.add_gamertag(p_driver_id uuid,p_alias text,p_platform text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare subject uuid := profile_private.alias_subject(p_driver_id); clean text := btrim(p_alias); saved uuid;
begin
  if clean is null or char_length(clean) not between 2 and 60 or clean ~ '[<>[:cntrl:]]'
    or p_platform is null or p_platform not in ('other','ea','playstation','xbox','steam') then
    raise exception using errcode='22023', message='ALIAS_INVALID';
  end if;
  select id into saved from public.driver_aliases where normalized_alias=lower(clean)
    and case when p_driver_id is null then driver_identity_id=subject else driver_id=subject end;
  if saved is not null then raise exception using errcode='23505', message='ALIAS_DUPLICATE'; end if;
  if (select count(*) from public.driver_aliases where case when p_driver_id is null then driver_identity_id=subject else driver_id=subject end) >= 20 then
    raise exception using errcode='22023', message='ALIAS_LIMIT';
  end if;
  insert into public.driver_aliases(driver_identity_id,driver_id,alias,alias_type,platform)
    values(case when p_driver_id is null then subject end,case when p_driver_id is not null then subject end,clean,'gamertag',p_platform);
  return profile_private.get_gamertags(p_driver_id);
end; $$;

create function profile_private.remove_gamertag(p_driver_id uuid,p_alias_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare subject uuid := profile_private.alias_subject(p_driver_id);
begin
  delete from public.driver_aliases where id=p_alias_id
    and case when p_driver_id is null then driver_identity_id=subject else driver_id=subject end;
  if not found then raise exception using errcode='42501', message='Alias access denied.'; end if;
  return profile_private.get_gamertags(p_driver_id);
end; $$;

-- Keep the established workspace intact and enrich matching-only fields.
alter function public.get_league_driver_admin_workspace() set schema profile_private;
create function profile_private.driver_workspace() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare workspace jsonb := profile_private.get_league_driver_admin_workspace(); league uuid := (workspace->'league'->>'id')::uuid;
begin
  return jsonb_set(workspace,'{drivers}',coalesce((select jsonb_agg(item || jsonb_build_object(
    'import_driver_id',coalesce(target.id,d.id),
    'gamertag_aliases',coalesce((select jsonb_agg(distinct names.tag) from (
      select a.alias as tag from public.driver_aliases a where a.driver_id=d.id
      union all select a.alias from public.driver_identity_links dl join public.driver_identities di on di.id=dl.driver_identity_id and di.status='active'
        join public.driver_aliases a on a.driver_identity_id=di.id where dl.driver_id=d.id
      union all select di.gamertag from public.driver_identity_links dl join public.driver_identities di on di.id=dl.driver_identity_id and di.status='active' where dl.driver_id=d.id
    ) names where names.tag is not null),'[]'::jsonb)
  ) order by ord) from jsonb_array_elements(workspace->'drivers') with ordinality e(item,ord)
  join public.drivers d on d.id=(item->>'id')::uuid and d.league_id=league
  left join profile_private.import_targets it on it.driver_id=d.id
  left join public.drivers target on target.id=it.target_driver_id and target.league_id=league),'[]'::jsonb));
end; $$;

create function public.get_league_driver_admin_workspace() returns jsonb language sql stable security invoker set search_path='' as $$ select profile_private.driver_workspace(); $$;
create function public.get_driver_gamertags(p_driver_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select profile_private.get_gamertags(p_driver_id); $$;
create function public.add_driver_gamertag(p_alias text,p_platform text default 'other',p_driver_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select profile_private.add_gamertag(p_driver_id,p_alias,p_platform); $$;
create function public.remove_driver_gamertag(p_alias_id uuid,p_driver_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select profile_private.remove_gamertag(p_driver_id,p_alias_id); $$;

revoke all on function profile_private.alias_subject(uuid), profile_private.get_gamertags(uuid), profile_private.add_gamertag(uuid,text,text), profile_private.remove_gamertag(uuid,uuid), profile_private.driver_workspace(), profile_private.get_league_driver_admin_workspace() from public, anon, authenticated;
grant execute on function profile_private.get_gamertags(uuid), profile_private.add_gamertag(uuid,text,text), profile_private.remove_gamertag(uuid,uuid), profile_private.driver_workspace() to authenticated;
revoke all on function public.get_driver_gamertags(uuid), public.add_driver_gamertag(text,text,uuid), public.remove_driver_gamertag(uuid,uuid), public.get_league_driver_admin_workspace() from public, anon, authenticated;
grant execute on function public.get_driver_gamertags(uuid), public.add_driver_gamertag(text,text,uuid), public.remove_driver_gamertag(uuid,uuid), public.get_league_driver_admin_workspace() to authenticated;

-- Keep the previous canonical name available after a personal name change.
create function profile_private.keep_previous_gamertag() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.gamertag is distinct from new.gamertag and length(btrim(old.gamertag)) between 2 and 80 and old.gamertag !~ '[<>[:cntrl:]]' then
    insert into public.driver_aliases(driver_identity_id,alias,alias_type) values(old.id,btrim(old.gamertag),'gamertag') on conflict do nothing;
  end if;
  return new;
end; $$;
revoke all on function profile_private.keep_previous_gamertag() from public,anon,authenticated;
create trigger retain_previous_gamertag after update of gamertag on public.driver_identities for each row execute function profile_private.keep_previous_gamertag();
