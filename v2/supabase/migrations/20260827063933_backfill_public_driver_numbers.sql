-- RaceVora V2: ensure every public league driver profile has a visible number.

with candidate_usage as (
  select
    l.id as league_id,
    candidate.number,
    row_number() over (
      partition by l.id
      order by
        count(d.id),
        pg_catalog.md5(l.id::text || ':' || candidate.number::text)
    ) as candidate_rank
  from public.leagues l
  cross join pg_catalog.generate_series(0, 99) as candidate(number)
  left join public.drivers d
    on d.league_id = l.id
   and d.number = candidate.number
  group by l.id, candidate.number
),
missing_drivers as (
  select
    d.id,
    d.league_id,
    row_number() over (
      partition by d.league_id
      order by pg_catalog.md5(d.id::text)
    ) as missing_rank
  from public.drivers d
  where d.number is null
),
assigned_numbers as (
  select missing.id, candidates.number
  from missing_drivers missing
  join candidate_usage candidates
    on candidates.league_id = missing.league_id
   and candidates.candidate_rank = ((missing.missing_rank - 1) % 100) + 1
)
update public.drivers d
set number = assigned.number
from assigned_numbers assigned
where d.id = assigned.id
  and d.number is null;

create or replace function private.assign_driver_start_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.number is null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.league_id::text, 20260824)
    );

    select candidate.number
    into new.number
    from pg_catalog.generate_series(0, 99) as candidate(number)
    left join public.drivers d
      on d.league_id = new.league_id
     and d.number = candidate.number
    group by candidate.number
    order by
      count(d.id),
      pg_catalog.md5(new.league_id::text || ':' || candidate.number::text)
    limit 1;
  end if;

  return new;
end;
$$;

revoke all on function private.assign_driver_start_number()
  from public, anon, authenticated, service_role;

drop trigger if exists drivers_assign_start_number_before_insert on public.drivers;
create trigger drivers_assign_start_number_before_insert
before insert on public.drivers
for each row execute function private.assign_driver_start_number();

comment on function private.assign_driver_start_number() is
  'Assigns a stable pseudo-random least-used public driver number from 0 to 99 within a league when no explicit start number was supplied.';
