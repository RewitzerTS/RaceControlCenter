-- Verified historical labels, separate from immutable results and scoring.
create table league_roster_private.confirmed_team_history (
  season_id uuid not null references public.seasons(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  effective_round_number integer not null default 1 check (effective_round_number > 0),
  team_name text not null check (length(btrim(team_name)) between 1 and 120),
  car_name text,
  evidence text not null check (length(btrim(evidence)) >= 10),
  created_at timestamptz not null default now(),
  primary key(season_id,driver_id,effective_round_number)
);
alter table league_roster_private.confirmed_team_history enable row level security;
revoke all on league_roster_private.confirmed_team_history from public,anon,authenticated;
grant select,insert,update,delete on league_roster_private.confirmed_team_history to service_role;

create function league_roster_private.read_team_history()
returns table(season_id uuid,driver_id uuid,team_name text,car_name text,effective_round_number integer,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='LEAGUE_ACCESS_REQUIRED'; end if;
  return query
  select h.season_id,h.driver_id,h.team_name,h.car_name,h.effective_round_number,h.created_at
    from league_roster_private.confirmed_team_history h
    join public.seasons s on s.id=h.season_id
    join public.drivers d on d.id=h.driver_id and d.league_id=s.league_id
    where public.matches_requested_league(s.league_id)
  union all
  select a.season_id,a.driver_id,a.team_name,a.car_name,a.effective_from_round,a.created_at
    from private.season_vehicle_assignments a
    join public.seasons s on s.id=a.season_id
    join public.drivers d on d.id=a.driver_id and d.league_id=s.league_id
    where public.matches_requested_league(s.league_id);
end $$;
create function public.get_league_team_history()
returns table(season_id uuid,driver_id uuid,team_name text,car_name text,effective_round_number integer,created_at timestamptz)
language sql stable security invoker set search_path='' as $$ select * from league_roster_private.read_team_history(); $$;
revoke all on function league_roster_private.read_team_history(),public.get_league_team_history() from public,anon,authenticated,service_role;
grant execute on function league_roster_private.read_team_history(),public.get_league_team_history() to authenticated;

-- These notifications carry only a route and reference, never private evidence.
create function private.notify_new_join_request() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='pending' then
    insert into public.user_notifications(recipient_user_id,league_id,notification_kind,title_key,body_key,payload,dedupe_key)
    select lm.user_id,new.league_id,'system','notification.joinRequested.title','notification.joinRequested.body',
      jsonb_build_object('event_type','league.join_requested','league_slug',l.slug), 'join-request:'||new.id
    from public.league_members lm join public.leagues l on l.id=lm.league_id
    where lm.league_id=new.league_id and lm.role='league_admin'
    on conflict(recipient_user_id,dedupe_key) do nothing;
  end if;
  return new;
end $$;
create trigger notify_new_join_request after insert on public.league_join_requests
for each row execute function private.notify_new_join_request();

create function private.notify_new_steward_case() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.user_notifications(recipient_user_id,league_id,notification_kind,title_key,body_key,payload,dedupe_key)
  select lm.user_id,new.league_id,'system','notification.stewardOpened.title','notification.stewardOpened.body',
    jsonb_build_object('event_type','steward.case_opened','case_number',new.case_number,'league_slug',l.slug), 'steward-opened:'||new.id
  from public.league_members lm join public.leagues l on l.id=lm.league_id
  where lm.league_id=new.league_id and lm.role in ('league_admin','steward')
  on conflict(recipient_user_id,dedupe_key) do nothing;
  return new;
end $$;
create trigger notify_new_steward_case after insert on public.steward_cases
for each row execute function private.notify_new_steward_case();

create function private.notify_level_up() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.level > old.level then
    insert into public.user_notifications(recipient_user_id,notification_kind,title_key,body_key,payload,dedupe_key)
    select di.user_id,'career_moment','notification.levelUp.title','notification.levelUp.body',
      jsonb_build_object('event_type','career.level_up','level',new.level),'level-up:'||di.id||':'||new.level
    from public.driver_identities di where di.id=new.driver_identity_id and di.user_id is not null and di.status='active'
    on conflict(recipient_user_id,dedupe_key) do nothing;
  end if;
  return new;
end $$;
create trigger notify_level_up after update of level on public.driver_progression
for each row execute function private.notify_level_up();
revoke all on function private.notify_new_join_request(),private.notify_new_steward_case(),private.notify_level_up() from public,anon,authenticated,service_role;

-- Existing still-pending requests also need a visible inbox entry, once.
insert into public.user_notifications(recipient_user_id,league_id,notification_kind,title_key,body_key,payload,dedupe_key)
select lm.user_id,r.league_id,'system','notification.joinRequested.title','notification.joinRequested.body',
  jsonb_build_object('event_type','league.join_requested','league_slug',l.slug), 'join-request:'||r.id
from public.league_join_requests r join public.league_members lm on lm.league_id=r.league_id and lm.role='league_admin'
join public.leagues l on l.id=r.league_id where r.status='pending'
on conflict(recipient_user_id,dedupe_key) do nothing;
