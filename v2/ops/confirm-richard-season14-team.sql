-- Pending Production approval. Run only after racing_history_and_inbox_events is deployed.
-- The owner confirmed Richard drove all 24 Season 14 races for Safety Car Specialists.
-- This adds a display-history assertion; it never rewrites race results, XP or scoring.
begin;
do $$
declare
 target_driver uuid:='2872a0d7-6eef-4d0b-b80f-0e6e6d7ac0af';
 target_season uuid:='d34f3fbb-4610-4f46-a448-56d3f8c649c7';
 starts integer;
begin
 if not exists(select 1 from public.drivers d join public.seasons s on s.league_id=d.league_id
   join public.leagues l on l.id=s.league_id
   where d.id=target_driver and s.id=target_season and d.display_name='Richard'
     and s.name='14' and l.id='0db0e6b7-a29c-461f-9e89-fc011d8ecfaf')
 then raise exception 'Historical repair target mismatch'; end if;
 select count(*) into starts from public.race_results rr join public.races r
   on r.id=rr.race_id and r.current_result_version_id=rr.result_version_id
   where r.season_id=target_season and rr.driver_id=target_driver;
 if starts<>24 then raise exception 'Expected exactly 24 official starts, found %',starts; end if;
 if exists(select 1 from public.race_results rr join public.races r
   on r.id=rr.race_id and r.current_result_version_id=rr.result_version_id
   where r.season_id=target_season and rr.driver_id=target_driver and rr.points_team_name is not null
   and rr.points_team_name<>'Safety Car Specialists')
 then raise exception 'Conflicting published team evidence; review instead of overwriting'; end if;
 insert into league_roster_private.confirmed_team_history(season_id,driver_id,effective_round_number,team_name,evidence)
 values(target_season,target_driver,1,'Safety Car Specialists','Platform owner explicitly confirmed 24 Season 14 starts for Safety Car Specialists in the RaceVora task, 2026-10-05.')
 on conflict do nothing;
 if not exists(select 1 from league_roster_private.confirmed_team_history
   where season_id=target_season and driver_id=target_driver and effective_round_number=1 and team_name='Safety Car Specialists')
 then raise exception 'Conflicting historical assertion; review required'; end if;
end $$;
commit;
