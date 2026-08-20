begin;

do $$
declare
  league_id uuid := gen_random_uuid();
  season_id uuid := gen_random_uuid();
  race_id uuid := gen_random_uuid();
  result_v1 uuid := gen_random_uuid();
  result_v2 uuid := gen_random_uuid();
  render_id uuid := gen_random_uuid();
  processing_id uuid;
  rendered_status text;
begin
  insert into public.leagues (id, name, slug)
  values (league_id, 'Phase 21 Transaction Test', 'phase-21-transaction-test');

  insert into public.seasons (id, league_id, slug, name, is_active)
  values (season_id, league_id, 'season-test', 'Season Test', true);

  insert into public.races (id, season_id, round_number, grand_prix_name, status)
  values (race_id, season_id, 1, 'Graphics Test Grand Prix', 'completed');

  insert into public.result_versions (
    id, race_id, version_number, status, change_reason,
    validated_at, activated_at
  ) values (
    result_v1, race_id, 1, 'active', 'Initial official result',
    now(), now()
  );

  update public.races set current_result_version_id = result_v1 where id = race_id;

  insert into public.social_graphic_renders (
    id, league_id, result_version_id, graphic_type, graphic_format,
    source_digest, source_payload
  ) values (
    render_id, league_id, result_v1, 'winner', 'story',
    repeat('a', 64), jsonb_build_object('result_version_id', result_v1)
  );

  update public.result_versions
  set status = 'superseded', superseded_at = now()
  where id = result_v1;

  insert into public.result_versions (
    id, race_id, version_number, previous_version_id, status,
    change_reason, validated_at
  ) values (
    result_v2, race_id, 2, result_v1, 'validated',
    'Steward revision', now()
  );

  update public.result_versions
  set status = 'active', activated_at = now()
  where id = result_v2;

  update public.races set current_result_version_id = result_v2 where id = race_id;

  select claimed.processing_id into processing_id
  from private.claim_domain_event('graphics', 'phase-21-contract-test') claimed;

  if processing_id is null then
    raise exception 'Graphics processor did not receive the revision event.';
  end if;

  perform private.process_graphics_event(processing_id, 'phase-21-contract-test');

  select status into rendered_status
  from public.social_graphic_renders
  where id = render_id;

  if rendered_status <> 'outdated' then
    raise exception 'Old graphic was not marked outdated after result revision.';
  end if;

  if not exists (
    select 1 from private.domain_event_processing
    where id = processing_id and processor = 'graphics' and status = 'succeeded'
  ) then
    raise exception 'Graphics processor did not complete independently.';
  end if;
end;
$$;

rollback;
