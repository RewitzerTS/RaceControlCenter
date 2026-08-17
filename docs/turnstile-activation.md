# RaceVora · Cloudflare Turnstile aktivieren

Stand: 17.08.2026

Der RaceVora-Frontend-Code ist für Cloudflare Turnstile vorbereitet. Die Integration schützt die öffentlichen Supabase-Auth-Flows für Registrierung, Passwort-Login, Passwort-Reset und das erneute Senden einer Signup-Bestätigung.

## Sicherheitsmodell

- Der **Site Key** ist öffentlich und wird im Browser verwendet.
- Der **Secret Key** bleibt ausschließlich in Supabase Auth / Bot and Abuse Protection.
- Der Secret Key darf niemals in GitHub, HTML oder Browser-JavaScript gespeichert werden.
- Solange kein Site Key in `assets/js/auth-turnstile-config.js` gesetzt ist, verhält sich der Turnstile-Layer als No-op und verändert die bestehenden Auth-Flows nicht.

## Aktivierung

1. In Cloudflare unter **Turnstile** ein neues Widget für RaceVora anlegen.
   - Widget-Typ: Managed
   - Hostname mindestens: `racevora.com`
   - optional zusätzlich: `www.racevora.com`
2. Den öffentlichen **Site Key** kopieren und in `assets/js/auth-turnstile-config.js` eintragen:

   ```js
   window.RACEVORA_TURNSTILE_SITE_KEY = '<PUBLIC_SITE_KEY>';
   ```

3. In Supabase unter **Authentication → Bot and Abuse Protection → CAPTCHA protection** Cloudflare Turnstile auswählen.
4. Dort ausschließlich den **Turnstile Secret Key** eintragen und speichern.
5. Danach produktiv testen:
   - neuer Signup,
   - bestehender Passwort-Login,
   - Passwort-Reset,
   - Signup-Bestätigung erneut senden.

## Technische Umsetzung

`assets/js/auth-turnstile.js` patcht die bestehenden Supabase-Auth-Aufrufe und ergänzt jeweils `captchaToken`:

- `auth.signUp(...)`
- `auth.signInWithPassword(...)`
- `auth.resetPasswordForEmail(...)`
- `auth.resend(...)`

Der Turnstile-Token wird nach jedem Auth-Aufruf verworfen/reset, weil Tokens kurzlebig und nur einmal verwendbar sind.

## Rollback

Falls Turnstile Probleme verursacht:

1. CAPTCHA protection in Supabase zunächst deaktivieren.
2. Den Site Key in `assets/js/auth-turnstile-config.js` wieder auf einen leeren String setzen.

Damit fallen die bestehenden RaceVora-Auth-Flows auf den bisherigen Zustand zurück.
