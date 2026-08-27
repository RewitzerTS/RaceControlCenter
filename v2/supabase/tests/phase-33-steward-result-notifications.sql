-- Result and steward notification delivery, privacy and tenant isolation regressions.
-- Synthetic fixtures are always rolled back.

begin;

do $$
begin
  if has_function_privilege('authenticated', 'private.process_notification_event(uuid,text)', 'execute')
     or has_table_privilege('authenticated', 'public.user_notifications', 'insert') then
    raise exception 'browser roles can forge notifications';
  end if;
end;
$$;

do $$
declare
  source text := pg_get_functiondef('private.process_notification_event(uuid,text)'::regprocedure);
begin
  if source not like '%steward.decision_finalized%'
     or source not like '%result.revised%'
     or source not like '%notification.stewardDecision.title%'
     or source like '%steward_votes%'
     or source like '%steward_evidence%' then
    raise exception 'notification processor lacks safe steward/result delivery';
  end if;
end;
$$;

rollback;
