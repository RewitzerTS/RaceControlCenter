-- Prevent unsafe or invalid tenant identity values at the database boundary.
alter table public.leagues
  add constraint leagues_name_length check (char_length(name) between 3 and 80),
  add constraint leagues_name_no_markup check (name !~ '[<>]'),
  add constraint leagues_slug_length check (char_length(slug) between 3 and 50);
