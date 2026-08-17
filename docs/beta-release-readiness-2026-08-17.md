# RaceVora Beta-Release-Readiness · 17.08.2026

Status: **kontrollierte Beta technisch freigabefähig; aktuell keine bekannten technischen A-Blocker. Vor einer breit beworbenen, vollständig offenen Self-Service-Beta bleiben wenige Betriebs-, Auth- und externe Legal-Checks offen.**

## 1. A · Beta-Blocker

**Stand nach Abschlussaudit: 0 offen.**

Geschlossene technische Blocker und zentrale Schutzmaßnahmen:

- [x] Registrierung → E-Mail-Bestätigung → serverseitige Liga-Erstellung → Vertragsbestätigung → Onboarding live erfolgreich getestet.
- [x] Vertragsbestätigung wird serverseitig mit Status, Versandzeitpunkt, Provider-ID und Versuchszahl dokumentiert.
- [x] Registrierungs-CORS-Fehler beseitigt.
- [x] Öffentlicher elektronischer Widerruf serverseitig gegen direkten Skript-/Mail-Abuse begrenzt: 20 akzeptierte Erklärungen global / 15 Minuten und 3 pro Bestätigungs-E-Mail / 15 Minuten.
- [x] Kostenpflichtige KI-Ergebnisanalyse wird vor dem OpenAI-Aufruf quota-geprüft: 48 Bild-Einheiten / 10 Minuten pro Nutzer, 160 / 24 Stunden pro Nutzer und 800 / 24 Stunden global.
- [x] KI-Quota-Ledger ist RLS-geschützt und für `anon`/`authenticated` nicht direkt lesbar oder schreibbar.
- [x] KI-Edge-Function `analyze-race-result-images` produktiv als Version 10, `ACTIVE`, `verify_jwt=true`.
- [x] Produktive Liga `rcc` nach den Security-Migrationen unverändert verifiziert.

## 2. Plattform / Deployment

- [x] Produktivdomain `https://racevora.com/`.
- [x] Landingpage, Registrierung, Login, Passwort-Recovery und Passwort-Setup vorhanden.
- [x] Multi-Tenant-/Rollen-Security separat auditiert (`docs/security-audit-2026-08-16.md`).
- [x] JavaScript-, Browser-, Branding-, Tenant-Security-, Results-/Team-Asset-, AI-Mobile- und Admin-iPhone-Smokes vorhanden.
- [x] Legal Release Smoke, Contract Confirmation Smoke und Electronic Withdrawal Flow als Release-Gates vorhanden.
- [x] CI-Gates für Withdrawal Rate Limit und AI Analysis Quota vorhanden.
- [x] Turnstile Auth Protection als eigenes CI-Gate ergänzt.
- [x] `Content-Security-Policy-Report-Only` produktiv ausgerollt; der deploy-aware CSP-Smoke wartet auf den passenden Cloudflare-Build und prüft anschließend den echten Header auf `racevora.com`.

## 3. Tenant-Isolation / Datenbank-Security

- [x] Alle geprüften öffentlichen Basistabellen haben RLS aktiviert.
- [x] Besonders sensible Tabellen (`platform_owners`, `consumer_withdrawals`, `contract_confirmations`, `ai_analysis_usage`) sind für Browserrollen zusätzlich direkt gesperrt.
- [x] Öffentliche Views verwenden `security_invoker=true` und umgehen die RLS ihrer Basistabellen nicht.
- [x] Keine geprüfte `SECURITY DEFINER`-Funktion ist für `anon` ausführbar.
- [x] Schreibende `SECURITY DEFINER`-RPCs wurden stichprobenartig auf `auth.uid()` sowie Liga-/Rollenprüfung kontrolliert; für die geprüften Schreibpfade wurden keine ungeschützten Mutationen gefunden.
- [x] `consume_ai_analysis_quota` prüft selbst eingeloggten Nutzer sowie Owner/Admin/Platform-Owner, bevor der private Quota-Ledger beschrieben wird.

Supabase Security Advisor meldet einige `SECURITY DEFINER`-RPCs weiterhin als Warnung, weil sie für `authenticated` aufrufbar sind. Für die geprüften mutierenden RPCs ist das beabsichtigt und mit internen Berechtigungschecks abgesichert.

## 4. Produktionsmonitoring

- [x] Stündlicher Workflow `.github/workflows/production-health.yml`.
- [x] Landing, Registrierung, Passwort-Flows, Rechtstexte und öffentlicher `rcc` Race-Hub werden geprüft.
- [x] HTTP→HTTPS, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` und `security.txt` werden geprüft.
- [x] Widerrufs-Edge-Function wird nicht-mutierend per `OPTIONS` geprüft.
- [x] Operative Verantwortung: Richard Rewitzer.
- [x] Technischer Incident-Kanal: GitHub Issues mit Label `production-health`; `.github/workflows/production-health-incident.yml` eröffnet/aktualisiert bei geplanten oder manuellen Fehlerläufen automatisch ein Incident-Issue und schließt es nach erfolgreicher Erholung.

Betriebsablauf: `docs/operations-runbook.md`.

## 5. Supabase Auth / E-Mails / Bot-Schutz

Versionierte RaceVora-Templates unter `supabase/email-templates/racevora/`:

- [x] Confirm Signup
- [x] Reset Password
- [x] Invite User
- [x] Magic Link
- [x] Change Email Address
- [x] Custom SMTP über Resend grundsätzlich versandfähig.
- [x] Signup-, Reset- und Invite-Flows wurden bereits live getestet.
- [ ] **MANUELLER LIVE-CHECK:** Im Supabase-Dashboard bestätigen, dass die Repo-Versionen als aktive Auth-Mailtemplates hinterlegt sind.

Empfohlene Betreffzeilen sind in `supabase/email-templates/racevora/README.md` versioniert.

### Cloudflare Turnstile

- [x] Produktives Cloudflare-Turnstile-Widget für `racevora.com` angelegt.
- [x] Öffentlicher Site Key in `assets/js/auth-turnstile-config.js` eingetragen und produktiv deployed.
- [x] Turnstile Secret Key ausschließlich in Supabase Auth hinterlegt und CAPTCHA Protection aktiviert.
- [x] Geschützte Supabase-Auth-Aufrufe: Signup, Passwort-Login, Passwort-Reset und Signup-Resend.
- [x] `captchaToken` wird zentral an die jeweiligen Supabase-Auth-Methoden übergeben.
- [x] Turnstile Secret Key darf durch CI nicht in Browser-/Repo-Code gelangen.
- [x] Produktiver Passwort-Login nach Aktivierung erfolgreich durch Supabase Auth (`grant_type=password`, HTTP 200) verifiziert.
- [x] Signup und Passwort-Recovery nach Aktivierung produktiv erfolgreich getestet.
- [ ] Signup-Resend nach aktivierter CAPTCHA Protection separat als Resend-Vorgang testen.

Aktivierungs-Runbook: `docs/turnstile-activation.md`.

### Leaked Password Protection

Supabase Security Advisor weist auf deaktivierte Leaked Password Protection hin. **Diese Funktion ist im aktuell verwendeten Supabase-Free-Plan nicht verfügbar und wird daher ausdrücklich nicht als Voraussetzung für die Free-Plan-Beta geführt.** Bei einem späteren Plan-Upgrade kann sie als zusätzliche Auth-Härtung erneut bewertet werden.

## 6. Betreiber / Kontakt

- [x] Betreiber: Richard Rewitzer.
- [x] Anschrift: Hohenzollernstr. 9, 72622 Nürtingen, Deutschland.
- [x] Allgemeiner Kontakt: `kontakt@racevora.com`.
- [x] Support: `support@racevora.com`.
- [x] Betrieb zunächst als Privatperson.
- [x] Beta kostenlos.

## 7. Rechtstexte / Vertragsfluss

- [x] `impressum.html`.
- [x] `datenschutz.html`.
- [x] `agb.html` für die kostenlose Beta.
- [x] `widerruf.html` mit Verbraucher-Widerrufsbelehrung und elektronischer Widerrufsfunktion.
- [x] Rechtstext-Links auf Landingpage und im gemeinsamen App-Footer.
- [x] Vertragsbestätigung auf dauerhaftem Medium technisch live verifiziert.
- [x] `Legal Release Smoke` schützt Seiten, Betreiberangaben und Verlinkungen gegen Regressionen.
- [ ] **VOR BREITER VERMARKTUNG:** Rechtstexte, Vertrags-/Widerrufsfluss und Datenschutz fachanwaltlich/datenschutzrechtlich prüfen lassen.

Die technischen Maßnahmen sind keine Aussage, dass RaceVora „100 % rechtssicher“ oder anwaltlich geprüft ist.

## 8. Verbraucher-Widerruf

- [x] Hervorgehobener öffentlicher Einstieg `Vertrag widerrufen`.
- [x] Zweistufiges Formular: Angaben prüfen → `Widerruf bestätigen`.
- [x] Serverseitige Speicherung in separater `consumer_withdrawals`-Tabelle.
- [x] RLS aktiv; direkte Tabellenrechte für `PUBLIC`, `anon` und `authenticated` entzogen.
- [x] Eindeutige Referenz und UTC-Zeitstempel.
- [x] Automatische Eingangsbestätigung über Resend.
- [x] `confirmation_sent_at` und Provider-ID werden serverseitig dokumentiert.
- [x] Betreiberkopie an `kontakt@racevora.com`.
- [x] Server-seitige Abuse-Schranke greift vor Datensatz-/Mailversand.

## 9. Backup / Recovery

- [x] Supabase-Projektstatus verifiziert: `ACTIVE_HEALTHY`, Region `eu-west-1`, PostgreSQL 17.
- [x] Aktueller Supabase-Organisationsplan am 17.08.2026 über die Projektverwaltung verifiziert: **Free**.
- [x] Free-Plan-Risiko dokumentiert: keine garantierten automatischen Backups/PITR; Supabase empfiehlt regelmäßige eigene CLI-Dumps und Off-Site-Aufbewahrung.
- [x] Restore-Verantwortung und Ablauf in `docs/operations-runbook.md` dokumentiert.
- [x] Dokumentiert, dass Datenbankbackups nicht die eigentlichen Storage-Objekte wiederherstellen; Storage benötigt einen separaten Export-/Recovery-Pfad.
- [x] Produktive Storage-Inventur am 17.08.2026: aktuell ein öffentlicher Bucket `league-brand-assets` mit 4 Objekten.
- [x] Gated Workflow `.github/workflows/encrypted-offsite-backup.yml` vorbereitet: logischer DB-Dump + aktuelle öffentliche Storage-Objekte, lokale AES-256/GnuPG-Verschlüsselung und Upload ausschließlich als verschlüsseltes Objekt in einen privaten EU-R2-Bucket.
- [x] Workflow ist bis zur bewussten Aktivierung fail-safe deaktiviert und verweigert unbemerkt unvollständige Storage-Backups, sobald ein privater Supabase-Bucket auftaucht.
- [ ] EU-R2-Bucket und erforderliche GitHub Actions Secrets einrichten, einen erzwungenen manuellen Backup-Lauf erfolgreich verifizieren und danach `RACEVORA_BACKUPS_ENABLED=true` setzen.
- [ ] Optional vor größerem Launch einen kontrollierten Restore-/Disaster-Recovery-Drill auf nichtproduktiver Umgebung durchführen.

Aktivierungsanleitung: `docs/offsite-backup-activation.md`.

## 10. Content Security Policy

- [x] Report-Only-Baseline mit `default-src 'self'`, eingeschränkten Script/Connect/Frame-Origins sowie `object-src 'none'` produktiv ausgerollt.
- [x] Turnstile, jsDelivr und das RaceVora-Supabase-Projekt sind explizit berücksichtigt.
- [x] Produktiver Header nach erfolgreichem Cloudflare-Deploy automatisiert verifiziert.
- [ ] Nach Beobachtung realer Flows externe Bild-/Asset-Origins weiter verengen und Inline-JS/-CSS schrittweise auf externe Dateien bzw. Nonces/Hashes umstellen.
- [ ] Erst danach Report-Only kontrolliert in eine enforced `Content-Security-Policy` überführen.

Rollout-Plan: `docs/csp-rollout.md`.

## 11. B · Sinnvoll vor breiter öffentlicher Beta

1. Aktive Supabase Auth-Mailtemplates im Dashboard gegen die Repo-Versionen abgleichen.
2. Signup-Resend einmal nach aktivierter Turnstile/CAPTCHA Protection live testen.
3. Vorbereitete verschlüsselte Off-Site-Backup-Automation tatsächlich aktivieren: privaten EU-R2-Bucket erstellen, GitHub-Secrets setzen, manuellen Testlauf erfolgreich verifizieren und danach den täglichen Schedule freigeben.
4. Rechtstexte und Verbraucherfluss vor breiter Vermarktung extern fachlich prüfen lassen.

**Erledigt:** Turnstile/CAPTCHA produktiv aktiviert und für Login, Signup und Recovery live getestet; Production-Health-Verantwortung und GitHub-Incident-Kanal festgelegt; Free-Plan-Backup-/Restore-Risiko und Recovery-Ablauf dokumentiert; CSP Report-Only produktiv ausgerollt und live verifiziert; verschlüsselte EU-Off-Site-Backup-Automation technisch vorbereitet.

**Nicht Teil des Free-Plan-B-Minimums:** Leaked Password Protection, da diese Funktion im verwendeten Supabase-Free-Plan nicht verfügbar ist.

## 12. C · Kann nach Start einer kontrollierten Beta erfolgen

- Performance-Advisor-Hinweise wie unindexierte Foreign Keys, RLS-Initplan-Optimierungen, mehrfach permissive Read-Policies und ungenutzte Indizes anhand echter Last priorisieren.
- Boolean-Helper-RPCs mit frei übergebbarer User-ID weiter minimieren bzw. in private interne Helfer aufteilen.
- Retry-/Backoff-Strategie für serverseitige Provider-Ausfälle weiter verfeinern.
- Lasttests und optional Supabase Branching/Staging vor größerem öffentlichen Launch etablieren.
- CSP nach realer Report-Only-Beobachtung weiter verengen und später erzwingen.
- Backup-Restore-Drill in einer getrennten nichtproduktiven Umgebung durchführen.
- Leaked Password Protection bei einem späteren Supabase-Plan-Upgrade erneut bewerten.

## 13. Release-Entscheidung

### Kontrollierte Beta mit ausgewählten Rennligen

**GO.** Nach aktuellem Audit sind keine bekannten technischen A-Blocker offen.

### Breit beworbene offene Self-Service-Beta

**GO nach verbleibendem Free-Plan-B-Minimum:** aktive Auth-Mailtemplates live abgleichen, Signup-Resend mit CAPTCHA prüfen und die vorbereitete regelmäßige verschlüsselte Off-Site-Backup-Routine für reale Nutzerdaten tatsächlich aktivieren und mit einem erfolgreichen Lauf nachweisen. CSP-Enforcement kann nach der jetzt aktiven Report-Only-Beobachtungsphase kontrolliert folgen; externe Legal-/Privacy-Prüfung bleibt vor breiter Vermarktung empfohlen.

## 14. Nicht durch den Abschlussaudit verändert

- keine Fahrer-, Saison- oder Rennergebnisdaten der produktiven Liga `rcc`,
- kein Branding oder Inhalt der produktiven Liga `rcc`,
- keine aktiven Supabase-Mailtemplates im Dashboard,
- keine Supabase-Auth-Passwörter.
