-- Structured Steward consequences + private per-member track notes.
-- This migration does not change any existing RCC business rows.

begin;

alter table public.race_penalties
  add column if not exists grid_positions integer not null default 0;

alter table public.race_penalties
  drop constraint if exists race_penalties_type_check;

alter table public.race_penalties
  add constraint race_penalties_type_check
  check (penalty_type = any (array[
    'time_penalty'::text,
    'time_credit'::text,
    'points_penalty'::text,
    'warning'::text,
    'grid_penalty'::text,
    'dsq'::text
  ]));

alter table public.race_penalties
  drop constraint if exists race_penalties_grid_positions_check;

alter table public.race_penalties
  add constraint race_penalties_grid_positions_check
  check (
    (penalty_type = 'grid_penalty' and grid_positions > 0)
    or (penalty_type <> 'grid_penalty' and grid_positions >= 0)
  );

create index if not exists race_penalties_effective_race_type_idx
  on public.race_penalties (race_id, penalty_type, driver_id);

-- DSQ is deliberately represented as a very large time delta in the browser
-- scoring pipeline so every non-DSQ driver is promoted and rescored normally.
-- This function then marks the driver as DSQ and removes all awarded points.
create or replace function public.apply_race_dsq_penalties(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select s.league_id
    into v_league_id
  from public.races r
  join public.seasons s on s.id = r.season_id
  where r.id = p_race_id;

  if v_league_id is null then
    raise exception 'Race not found';
  end if;

  if not public.matches_requested_league(v_league_id) then
    raise exception 'Race is outside requested tenant context';
  end if;

  if not public.has_league_role(v_league_id, array['owner','admin','steward'])
     and not public.is_platform_owner() then
    raise exception 'Insufficient league role';
  end if;

  -- Never mutate the public live result while an unpublished work version exists.
  if exists (
    select 1
    from public.race_result_imports ri
    where ri.race_id = p_race_id
      and ri.status in ('draft','under_review')
  ) then
    raise exception 'Open result draft exists';
  end if;

  update public.race_results rr
  set participation_status = 'DSQ',
      race_time = 'DSQ',
      race_time_ms = null,
      awarded_points = 0,
      points = 0,
      updated_at = now()
  where rr.race_id = p_race_id
    and exists (
      select 1
      from public.race_penalties rp
      where rp.race_id = rr.race_id
        and rp.driver_id = rr.driver_id
        and rp.penalty_type = 'dsq'
    );
end;
$$;

revoke all on function public.apply_race_dsq_penalties(uuid) from public;
revoke all on function public.apply_race_dsq_penalties(uuid) from anon;
grant execute on function public.apply_race_dsq_penalties(uuid) to authenticated;

-- Every result publish/rebuild updates the published import row after writing the
-- official race_result rows. Apply the DSQ marker only after that safe publish.
create or replace function public.apply_dsq_after_published_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' then
    perform public.apply_race_dsq_penalties(new.race_id);
  end if;
  return new;
exception
  when others then
    -- A newly created/open correction draft can coexist around versioning work.
    -- In that case the live result must remain unchanged and DSQ will be applied
    -- when the final publish occurs.
    if sqlerrm = 'Open result draft exists' then
      return new;
    end if;
    raise;
end;
$$;

revoke all on function public.apply_dsq_after_published_result() from public;
revoke all on function public.apply_dsq_after_published_result() from anon;

-- Trigger on any published-row update, including an explicit rebuild of an
-- already published version. This keeps DSQ deletion/editing reversible.
drop trigger if exists race_result_imports_apply_dsq_after_publish on public.race_result_imports;
create trigger race_result_imports_apply_dsq_after_publish
after update on public.race_result_imports
for each row
when (new.status = 'published')
execute function public.apply_dsq_after_published_result();

create table if not exists public.driver_track_notes (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  track_key text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_track_notes_track_key_check check (char_length(btrim(track_key)) between 1 and 120),
  constraint driver_track_notes_note_length_check check (char_length(note) <= 5000),
  constraint driver_track_notes_user_league_track_unique unique (user_id, league_id, track_key)
);

create index if not exists driver_track_notes_league_user_idx
  on public.driver_track_notes (league_id, user_id, updated_at desc);

alter table public.driver_track_notes enable row level security;

revoke all on table public.driver_track_notes from public, anon;
grant select, insert, update, delete on table public.driver_track_notes to authenticated;

drop policy if exists "members read own track notes" on public.driver_track_notes;
create policy "members read own track notes"
on public.driver_track_notes
for select
to authenticated
using (
  user_id = auth.uid()
  and public.matches_requested_league(league_id)
  and (
    public.is_platform_owner()
    or exists (
      select 1 from public.league_members lm
      where lm.league_id = driver_track_notes.league_id
        and lm.user_id = auth.uid()
    )
  )
);

drop policy if exists "members insert own track notes" on public.driver_track_notes;
create policy "members insert own track notes"
on public.driver_track_notes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.matches_requested_league(league_id)
  and (
    public.is_platform_owner()
    or exists (
      select 1 from public.league_members lm
      where lm.league_id = driver_track_notes.league_id
        and lm.user_id = auth.uid()
    )
  )
);

drop policy if exists "members update own track notes" on public.driver_track_notes;
create policy "members update own track notes"
on public.driver_track_notes
for update
to authenticated
using (
  user_id = auth.uid()
  and public.matches_requested_league(league_id)
)
with check (
  user_id = auth.uid()
  and public.matches_requested_league(league_id)
);

drop policy if exists "members delete own track notes" on public.driver_track_notes;
create policy "members delete own track notes"
on public.driver_track_notes
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.matches_requested_league(league_id)
);

commit;