# Result draft recovery and canonical AI times

Scope: owner-authorized Production repair, 7 October 2026. Staging is unchanged.

## Cause and repair

Japan's unpublished draft contained OCR gaps such as `+14:337`. The pending
steward credit could not resolve these to milliseconds. The duration parser now
accepts the unambiguous seconds/three-digit-milliseconds form, while `1:23`
continues to mean one minute and 23 seconds.

Unpublished drafts can be discarded after confirmation, then images selected
again. Discarding creates an immutable private receipt; it does not delete
sporting history, steward cases, or published results. Tenant/capability checks
and the same race lock used by publication prevent unauthorized/concurrent
discarding. Consumed/active versions cannot be discarded. Discarded versions
cannot later be published or activated.

The AI function enforces `MM:SS.mmm` lap/short total times, `HH:MM:SS.mmm` long
totals, and `+SS.mmm` gaps in its prompt and strict response schema. A pure
normalizer handles decimal commas and known OCR separators; ambiguous values
become null with a row warning. DNF/DNS/DSQ/DNQ/RET and lap deficits remain
statuses, not fabricated durations. Model, authorization, quotas and JWT
verification are unchanged. Structured-output pattern support was checked in
the official OpenAI documentation.

## Verification before release

- Production migration `20261007163811_result_draft_recovery_and_ocr_times` applied.
- Synthetic SQL regression passed before and after application, entirely rolled
  back: role/tenant denial, discard/retry, reimport, pending credit, publication
  idempotency, and protection of active/consumed versions.
- Real Japan draft preparation was tested in a rolled-back transaction. The
  pending 10-second credit correctly moves the affected driver from P5 to P4.
  No real result was published or discarded by this task.
- 44 focused unit checks passed, including 36 AI time-format cases/contract tests.
- Desktop/mobile browser tests passed for failure messages, discard cancel/retry,
  reimport selection and confirmation-state horizontal overflow. Screenshots
  reviewed; mobile confirmation corrected with the frontend hardening guidance.
- Production AI function v8 deployed with JWT verification; fetched index and
  helper match the local sources. No paid real-image AI call was made in testing.
- Security advisors reviewed: the new private receipt intentionally denies all
  direct access (RLS without policies); the authenticated definer wrapper is
  intentional and checks tenant/capability inside. Existing unrelated auth
  password-protection advisory is not changed by this repair.

Website publication additionally requires the unchanged full deploy-safe gate
and hosted browser smoke tests. The database and AI fixes are backward-compatible
with the previous frontend.
