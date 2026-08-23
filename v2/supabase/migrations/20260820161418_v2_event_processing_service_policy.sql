-- Phase 7 follow-up: document the only role allowed to access private processor state.

create policy "v2 service role manages domain event processing"
on private.domain_event_processing
for all
to service_role
using (true)
with check (true);
