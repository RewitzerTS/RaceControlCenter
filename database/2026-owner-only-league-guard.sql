-- RaceVora owner-only league guard
-- Supabase production migration: 20260819165427 owner_only_league_slug_guard
--
-- Leagues marked with settings.owner_only=true must not become readable merely
-- because a caller knows and supplies the league slug. Existing public/private
-- league behavior remains unchanged for leagues without the owner_only flag.

create or replace function public.matches_requested_league(p_league_id uuid)
returns boolean
language sql
stable
set search_path = 'public'
as $function$
  select exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.slug = public.requested_league_slug()
      and (l.settings ->> 'owner_only') is distinct from 'true'
  );
$function$;
