create or replace function public.create_next_league_season(
  p_league_id uuid,
  p_game_key text default 'f1_25',
  p_game_label text default 'F1 25'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_next integer;
  v_season public.seasons%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select lm.role into v_role from public.league_members lm where lm.league_id=p_league_id and lm.user_id=v_user;
  if v_role not in ('owner','admin') then raise exception 'Owner or admin role required'; end if;
  if exists(select 1 from public.seasons s where s.league_id=p_league_id and s.is_active=true) then raise exception 'League already has an active season'; end if;
  select coalesce(max((regexp_match(coalesce(s.name,''),'([0-9]+)'))[1]::integer),0)+1 into v_next from public.seasons s where s.league_id=p_league_id;
  insert into public.seasons(league_id,name,is_active,game_key,game_label)
  values(p_league_id,'Saison '||v_next,true,coalesce(nullif(trim(p_game_key),''),'f1_25'),coalesce(nullif(trim(p_game_label),''),'F1 25'))
  returning * into v_season;
  return jsonb_build_object('ok',true,'id',v_season.id,'name',v_season.name,'league_id',v_season.league_id,'game_key',v_season.game_key,'game_label',v_season.game_label);
end;
$$;
revoke execute on function public.create_next_league_season(uuid,text,text) from public,anon;
grant execute on function public.create_next_league_season(uuid,text,text) to authenticated;
