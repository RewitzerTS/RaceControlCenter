-- Read-only WM inheritance. Published results, career, XP and team scores are
-- deliberately untouched. Keep the same access boundary as the roster endpoint.
create function league_roster_private.championship_ai_assignments(p_season_id uuid)
returns table(human_driver_id uuid, ai_driver_id uuid, effective_from_round integer, effective_to_round integer)
language plpgsql stable security definer set search_path='' as $$
declare lid uuid; view_round integer;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='LEAGUE_ACCESS_REQUIRED'; end if;
  select s.league_id into lid from public.seasons s where s.id=p_season_id;
  if lid is null or not public.matches_requested_league(lid) then
    raise exception using errcode='42501',message='LEAGUE_ACCESS_REQUIRED';
  end if;
  select coalesce(min(r.round_number) filter(where r.status='upcoming'),max(r.round_number),1)
    into view_round from public.races r where r.season_id=p_season_id;
  return query select a.human_driver_id,a.ai_driver_id,a.effective_from_round,a.effective_to_round
    from private.season_driver_ai_assignments a
    join public.drivers h on h.id=a.human_driver_id and h.league_id=lid
    join public.drivers bot on bot.id=a.ai_driver_id and bot.league_id=lid
    where a.season_id=p_season_id and a.effective_from_round<=view_round
      and private.result_participation_status(h.ai_driver_reference,null)='PLAYER'
      and private.result_participation_status(bot.ai_driver_reference,null)<>'PLAYER'
    order by a.ai_driver_id,a.effective_from_round;
end; $$;

create function public.get_season_championship_ai_assignments(p_season_id uuid)
returns table(human_driver_id uuid, ai_driver_id uuid, effective_from_round integer, effective_to_round integer)
language sql stable security invoker set search_path='' as $$
  select * from league_roster_private.championship_ai_assignments(p_season_id);
$$;
revoke all on function league_roster_private.championship_ai_assignments(uuid),
  public.get_season_championship_ai_assignments(uuid) from public,anon,authenticated,service_role;
grant execute on function league_roster_private.championship_ai_assignments(uuid),
  public.get_season_championship_ai_assignments(uuid) to authenticated;
comment on function public.get_season_championship_ai_assignments(uuid) is
  'Season-scoped effective AI-to-human WM inheritance, including ended assignments. Read-only; no historical results, career statistics or team points are rewritten.';
