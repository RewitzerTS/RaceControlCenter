do $patch$
declare body text;
begin
 body:=pg_get_functiondef('public.get_social_graphics_workspace()'::regprocedure);
 body:=replace(body,'league_roster_private.team_label(r.season_id,','league_roster_private.team_label(target_season.id,');
 execute body;
end; $patch$;
