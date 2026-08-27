-- Season completion must fail closed while a race or official result is open.

begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('f3200000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'season-guard@example.invalid', '{}', '{}', now(), now());

insert into public.leagues (id, name, slug)
values ('f3210000-0000-0000-0000-000000000001', 'Season Guard', 'season-guard');

insert into public.league_members (league_id, user_id, role)
values ('f3210000-0000-0000-0000-000000000001', 'f3200000-0000-0000-0000-000000000001', 'league_admin');

insert into public.seasons (id, league_id, slug, name, is_active, game_key, game_label)
values ('f3220000-0000-0000-0000-000000000001', 'f3210000-0000-0000-0000-000000000001', 'season-one', 'Season One', true, 'f1_26', 'F1 26');

insert into public.races (id, season_id, round_number, grand_prix_name, status)
values ('f3230000-0000-0000-0000-000000000001', 'f3220000-0000-0000-0000-000000000001', 1, 'Test Grand Prix', 'upcoming');

select set_config('request.headers', '{"x-rcc-league-slug":"season-guard"}', true);
select set_config('request.jwt.claims', '{"sub":"f3200000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  begin
    perform public.complete_league_season('f3220000-0000-0000-0000-000000000001');
    raise exception 'season completion accepted an upcoming race';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  if not (select is_active from public.seasons where id = 'f3220000-0000-0000-0000-000000000001') then
    raise exception 'blocked season completion still archived the season';
  end if;
end;
$$;

rollback;
