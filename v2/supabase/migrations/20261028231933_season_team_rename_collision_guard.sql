do $patch$
declare body text; needle text;
begin
 body:=pg_get_functiondef('league_roster_private.rename_team(text,text,integer,text)'::regprocedure);
 needle:='  insert into league_roster_private.teams(league_id,name)';
 if position(needle in body)=0 then raise exception 'Unexpected rename contract'; end if;
 body:=replace(body,needle,
 '  if exists(select 1 from league_roster_private.teams t where t.league_id=lid and t.name<>p_key_name and lower(t.name)=lower(clean)) then raise exception using errcode=''23505'',message=''TEAM_NAME_EXISTS''; end if;'||chr(10)||needle);
 execute body;
end; $patch$;
