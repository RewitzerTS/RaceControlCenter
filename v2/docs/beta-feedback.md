# Beta feedback

The app shell displays a 44px feedback launcher (above the mobile navigation). It never opens automatically. The native dialog supports Escape, focus containment and focus return. Drafts remain in memory on close, but are not persisted across reloads.

`GET /api/beta-feedback` returns readiness. `POST` accepts a category (`bug`, `idea`, `other`), 5–4000 character message, optional reply email, current route and an empty honeypot field. Only the route is sent, without query strings, fragments, screenshots or account data. No feedback is stored in a database or written to application logs.

Mail uses the existing Cloudflare Email Routing service, with fixed sender `beta-feedback@racevora.com` and recipient from the Worker secret `FEEDBACK_RECIPIENT`. Never expose the owner's private address in frontend assets or version control. The optional visitor address is Reply-To only. The destination must be verified in Cloudflare before deploying the configured binding. Existing domain routing and DNS records must not be changed. No paid plan is required for sends to a verified destination address.

Spam controls: same-origin JSON requests only, streamed 20KB request size limit, strict input validation, honeypot, 3 attempts/minute/IP and 30 emails/minute per Cloudflare location. Rate limits are approximate/local to each Cloudflare location, not a global billing quota. No client or third-party mail API credentials. A failed provider request returns an error, never a false success. The UI disables concurrent sends and preserves failed drafts.

Test: `npm exec vitest -- run src/feedback/BetaFeedback.test.tsx worker/beta-feedback.test.js`. Local-only UI harness: `/qa/feedback-responsive.html` (Vite dev, mocked email, not a production entry point).

Before release: verify recipient in Cloudflare, production build, Worker dry run, tests, mobile and desktop browser checks, then send one clearly labeled end-to-end test from the live form to the configured recipient and confirm it arrives.

Both `wrangler.production.jsonc` and `wrangler.cutover.jsonc` target the same production Worker. Keep the email and rate-limit bindings identical: a deployment with omitted bindings removes them. The production build now checks parity before building. Verify readiness after the Git-triggered Cloudflare build finishes, not only immediately after a manual deployment.
