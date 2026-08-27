-- Preserve self-service league creation while writing the immutable audit event
-- with the complete league scope required by the audit trigger.

create or replace function public.create_league(
  p_name text,
  p_slug text,
  p_is_public boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  created_league public.leagues%rowtype;
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_slug text := lower(btrim(coalesce(p_slug, '')));
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if char_length(normalized_name) not between 3 and 80 or normalized_name ~ '[<>]' then
    raise exception using errcode = '22023', message = 'League name must contain 3 to 80 safe characters.';
  end if;
  if char_length(normalized_slug) not between 3 and 50
     or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'League slug is invalid.';
  end if;
  if normalized_slug = any (array[
    'admin', 'api', 'app', 'auth', 'login', 'logout', 'signup', 'register',
    'support', 'help', 'www', 'racecontrolcenter', 'racevora'
  ]) then
    raise exception using errcode = '22023', message = 'This league slug is reserved.';
  end if;

  insert into public.leagues (name, slug, is_public, status, settings, created_by)
  values (
    normalized_name, normalized_slug, coalesce(p_is_public, true), 'active',
    jsonb_build_object('published', false, 'onboarding_complete', false, 'brand_name', normalized_name),
    actor_id
  )
  returning * into created_league;

  insert into public.league_members (league_id, user_id, role)
  values (created_league.id, actor_id, 'league_admin');

  insert into public.v2_audit_events (
    scope, league_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', created_league.id, actor_id, 'league.created', 'league', created_league.id,
    jsonb_build_object('slug', created_league.slug, 'is_public', created_league.is_public)
  );

  return jsonb_build_object(
    'id', created_league.id,
    'name', created_league.name,
    'slug', created_league.slug,
    'status', created_league.status,
    'is_public', created_league.is_public,
    'settings', created_league.settings,
    'role', 'league_admin'
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'League name or slug already exists.';
end;
$$;

revoke all on function public.create_league(text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.create_league(text, text, boolean)
  to authenticated, service_role;

comment on function public.create_league(text, text, boolean) is
  'Creates an isolated league for any authenticated driver and assigns the creator as league_admin.';
