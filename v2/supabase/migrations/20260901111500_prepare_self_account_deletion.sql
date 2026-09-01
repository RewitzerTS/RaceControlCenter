-- Remove personal account access without changing immutable league history.
-- The Edge Function performs an irreversible Auth soft deletion afterwards so
-- historical actor references can retain a non-identifying stable UUID.

create or replace function public.prepare_self_account_deletion(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'account_user_id_required';
  end if;

  -- League branding belongs to the league. Releasing Auth ownership keeps the
  -- asset available after the uploading account has been deleted.
  update storage.objects
  set owner = null,
      owner_id = null
  where owner = p_user_id
     or owner_id = p_user_id::text;

  delete from public.user_notifications where recipient_user_id = p_user_id;
  delete from public.league_join_requests where user_id = p_user_id;
  delete from public.league_members where user_id = p_user_id;
  delete from public.platform_owners where user_id = p_user_id;
  delete from public.vora_context_audit where actor_user_id = p_user_id;
  delete from public.demo_driver_profiles where user_id = p_user_id;
  delete from private.ai_analysis_usage where actor_user_id = p_user_id;

  -- Removing the personal claim also removes its identity link. The league
  -- driver row and every official result referencing that driver remain intact.
  delete from public.driver_claims where claimant_user_id = p_user_id;
  update public.driver_identities
  set status = 'suspended',
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.prepare_self_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_self_account_deletion(uuid) to service_role;

comment on function public.prepare_self_account_deletion(uuid) is
  'Service-only account cleanup. Removes personal access and claim links while preserving league drivers, official results, standings, and league-owned branding assets.';
