-- A season display name never changes a team's identity, assignments or results.
create table public.season_team_labels (
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references league_roster_private.teams(id) on delete restrict,
  key_name text not null,
  display_name text not null check(length(display_name) between 2 and 80 and display_name=btrim(display_name) and display_name !~ '[<>[:cntrl:]]'),
  primary key(season_id,team_id), unique(season_id,key_name)
);
create unique index season_team_labels_display_unique on public.season_team_labels(season_id,lower(display_name));
create index season_team_labels_team_idx on public.season_team_labels(team_id);
alter table public.season_team_labels enable row level security;
revoke all on public.season_team_labels from public,anon,authenticated;
grant select on public.season_team_labels to anon,authenticated;
create policy "read labels of visible requested seasons" on public.season_team_labels for select to anon,authenticated
  using(exists(select 1 from public.seasons s where s.id=season_id and public.matches_requested_league(s.league_id)));
create function public.get_league_team_labels()
returns table(season_id uuid,team_id uuid,key_name text,display_name text)
language sql stable security invoker set search_path='' as $$
  select l.season_id,l.team_id,l.key_name,l.display_name from public.season_team_labels l order by l.season_id,l.team_id;
$$;
revoke all on function public.get_league_team_labels() from public,anon,authenticated;
grant execute on function public.get_league_team_labels() to anon,authenticated;

alter function league_roster_private.team_manager(text,integer) rename to team_manager_before_labels;
create function league_roster_private.team_manager(p_mode text,p_round integer default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare state jsonb:=league_roster_private.team_manager_before_labels(p_mode,p_round); sid uuid:=(state->'season'->>'id')::uuid;
begin
  state:=jsonb_set(state,'{teams}',coalesce((select jsonb_agg(t||jsonb_build_object('display_name',coalesce(l.display_name,t->>'name')) order by coalesce(l.display_name,t->>'name'))
    from jsonb_array_elements(state->'teams') t left join public.season_team_labels l on l.season_id=sid and l.key_name=t->>'name'),'[]'));
  state:=jsonb_set(state,'{profiles}',coalesce((select jsonb_agg(p||jsonb_build_object('display_name',coalesce(d.public_name,d.display_name,p->>'display_name'),'team_display_name',coalesce(l.display_name,p->>'team_name')) order by (p->>'is_ai')::boolean,coalesce(d.public_name,d.display_name,p->>'display_name'))
    from jsonb_array_elements(state->'profiles') p left join public.drivers d on d.id=(p->>'id')::uuid
    left join public.season_team_labels l on l.season_id=sid and l.key_name=p->>'team_name'),'[]'));
  return state||jsonb_build_object('revision',md5(state::text));
end; $$;
create or replace function public.get_league_team_manager(p_mode text,p_round integer default null) returns jsonb
language sql stable security invoker set search_path='' as $$ select league_roster_private.team_manager(p_mode,p_round); $$;
revoke all on function league_roster_private.team_manager_before_labels(text,integer),league_roster_private.team_manager(text,integer) from public,anon,authenticated;
grant execute on function league_roster_private.team_manager(text,integer) to authenticated;

create function league_roster_private.rename_team(p_key_name text,p_display_name text,p_round integer,p_revision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lid uuid:=private.roster_admin_league(); sid uuid; tid uuid; state jsonb; clean text:=btrim(p_display_name);
begin
  perform 1 from public.leagues where id=lid for update;
  select id into sid from public.seasons where league_id=lid and is_active order by created_at desc limit 1 for update;
  state:=league_roster_private.team_manager('current',p_round);
  if sid is null or not exists(select 1 from jsonb_array_elements(state->'teams') t where t->>'name'=p_key_name) then raise exception using errcode='22023',message='TEAM_NOT_FOUND'; end if;
  if p_revision is distinct from state->>'revision' then raise exception using errcode='40001',message='TEAM_STATE_CHANGED'; end if;
  if clean is null or length(clean) not between 2 and 80 or clean ~ '[<>[:cntrl:]]' then raise exception using errcode='22023',message='TEAM_NAME_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements(state->'teams') t where t->>'name'<>p_key_name and (lower(t->>'name')=lower(clean) or lower(t->>'display_name')=lower(clean))) then raise exception using errcode='23505',message='TEAM_NAME_EXISTS'; end if;
  insert into league_roster_private.teams(league_id,name) values(lid,p_key_name) on conflict do nothing;
  select id into tid from league_roster_private.teams where league_id=lid and name=p_key_name;
  insert into public.season_team_labels(season_id,team_id,key_name,display_name) values(sid,tid,p_key_name,clean)
    on conflict(season_id,team_id) do update set display_name=excluded.display_name;
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata)
    values('league',lid,auth.uid(),'league_team.renamed','team',tid,jsonb_build_object('season_id',sid,'key_name',p_key_name,'display_name',clean));
  return league_roster_private.team_manager('current',p_round);
end; $$;
create function public.rename_league_season_team(p_key_name text,p_display_name text,p_round integer,p_revision text) returns jsonb
language sql security invoker set search_path='' as $$ select league_roster_private.rename_team(p_key_name,p_display_name,p_round,p_revision); $$;
revoke all on function league_roster_private.rename_team(text,text,integer,text),public.rename_league_season_team(text,text,integer,text) from public,anon,authenticated;
grant execute on function league_roster_private.rename_team(text,text,integer,text),public.rename_league_season_team(text,text,integer,text) to authenticated;

-- Old clients cannot accidentally create another team through a rename.
alter function league_roster_private.save_team_lineup(text,integer,text,text,uuid[],jsonb,text) rename to save_team_lineup_before_labels;
create function league_roster_private.save_team_lineup(p_mode text,p_round integer,p_original_name text,p_name text,p_driver_ids uuid[],p_departures jsonb,p_revision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lid uuid:=private.roster_admin_league(); sid uuid;
begin
  perform 1 from public.leagues where id=lid for update;
  select id into sid from public.seasons where league_id=lid and is_active order by created_at desc limit 1;
  if p_original_name is not null and btrim(p_name) is distinct from p_original_name then raise exception using errcode='22023',message='TEAM_RENAME_SEPARATELY'; end if;
  if p_original_name is null and exists(select 1 from public.season_team_labels where season_id=sid and lower(display_name)=lower(btrim(p_name))) then raise exception using errcode='23505',message='TEAM_NAME_EXISTS'; end if;
  return league_roster_private.save_team_lineup_before_labels(p_mode,p_round,p_original_name,p_name,p_driver_ids,p_departures,p_revision);
end; $$;
create or replace function public.save_league_team_lineup(p_mode text,p_round integer,p_original_name text,p_name text,p_driver_ids uuid[],p_departures jsonb,p_revision text) returns jsonb
language sql security invoker set search_path='' as $$ select league_roster_private.save_team_lineup(p_mode,p_round,p_original_name,p_name,p_driver_ids,p_departures,p_revision); $$;
revoke all on function league_roster_private.save_team_lineup_before_labels(text,integer,text,text,uuid[],jsonb,text),league_roster_private.save_team_lineup(text,integer,text,text,uuid[],jsonb,text) from public,anon,authenticated;
grant execute on function league_roster_private.save_team_lineup(text,integer,text,text,uuid[],jsonb,text) to authenticated;

create function league_roster_private.team_label(p_season_id uuid,p_key text) returns text
language sql stable security invoker set search_path='' as $$
  select coalesce((select display_name from public.season_team_labels where season_id=p_season_id and key_name=p_key),p_key);
$$;
revoke all on function league_roster_private.team_label(uuid,text) from public,anon,authenticated;
-- Protected server-side graphics/standings must aggregate the same season labels.
do $patch$
declare body text; needle text; changed text;
begin
  body:=pg_get_functiondef('public.get_social_graphics_workspace()'::regprocedure);
  needle:='coalesce(rvr.points_team_name, rvr.car_name_snapshot, d.league_team, ''Independent'')';
  if position(needle in body)=0 then raise exception 'Unexpected graphics standings contract'; end if;
  changed:=replace(body,needle,'league_roster_private.team_label(r.season_id,'||needle||')');
  execute changed;
  body:=pg_get_functiondef('public.get_league_race_admin_workspace()'::regprocedure);
  needle:='coalesce(nullif(rr.points_team_name, ''''), nullif(d.league_team, ''''), ''Ohne Team'')';
  if position(needle in body)=0 then raise exception 'Unexpected admin standings contract'; end if;
  execute replace(body,needle,'league_roster_private.team_label(r.season_id,'||needle||')');
end; $patch$;
