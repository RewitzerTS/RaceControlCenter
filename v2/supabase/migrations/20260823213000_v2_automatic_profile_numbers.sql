-- RaceVora V2: durable automatic profile numbers for every driver identity.

alter table public.driver_identities
  add column if not exists profile_number smallint;

with numbered_identities as (
  select id, ((row_number() over (order by created_at, id) - 1) % 100)::smallint as profile_number
  from public.driver_identities
  where profile_number is null
)
update public.driver_identities di
set profile_number = numbered_identities.profile_number
from numbered_identities
where di.id = numbered_identities.id;

alter table public.driver_identities
  alter column profile_number set not null;

alter table public.driver_identities
  add constraint driver_identities_profile_number_range_check
  check (profile_number between 0 and 99);

create or replace function private.assign_driver_profile_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_number is null then
    -- Serialize the short allocation query so simultaneous registrations are balanced.
    perform pg_catalog.pg_advisory_xact_lock(20260823, 99);

    select candidate.number::smallint
    into new.profile_number
    from pg_catalog.generate_series(0, 99) as candidate(number)
    left join public.driver_identities di
      on di.profile_number = candidate.number
    group by candidate.number
    order by count(di.id), candidate.number
    limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists assign_driver_profile_number on public.driver_identities;
create trigger assign_driver_profile_number
before insert on public.driver_identities
for each row execute function private.assign_driver_profile_number();

comment on column public.driver_identities.profile_number is
  'Persistent RaceVora profile number from 0 to 99. Values are balanced and may repeat after 100 identities.';
comment on function private.assign_driver_profile_number() is
  'Assigns the least-used RaceVora profile number from 0 to 99 when a driver identity is created.';
