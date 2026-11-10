begin;
do $$ declare body text; begin
  body:=pg_get_functiondef('race_control_private.annul_league_race(uuid,uuid,timestamptz,text)'::regprocedure);
  if strpos(body,'annul_league_race.event_id')=0 then raise exception 'Processing check anchor missing'; end if;
  body:=replace(body,E'\ndeclare',E'\n<<annulment>>\ndeclare');
  execute replace(body,'annul_league_race.event_id','annulment.event_id');
end $$;
commit;
