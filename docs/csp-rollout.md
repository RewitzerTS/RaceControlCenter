# RaceVora CSP Rollout

Stand: 18.08.2026

## Status

RaceVora verwendet jetzt eine **enforced Content Security Policy**. Die vorherige Report-Only-Phase wurde nach realen Browser-/Admin-Tests und der Bereinigung des F1-News-Datenpfads beendet.

Die Policy wird zentral ueber `_headers` ausgeliefert.

## Erlaubte externe Browser-Origins

- `https://cdn.jsdelivr.net` – Supabase JavaScript Client und aktuell weitere versionierbare Frontend-Abhaengigkeiten.
- `https://challenges.cloudflare.com` – Cloudflare Turnstile Script und Frame.
- `https://kjccstcbqygxuqkvdaqw.supabase.co` – RaceVora Supabase HTTPS/API/Storage/Edge-Function-Verbindungen, inklusive des eigenen F1-News-Backends.
- `wss://kjccstcbqygxuqkvdaqw.supabase.co` – Supabase WebSocket/Realtime.

Die Landingpage verwendet eigene RaceVora-Seiten in eingebetteten Frames; deshalb bleibt `frame-src 'self'` erlaubt.

## Enforcement-Baseline

Wesentliche Direktiven:

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://challenges.cloudflare.com`
- `style-src 'self' 'unsafe-inline'`
- `img-src 'self' data: blob: https:`
- `font-src 'self' data:`
- `connect-src 'self' https://kjccstcbqygxuqkvdaqw.supabase.co wss://kjccstcbqygxuqkvdaqw.supabase.co https://challenges.cloudflare.com`
- `frame-src 'self' https://challenges.cloudflare.com`
- `worker-src 'self' blob:`
- `manifest-src 'self'`
- `object-src 'none'`
- `base-uri 'self'`
- `form-action 'self'`
- `frame-ancestors 'self'`

## F1-News und CSP

Die bisher im Browser aufgerufenen Proxy-Dienste `rss2json.com`, `rss2json.io` und `allorigins.win` sind keine erforderlichen Netzwerkziele mehr. Der Race Hub leitet den Legacy-Newsaufruf auf die eigene Supabase Edge Function `f1-news` um. Diese Funktion:

1. akzeptiert keine frei uebergebenen Feed-URLs,
2. verwendet eine feste Server-Allowlist,
3. begrenzt Feed-Antworten auf 2 MB,
4. verwendet einen gemeinsamen 15-Minuten-Cache,
5. kann bei Quellenausfaellen bis zu 24 Stunden auf den letzten erfolgreichen Cache zurueckfallen.

Dadurch muss die CSP keine oeffentlichen RSS-Proxy-Domains erlauben.

## Warum `unsafe-inline` vorerst bestehen bleibt

RaceVora besitzt weiterhin Inline-Skripte und Inline-Styles in mehreren bestehenden Seiten. Die CSP ist trotzdem bereits blockierend aktiv, erlaubt Inline-Code aber derzeit explizit.

Eine spaetere Haertung soll Inline-Skripte/-Styles schrittweise in versionierte Dateien verlagern bzw. mit CSP-Nonces oder Hashes absichern. Diese Haertung ist bewusst **nicht** Teil der ersten Enforcement-Aktivierung, um Sicherheitsgewinn und Regressionsrisiko getrennt zu halten.

## Warum `img-src https:` vorerst bestehen bleibt

Liga-, Team- und Branding-Assets koennen aktuell aus unterschiedlichen HTTPS-Quellen stammen. Die Enforcement-Aktivierung veraendert diese bestehende Funktionalitaet deshalb nicht. Nach weiterer Beobachtung kann `img-src` auf konkrete Origins reduziert werden.

## Verifikation

`.github/workflows/csp-report-only-smoke.yml` traegt aus historischen Gruenden noch diesen Dateinamen, prueft aber jetzt die **Enforcement-Policy**:

1. `Content-Security-Policy` ist vorhanden,
2. `Content-Security-Policy-Report-Only` ist nicht mehr aktiv,
3. Turnstile, jsDelivr und RaceVora Supabase bleiben freigegeben,
4. keine Secret-artigen Werte stehen in den oeffentlichen Headern,
5. nach Merge/Cloudflare-Deploy wird der produktive Enforcement-Header auf `racevora.com` kontrolliert.

Der F1-News-Pfad besitzt zusaetzlich `.github/workflows/f1-news-backend-smoke.yml`.

## Naechste CSP-Haertung

Die Enforcement-Policy ist jetzt die produktive Basis. Weitere Haertung erfolgt separat:

1. CDN-Abhaengigkeiten versionieren bzw. soweit sinnvoll selbst hosten.
2. Inline-JavaScript/-CSS reduzieren und auf Nonces/Hashes umstellen.
3. `img-src https:` auf bekannte Asset-Origins begrenzen.
4. Optional eine strengere Kandidaten-Policy erneut parallel als Report-Only beobachten, bevor die produktive Enforcement-Policy enger wird.
