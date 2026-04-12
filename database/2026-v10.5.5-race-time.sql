alter table public.races
add column if not exists race_time text;

update public.races
set race_time = case
  when race_time is not null and race_time <> '' then race_time
  when cast(race_date as text) like '%T%' then substring(cast(race_date as text) from 12 for 5)
  else '20:00'
end
where race_time is null or race_time = '';
