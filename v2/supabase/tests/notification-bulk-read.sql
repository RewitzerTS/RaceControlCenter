begin;
insert into auth.users (id, email) values
 ('91999999-0000-4000-8000-000000000001', 'bulk-read-1@example.invalid'),
 ('91999999-0000-4000-8000-000000000002', 'bulk-read-2@example.invalid');
insert into public.user_notifications (recipient_user_id, notification_kind, title_key, body_key, dedupe_key, created_at)
select '91999999-0000-4000-8000-000000000001', 'system', 'test.title', 'test.body', 'bulk-test-' || n, now() - interval '1 day'
from generate_series(1, 61) n;
insert into public.user_notifications (recipient_user_id, notification_kind, title_key, body_key, dedupe_key, created_at, read_at) values
 ('91999999-0000-4000-8000-000000000001','system','test.title','test.body','bulk-old-read', now() - interval '2 days', now() - interval '1 day'),
 ('91999999-0000-4000-8000-000000000001','system','test.title','test.body','bulk-future', now() + interval '1 day', null),
 ('91999999-0000-4000-8000-000000000002','system','test.title','test.body','bulk-other-user', now() - interval '1 day', null);
select set_config('request.jwt.claim.sub','91999999-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.mark_all_notifications_read();
reset role;
do $$ begin
 if (select count(*) from public.user_notifications where recipient_user_id='91999999-0000-4000-8000-000000000001' and read_at is not null) <> 62 then raise exception 'Not all unread rows were marked'; end if;
 if exists(select 1 from public.user_notifications where dedupe_key in ('bulk-future','bulk-other-user') and read_at is not null) then raise exception 'Other user or future notification changed'; end if;
 if (select read_at from public.user_notifications where dedupe_key='bulk-old-read') <> now() - interval '1 day' then raise exception 'Existing read time changed'; end if;
 if has_function_privilege('anon','public.mark_all_notifications_read()','execute') then raise exception 'Anonymous grant'; end if;
end $$;
select public.mark_all_notifications_read();
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin
  perform public.mark_all_notifications_read();
  raise exception 'Unauthenticated call allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
