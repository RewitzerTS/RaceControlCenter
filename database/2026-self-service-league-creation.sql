-- Race Control Center - self-service league creation
-- Creates a league, its owner membership and default league content atomically.

create or replace function public.create_league(p_name text, p_slug text, p_is_public boolean default true)
returns table (id uuid, name text, slug text, is_public boolean, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_league_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(v_name) < 3 or char_length(v_name) > 80 then
    raise exception 'League name must be between 3 and 80 characters';
  end if;

  if char_length(v_slug) < 3 or char_length(v_slug) > 50 then
    raise exception 'League slug must be between 3 and 50 characters';
  end if;

  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'League slug may only contain lowercase letters, numbers and single hyphens';
  end if;

  if v_slug = any (array['admin','api','app','auth','login','logout','signup','register','support','help','www','racecontrolcenter']) then
    raise exception 'This league slug is reserved';
  end if;

  insert into public.leagues (name, slug, is_public, created_by)
  values (v_name, v_slug, coalesce(p_is_public, true), v_user_id)
  returning leagues.id into v_league_id;

  insert into public.league_members (league_id, user_id, role)
  values (v_league_id, v_user_id, 'owner');

  insert into public.league_content (league_id, id)
  values (v_league_id, 'default');

  return query
  select l.id, l.name, l.slug, l.is_public, 'owner'::text
  from public.leagues l
  where l.id = v_league_id;
exception
  when unique_violation then
    raise exception 'League slug already exists';
end;
$$;

revoke all on function public.create_league(text, text, boolean) from public;
grant execute on function public.create_league(text, text, boolean) to authenticated;
