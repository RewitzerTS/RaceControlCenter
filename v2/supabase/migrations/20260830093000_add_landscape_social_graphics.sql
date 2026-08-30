-- Add the 16:9 landscape export format to existing V2 environments.

alter table public.social_graphic_renders
  drop constraint if exists social_graphic_format_check;

alter table public.social_graphic_renders
  add constraint social_graphic_format_check
  check (graphic_format in ('square', 'portrait', 'story', 'landscape'));

comment on constraint social_graphic_format_check on public.social_graphic_renders is
  'Supported deterministic Social Graphics export formats, including 16:9 landscape.';
