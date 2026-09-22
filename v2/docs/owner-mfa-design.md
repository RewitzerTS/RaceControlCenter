# Owner authentication: local extension

## User and job
The platform owner must protect elevated access using an authenticator without changing league or driver workflows.

## Context
Operate mode: a short security interruption after password login, often on a phone. Keep the existing dark RaceVora authentication world, system typography and branded primary action.

## Structure
One narrow, labelled form. Setup explains QR scanning and manual entry; returning owners see just the code field. One dominant confirmation action, secondary sign-out and recovery guidance. No dashboard or decorative security statistics.

## Contract
Server authorization is authoritative. Do not mount privileged screens before confirmation. Enrollment is explicit, never a render effect. Keep secrets only in memory and never in telemetry, screenshots or browser storage.

## Craft
Single numeric autofill-compatible input, 44px controls, visible focus, semantic errors, usable 320px layout, high-contrast QR backing. Four existing interface languages.

## Verification
Unit state/error tests; rolled-back SQL permission tests; desktop/mobile mocked browser checks with a clearly synthetic QR. Real enrollment remains a private user action.

## Documentation outcome

This is an ordinary local extension of the incumbent interface. Compared `OwnerMfaGate.tsx`, `owner-mfa.css` and the four-language `ownerMfaMessages.ts` with `src/styles.css`, `src/beta-ux.css` and root `PRODUCT.md`. The panel consumes the existing background, surface, text and border tokens; headings and body copy inherit the established Atkinson Hyperlegible / Segoe UI / Inter / Arial stack. The existing primary and secondary button treatments and accent kicker remain shared, including the branded teal-to-purple primary gradient and rounded controls. No new global design system or token source is introduced.

Checked the desktop/mobile setup and challenge captures in `.impeccable/review/owner-mfa/`. They show the narrow responsive form, inherited visual language and deliberately synthetic QR. The initial review disposition was **fix**, limited to focus contrast; the final review verdict is **ship** after that finding was resolved. The local accessible-focus exception is a 3px light outline (`#f4f7ff`) with a 3px offset, scoped to the owner MFA panel; challenge captures show the corrected focus state. This is a visual review verdict, not evidence of a live release or real MFA enrollment.

Preexisting context drift remains recorded and untouched: `PRODUCT.md` still describes the earlier V1/V2 deployment separation, and root/V2 `DESIGN.md` is absent. Context loading and the detector were unavailable, so this documentation relies on direct code and screenshot inspection. Incumbent styles, product context and global design artifacts were preserved; no drift repair was performed.
