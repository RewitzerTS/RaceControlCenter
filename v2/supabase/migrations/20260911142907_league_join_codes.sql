-- Join codes are public identifiers, not credentials. Membership approval is unchanged.
create schema league_join_codes;
revoke all on schema league_join_codes from public, anon, authenticated;
grant usage on schema league_join_codes to authenticated;
create sequence league_join_codes.code_sequence minvalue 10000 maxvalue 99999 start 10000 no cycle;
alter table public.leagues add column join_code text;

create function league_join_codes.assign_code() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(191109, 5);
  if tg_op = 'UPDATE' and old.join_code is not null and new.join_code is distinct from old.join_code then
    raise exception 'League join codes cannot be changed.';
  end if;
  if exists(select 1 from public.leagues l where l.join_code = new.slug and l.id <> new.id) then
    raise exception 'This league slug is already a join code.';
  end if;
  if tg_op = 'INSERT' or new.join_code is null then
    loop
      new.join_code := nextval('league_join_codes.code_sequence'::regclass)::text;
      exit when not exists(select 1 from public.leagues l where l.slug = new.join_code or l.join_code = new.join_code)
        and new.slug is distinct from new.join_code;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function league_join_codes.assign_code() from public, anon, authenticated, service_role;
create trigger assign_league_join_code before insert or update of join_code, slug on public.leagues
for each row execute function league_join_codes.assign_code();
update public.leagues set join_code = null where join_code is null;
alter table public.leagues alter column join_code set not null;
alter table public.leagues add constraint leagues_join_code_format check (join_code ~ '^[0-9]{5}$');
alter table public.leagues add constraint leagues_join_code_unique unique (join_code);

create function league_join_codes.submit(
  p_display_name text, p_gamertag text, p_real_name text default null,
  p_nationality_code text default null, p_league_identifier text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare identifier text := nullif(lower(btrim(p_league_identifier)), ''); resolved_id uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;
  if identifier ~ '^[0-9]{5}$' then
    select l.id into resolved_id from public.leagues l where l.join_code = identifier and l.status = 'active';
    if resolved_id is not null then identifier := resolved_id::text; end if;
  end if;
  return public.complete_driver_onboarding(p_display_name, p_gamertag, p_real_name, p_nationality_code, identifier);
end;
$$;
create function league_join_codes.current_code() returns text
language plpgsql stable security definer set search_path = '' as $$
declare target public.leagues%rowtype;
begin
  select l.* into target from public.leagues l where l.slug = public.requested_league_slug();
  if auth.uid() is null or target.id is null or not private.has_league_capability(target.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League administration access required.';
  end if;
  return target.join_code;
end;
$$;
create function public.complete_driver_onboarding_with_code(
  p_display_name text, p_gamertag text, p_real_name text default null,
  p_nationality_code text default null, p_league_identifier text default null
) returns jsonb language sql security invoker set search_path = '' as $$
  select league_join_codes.submit(p_display_name, p_gamertag, p_real_name, p_nationality_code, p_league_identifier);
$$;
create function public.get_current_league_join_code() returns text
language sql stable security invoker set search_path = '' as $$ select league_join_codes.current_code(); $$;
revoke all on function league_join_codes.submit(text,text,text,text,text), league_join_codes.current_code(),
  public.complete_driver_onboarding_with_code(text,text,text,text,text), public.get_current_league_join_code()
  from public, anon, authenticated, service_role;
grant execute on function league_join_codes.submit(text,text,text,text,text), league_join_codes.current_code(),
  public.complete_driver_onboarding_with_code(text,text,text,text,text), public.get_current_league_join_code() to authenticated;
