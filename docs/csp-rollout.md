# RaceVora CSP Rollout

Stand: 17.08.2026

## Ziel

RaceVora fuehrt Content Security Policy kontrolliert ein, ohne die produktiven Auth-, Turnstile-, Supabase- oder Admin-Flows durch eine zu enge Policy zu blockieren.

Phase 1 verwendet deshalb ausschliesslich `Content-Security-Policy-Report-Only`.

## Bekannte externe Ressourcen

Aktuell benoetigte externe Origins im Browser:

- `https://cdn.jsdelivr.net` – Supabase JavaScript Client.
- `https://challenges.cloudflare.com` – Cloudflare Turnstile Script und Frame.
- `https://kjccstcbqygxuqkvdaqw.supabase.co` – RaceVora Supabase HTTPS/API/Storage/Edge-Function-Verbindungen.
- `wss://kjccstcbqygxuqkvdaqw.supabase.co` – Supabase WebSocket/Realtime, sofern ein Flow Realtime nutzt.

Die Landingpage verwendet zudem eigene RaceVora-Seiten in eingebetteten Frames; daher bleibt `frame-src 'self'` erlaubt.

## Report-Only-Baseline

Die Policy wird zentral ueber `_headers` ausgeliefert. Sie blockiert in dieser Phase keine Ressourcen.

Wesentliche Direktiven:

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://challenges.cloudflare.com`
- `style-src 'self' 'unsafe-inline'`
- `connect-src 'self' https://kjccstcbqygxuqkvdaqw.supabase.co wss://kjccstcbqygxuqkvdaqw.supabase.co https://challenges.cloudflare.com`
- `frame-src 'self' https://challenges.cloudflare.com`
- `object-src 'none'`
- `base-uri 'self'`
- `form-action 'self'`
- `frame-ancestors 'self'`

`img-src` ist in Phase 1 bewusst breiter (`https:`), weil League-/Team-/Branding-Assets und bestehende Bildpfade vor einer Enforcement-Policy vollstaendig inventarisiert werden sollen.

## Warum aktuell noch `unsafe-inline`

RaceVora besitzt derzeit Inline-Skripte und Inline-Styles in mehreren HTML-Seiten. Eine sofortige Enforcement-Policy ohne `unsafe-inline` wuerde diese Bereiche blockieren.

Vor einer spaeteren strikten Enforcement-Phase sollten Inline-Skripte in versionierte JS-Dateien ausgelagert bzw. schrittweise auf CSP-Nonces/Hashes umgestellt werden. Cloudflare Turnstile unterstuetzt eine nonce-basierte CSP und alternativ die explizite Freigabe von `https://challenges.cloudflare.com` in `script-src` und `frame-src`.

## Verifikation

`.github/workflows/csp-report-only-smoke.yml` prueft:

1. dass die Policy im Repository vorhanden ist,
2. dass Turnstile, jsDelivr und RaceVora Supabase explizit enthalten sind,
3. dass keine Secret-artigen Werte in den oeffentlichen Headern stehen,
4. nach Merge/Deploy, dass `https://racevora.com/` die Report-Only-Policy wirklich ausliefert.

## Uebergang zu Enforcement

Erst nach Beobachtung realer Browser-Flows:

1. Login, Registrierung, Passwort-Recovery, Signup-Resend testen.
2. Admin Center inkl. KI-Upload, Ergebnis-Workflows und Asset-Uploads testen.
3. Race Hub, Fahrer-/Team-WM und eingebettete Landingpage-Previews testen.
4. Externe Bild-/Asset-Origins aus Reporten bzw. Browser-Netzwerkdaten inventarisieren.
5. `img-src` auf konkrete Quellen reduzieren.
6. Inline-JavaScript/-CSS schrittweise entfernen oder nonce/hash-basiert absichern.
7. Erst danach `Content-Security-Policy-Report-Only` kontrolliert durch `Content-Security-Policy` ersetzen.

Bei jeder Enforcement-Aenderung muss Turnstile weiterhin `https://challenges.cloudflare.com` in `script-src` und `frame-src` erhalten.
