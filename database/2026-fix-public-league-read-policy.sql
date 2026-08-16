-- Regression fix after removing anonymous EXECUTE from is_league_member().
-- Public league reads must not invoke an authenticated-only helper. Private
-- member access remains covered by the separate authenticated membership policy.

begin;

drop policy if exists "public read published public leagues" on public.leagues;
create policy "public read published public leagues"
on public.leagues
for select
to anon, authenticated
using (
  is_public = true
  and coalesce((settings ->> 'published')::boolean, true) = true
  and slug = public.requested_league_slug()
);

commit;
