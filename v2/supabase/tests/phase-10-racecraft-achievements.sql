-- RaceVora Racecraft Achievement sequence, correction, and rollback regressions.
-- Synthetic fixtures are always rolled back.

begin;

update private.domain_event_processing
set status = 'succeeded', locked_by = null, locked_at = null, last_error = null,
    processed_at = coalesce(processed_at, now())
where status in ('pending', 'processing', 'failed');

do $$
begin
  if (
    select count(*)
    from public.achievement_definitions
    where not is_core
      and is_active
      and code in (
        'podiums_after_dnf_1', 'wins_after_dnf_1', 'wins_after_two_dnfs_1',
        'perfect_weekends_1', 'wins_from_grid_10_1', 'podiums_from_grid_15_1',
        'win_streak_3', 'classified_streak_5', 'pole_streak_3',
        'fastest_lap_streak_3', 'first_race_wins_1'
      )
  ) <> 11 then
    raise exception 'Racecraft Achievement catalog does not contain exactly eleven active definitions';
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
  'racecraft-driver@example.invalid', '{}', '{}', now(), now()
);

insert into public.driver_identities (id, user_id)
values (
  'b0100000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001'
);

insert into public.leagues (id, name, slug, is_public, settings)
values (
  'b1000000-0000-0000-0000-000000000001',
  'Racecraft Alpha', 'racecraft-alpha', true, '{"published":true}'
);

insert into public.seasons (id, league_id, slug, name)
values (
  'b1100000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'racecraft-one', 'Racecraft One'
);

insert into public.races (
  id, season_id, round_number, grand_prix_name, race_date
) values
  ('b1200000-0000-0000-0000-000000000001', 'b1100000-0000-0000-0000-000000000001', 1, 'Racecraft One', '2026-08-01'),
  ('b1200000-0000-0000-0000-000000000002', 'b1100000-0000-0000-0000-000000000001', 2, 'Racecraft Two', '2026-08-02'),
  ('b1200000-0000-0000-0000-000000000003', 'b1100000-0000-0000-0000-000000000001', 3, 'Racecraft Three', '2026-08-03'),
  ('b1200000-0000-0000-0000-000000000004', 'b1100000-0000-0000-0000-000000000001', 4, 'Racecraft Four', '2026-08-04'),
  ('b1200000-0000-0000-0000-000000000005', 'b1100000-0000-0000-0000-000000000001', 5, 'Racecraft Five', '2026-08-05'),
  ('b1200000-0000-0000-0000-000000000006', 'b1100000-0000-0000-0000-000000000001', 6, 'Racecraft Six', '2026-08-06'),
  ('b1200000-0000-0000-0000-000000000007', 'b1100000-0000-0000-0000-000000000001', 7, 'Racecraft Seven', '2026-08-07'),
  ('b1200000-0000-0000-0000-000000000008', 'b1100000-0000-0000-0000-000000000001', 8, 'Racecraft Eight', '2026-08-08');

insert into public.drivers (id, league_id, display_name)
values (
  'b1300000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'Racecraft Driver'
);

insert into public.driver_claims (
  id, driver_id, claimant_user_id, verification_method, status, resolved_at, resolved_by
)
values (
  'b1600000-0000-0000-0000-000000000001',
  'b1300000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'admin_verified', 'verified', now(),
  'b0000000-0000-0000-0000-000000000001'
);

insert into public.driver_identity_links (
  id, driver_identity_id, driver_id, claim_id
)
values (
  'b1800000-0000-0000-0000-000000000001',
  'b0100000-0000-0000-0000-000000000001',
  'b1300000-0000-0000-0000-000000000001',
  'b1600000-0000-0000-0000-000000000001'
);

create function pg_temp.publish_racecraft_result(
  p_race_id uuid,
  p_grid_position integer,
  p_finish_position integer,
  p_classification_status text,
  p_fastest_lap_time_ms integer
)
returns void
language plpgsql
as $$
declare
  target_version_id uuid;
  delivery record;
begin
  target_version_id := private.create_result_version(
    p_race_id,
    format('Racecraft publication for %s', p_race_id)
  );

  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    fastest_lap_time_ms, participation_status, classification_status,
    awarded_points, points
  ) values (
    target_version_id, 1, 'b1300000-0000-0000-0000-000000000001',
    p_grid_position, p_finish_position, p_fastest_lap_time_ms,
    'PLAYER', p_classification_status,
    case when p_finish_position = 1 then 25 else 0 end,
    case when p_finish_position = 1 then 25 else 0 end
  );

  perform private.validate_result_version(target_version_id);
  perform private.activate_result_version(target_version_id);

  loop
    delivery := null;
    select * into delivery
    from private.claim_domain_event('achievements', 'racecraft-achievement-worker');
    exit when delivery.processing_id is null;
    perform private.process_achievement_event(
      delivery.processing_id, 'racecraft-achievement-worker'
    );
  end loop;
end;
$$;

select pg_temp.publish_racecraft_result('b1200000-0000-0000-0000-000000000001', 5, 1, 'classified', null);
select pg_temp.publish_racecraft_result('b1200000-0000-0000-0000-000000000002', 4, null, 'dnf', null);
select pg_temp.publish_racecraft_result('b1200000-0000-0000-0000-000000000003', 4, null, 'dnf', null);
select pg_temp.publish_racecraft_result('b1200000-0000-0000-0000-000000000004', 15, 1, 'classified', 93000);
select pg_temp.publish_racecraft_result('b1200000-0000-0000-0000-000000000005', 5, 1, 'classified', 92000);
select pg_temp.publish_racecraft_result('b1200000-0000-0000-0000-000000000006', 1, 1, 'classified', 91000);
select pg_temp.publish_racecraft_result('b1200000-0000-0000-0000-000000000007', 1, 2, 'classified', null);
select pg_temp.publish_racecraft_result('b1200000-0000-0000-0000-000000000008', 1, 5, 'classified', null);

do $$
begin
  if exists (
    select 1
    from (values
      ('podiums_after_dnf', 1::bigint),
      ('wins_after_dnf', 1::bigint),
      ('wins_after_two_dnfs', 1::bigint),
      ('perfect_weekends', 1::bigint),
      ('wins_from_grid_10', 1::bigint),
      ('podiums_from_grid_15', 1::bigint),
      ('win_streak', 3::bigint),
      ('classified_streak', 5::bigint),
      ('pole_streak', 3::bigint),
      ('fastest_lap_streak', 3::bigint),
      ('first_race_wins', 1::bigint)
    ) as expected(metric, expected_value)
    where private.achievement_metric_value(
      'b0100000-0000-0000-0000-000000000001', expected.metric
    ) <> expected.expected_value
  ) then
    raise exception 'ordered official results did not produce every expected Racecraft metric';
  end if;

  if (
    select count(*)
    from public.driver_achievements da
    join public.achievement_definitions ad on ad.code = da.achievement_code
    where da.driver_identity_id = 'b0100000-0000-0000-0000-000000000001'
      and not ad.is_core
      and da.status = 'unlocked'
  ) <> 11 then
    raise exception 'the complete Racecraft sequence did not unlock all eleven Achievements';
  end if;
end;
$$;

do $$
declare
  prior_version_id uuid;
  revised_version_id uuid;
  delivery record;
begin
  select current_result_version_id into prior_version_id
  from public.races
  where id = 'b1200000-0000-0000-0000-000000000003';

  revised_version_id := private.create_result_version(
    'b1200000-0000-0000-0000-000000000003',
    'Racecraft DNF corrected to classified finish',
    prior_version_id
  );

  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    participation_status, classification_status, awarded_points, points
  ) values (
    revised_version_id, 1, 'b1300000-0000-0000-0000-000000000001',
    4, 5, 'PLAYER', 'classified', 0, 0
  );

  perform private.validate_result_version(revised_version_id);
  perform private.activate_result_version(revised_version_id);

  loop
    delivery := null;
    select * into delivery
    from private.claim_domain_event('achievements', 'racecraft-achievement-worker');
    exit when delivery.processing_id is null;
    perform private.process_achievement_event(
      delivery.processing_id, 'racecraft-achievement-worker'
    );
  end loop;

  if (
    select count(*)
    from public.driver_achievements
    where driver_identity_id = 'b0100000-0000-0000-0000-000000000001'
      and achievement_code in (
        'podiums_after_dnf_1', 'wins_after_dnf_1', 'wins_after_two_dnfs_1'
      )
      and status = 'revoked'
      and current_value = 0
  ) <> 3 then
    raise exception 'DNF correction did not revoke the three dependent comeback Achievements';
  end if;

  if (
    select count(*)
    from public.driver_achievement_events
    where driver_identity_id = 'b0100000-0000-0000-0000-000000000001'
      and achievement_code in (
        'podiums_after_dnf_1', 'wins_after_dnf_1', 'wins_after_two_dnfs_1'
      )
      and event_type = 'revoked'
  ) <> 3 then
    raise exception 'DNF correction did not append immutable comeback revoke evidence';
  end if;
end;
$$;

rollback;
