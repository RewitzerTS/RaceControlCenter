-- Phase 20 controlled Vora context, actor binding, feature gate and deterministic fallback regressions.
-- Synthetic fixtures are always rolled back.

begin;

do $$
begin
  if has_function_privilege('anon', 'public.get_vora_companion_snapshot()', 'execute') then raise exception 'anonymous callers can access Vora context'; end if;
  if not has_function_privilege('authenticated', 'public.get_vora_companion_snapshot()', 'execute') then raise exception 'authenticated drivers cannot access Vora context'; end if;
  if has_table_privilege('authenticated', 'public.vora_context_audit', 'insert') then raise exception 'browser callers can forge Vora context audit'; end if;
end;
$$;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('f2000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'vora-one@example.invalid', '{}', '{}', now(), now()),
  ('f2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'vora-two@example.invalid', '{}', '{}', now(), now());
insert into public.driver_identities (id, user_id) values
  ('f2010000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001'),
  ('f2010000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002');
insert into public.driver_career_stats (driver_identity_id, starts, wins, podiums) values
  ('f2010000-0000-0000-0000-000000000001', 0, 0, 0),
  ('f2010000-0000-0000-0000-000000000002', 20, 5, 8);
insert into public.driver_progression (driver_identity_id, lifetime_xp, level, rank, xp_into_level, xp_to_next_level) values
  ('f2010000-0000-0000-0000-000000000001', 0, 1, 'Rookie', 0, 1000),
  ('f2010000-0000-0000-0000-000000000002', 9800, 10, 'Racer', 800, 200);

select set_config('request.jwt.claims', '{"sub":"f2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare snapshot jsonb;
begin
  snapshot := public.get_vora_companion_snapshot();
  if snapshot ->> 'source' <> 'deterministic_v1' then raise exception 'Vora fallback is not deterministic'; end if;
  if snapshot #>> '{insight,rule}' <> 'first_race' then raise exception 'Vora deterministic first-race rule failed'; end if;
  if (snapshot #>> '{career,wins}')::integer <> 0 then raise exception 'Vora leaked another driver career data'; end if;
  if jsonb_array_length(snapshot -> 'context_fields') <> 4 then raise exception 'Vora context is not explicitly bounded'; end if;
end;
$$;

reset role;
update public.platform_feature_flags set enabled = false where flag_key = 'vora_enabled';
set local role authenticated;
do $$
begin
  begin
    perform public.get_vora_companion_snapshot();
    raise exception 'Vora ignored its server feature flag';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;

reset role;
do $$
begin
  begin
    update public.vora_context_audit set insight_rule = 'rewritten';
    raise exception 'Vora context audit was mutable';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;

rollback;
