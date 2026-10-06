-- The private schema intentionally has no USAGE for browser roles.
-- Use a narrow, fixed-search-path RPC boundary; the delegated function performs
-- auth.uid(), tenant and steward-capability checks before touching any data.
begin;
alter function public.record_steward_decision(uuid,uuid,uuid,text,text,text,numeric,uuid,uuid,text) security definer;
revoke all on function private.record_simple_steward_decision(uuid,uuid,uuid,text,text,text,numeric,uuid,uuid,text) from authenticated;
commit;

