-- League join request status must remain actor-bound and expose only safe labels.

begin;

do $$
begin
  if has_function_privilege('anon', 'public.get_my_league_join_requests()', 'execute') then
    raise exception 'anonymous users can read league join request status';
  end if;
  if not has_function_privilege('authenticated', 'public.get_my_league_join_requests()', 'execute') then
    raise exception 'authenticated users cannot read their own league join request status';
  end if;
end;
$$;

do $$
declare
  source text := pg_get_functiondef('public.get_my_league_join_requests()'::regprocedure);
begin
  if source not like '%request.user_id = actor_id%'
     or source not like '%auth.uid()%'
     or source like '%admin_note%'
     or source like '%reviewed_by%' then
    raise exception 'league join request status is not safely actor-bound';
  end if;
end;
$$;

rollback;
