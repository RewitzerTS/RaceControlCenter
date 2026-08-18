-- RaceVora Supabase RLS performance consolidation
-- 2026-08-18
--
-- Supabase flags permissive SELECT policies when multiple policies for the
-- same role/action must be evaluated and OR'ed for every row. This migration
-- preserves the exact current access union while separating write policies
-- from SELECT and giving anon/authenticated one SELECT policy each.
--
-- No business data is modified.

-- Standard tenant tables: preserve
--   authenticated SELECT = existing read condition OR existing manage condition
--   anon SELECT          = existing read condition
--   writes               = existing manage USING/WITH CHECK conditions
-- Expressions are read from pg_policies immediately before replacement so the
-- migration cannot accidentally drift from the policies being consolidated.
do $$
declare
  rec record;
  v_manage_qual text;
  v_manage_check text;
  v_read_qual text;
begin
  for rec in
    select * from (values
      ('championship_history', 'league admins manage championship history', 'read league championship history'),
      ('driver_season_assignments', 'league admins manage driver assignments', 'read league driver assignments'),
      ('driver_slot_assignments', 'league admins manage driver slot assignments', 'read league driver slot assignments'),
      ('drivers', 'league admins manage drivers', 'read league drivers'),
      ('league_content', 'league admins manage league content', 'read league content'),
      ('race_penalties', 'league staff manage penalties', 'read league penalties'),
      ('race_results', 'league admins manage race results', 'read league race results'),
      ('races', 'league admins manage races', 'read league races'),
      ('season_driver_slots', 'league admins manage season driver slots', 'read league season driver slots'),
      ('season_team_slots', 'league admins manage season team slots', 'read league season team slots'),
      ('seasons', 'league admins manage seasons', 'read league seasons'),
      ('steward_incidents', 'league staff manage steward incidents', 'read league steward incidents'),
      ('teams', 'league admins manage teams', 'read league teams')
    ) as t(table_name, manage_policy, read_policy)
  loop
    select qual, with_check
      into v_manage_qual, v_manage_check
      from pg_policies
      where schemaname = 'public'
        and tablename = rec.table_name
        and policyname = rec.manage_policy
        and cmd = 'ALL';

    select qual
      into v_read_qual
      from pg_policies
      where schemaname = 'public'
        and tablename = rec.table_name
        and policyname = rec.read_policy
        and cmd = 'SELECT';

    if v_manage_qual is null or v_manage_check is null or v_read_qual is null then
      raise exception 'Expected RLS policies missing for public.%', rec.table_name;
    end if;

    execute format('drop policy %I on public.%I', rec.manage_policy, rec.table_name);
    execute format('drop policy %I on public.%I', rec.read_policy, rec.table_name);

    execute format(
      'create policy %I on public.%I for select to anon using (%s)',
      rec.read_policy,
      rec.table_name,
      v_read_qual
    );

    execute format(
      'create policy %I on public.%I for select to authenticated using ((%s) or (%s))',
      'authenticated ' || rec.read_policy,
      rec.table_name,
      v_read_qual,
      v_manage_qual
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (%s)',
      rec.manage_policy || ' insert',
      rec.table_name,
      v_manage_check
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
      rec.manage_policy || ' update',
      rec.table_name,
      v_manage_qual,
      v_manage_check
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s)',
      rec.manage_policy || ' delete',
      rec.table_name,
      v_manage_qual
    );
  end loop;
end
$$;

-- Steward cases have a private staff-read path plus a public closed-case path.
-- Preserve the full authenticated union while keeping anon closed-only.
do $$
declare
  v_manage_qual text;
  v_manage_check text;
  v_staff_read_qual text;
  v_closed_read_qual text;
begin
  select qual, with_check into v_manage_qual, v_manage_check
  from pg_policies
  where schemaname='public' and tablename='steward_cases'
    and policyname='league staff manage steward cases' and cmd='ALL';

  select qual into v_staff_read_qual
  from pg_policies
  where schemaname='public' and tablename='steward_cases'
    and policyname='league staff read steward cases' and cmd='SELECT';

  select qual into v_closed_read_qual
  from pg_policies
  where schemaname='public' and tablename='steward_cases'
    and policyname='request scope closed steward cases' and cmd='SELECT';

  if v_manage_qual is null or v_manage_check is null or v_staff_read_qual is null or v_closed_read_qual is null then
    raise exception 'Expected steward_cases RLS policies missing';
  end if;

  drop policy "league staff manage steward cases" on public.steward_cases;
  drop policy "league staff read steward cases" on public.steward_cases;
  drop policy "request scope closed steward cases" on public.steward_cases;

  execute format(
    'create policy %I on public.steward_cases for select to anon using (%s)',
    'public read closed steward cases', v_closed_read_qual
  );
  execute format(
    'create policy %I on public.steward_cases for select to authenticated using ((%s) or (%s) or (%s))',
    'authenticated read steward cases', v_manage_qual, v_staff_read_qual, v_closed_read_qual
  );
  execute format(
    'create policy %I on public.steward_cases for insert to authenticated with check (%s)',
    'league staff manage steward cases insert', v_manage_check
  );
  execute format(
    'create policy %I on public.steward_cases for update to authenticated using (%s) with check (%s)',
    'league staff manage steward cases update', v_manage_qual, v_manage_check
  );
  execute format(
    'create policy %I on public.steward_cases for delete to authenticated using (%s)',
    'league staff manage steward cases delete', v_manage_qual
  );
end
$$;

-- Leagues have three legitimate read paths. Collapse them to one per role while
-- preserving the exact previous OR semantics.
do $$
declare
  v_member_qual text;
  v_owner_qual text;
  v_public_qual text;
begin
  select qual into v_member_qual from pg_policies
    where schemaname='public' and tablename='leagues' and policyname='members read their leagues' and cmd='SELECT';
  select qual into v_owner_qual from pg_policies
    where schemaname='public' and tablename='leagues' and policyname='platform owners read all leagues' and cmd='SELECT';
  select qual into v_public_qual from pg_policies
    where schemaname='public' and tablename='leagues' and policyname='public read published public leagues' and cmd='SELECT';

  if v_member_qual is null or v_owner_qual is null or v_public_qual is null then
    raise exception 'Expected leagues SELECT policies missing';
  end if;

  drop policy "members read their leagues" on public.leagues;
  drop policy "platform owners read all leagues" on public.leagues;
  drop policy "public read published public leagues" on public.leagues;

  execute format(
    'create policy %I on public.leagues for select to anon using (%s)',
    'public read published public leagues', v_public_qual
  );
  execute format(
    'create policy %I on public.leagues for select to authenticated using ((%s) or (%s) or (%s))',
    'authenticated read permitted leagues', v_member_qual, v_owner_qual, v_public_qual
  );
end
$$;
