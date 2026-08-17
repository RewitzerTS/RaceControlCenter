# RaceVora Beta-Release-Readiness · 17.08.2026

Status: **kontrollierte Beta technisch freigabefähig; aktuell keine bekannten technischen A-Blocker. Vor einer breit beworbenen, vollständig offenen Self-Service-Beta bleiben wenige Betriebs-, Bot-Schutz- und externe Legal-Checks offen.**

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
- [ ] Benachrichtigungskanal und verantwortliche Person für fehlgeschlagene Production-Health-/Deployment-Läufe organisatorisch festlegen.

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

### Cloudflare Turnstile

- [x] Frontend-Integration für Turnstile technisch vorbereitet.
- [x] Geschützte Supabase-Auth-Aufrufe vorbereitet: Signup, Passwort-Login, Passwort-Reset und Signup-Resend.
- [x] `captchaToken` wird zentral an die jeweiligen Supabase-Auth-Methoden übergeben.
- [x] Turnstile Secret Key darf durch CI nicht in Browser-/Repo-Code gelangen.
- [x] Bei leerem Site Key bleibt die Integration ein No-op; bestehende Auth-Flows funktionieren unverändert.
- [ ] Produktives Cloudflare-Turnstile-Widget für `racevora.com` anlegen.
- [ ] Öffentlichen Site Key in `assets/js/auth-turnstile-config.js` eintragen und deployen.
- [ ] Turnstile Secret Key ausschließlich in Supabase Authentication → Bot and Abuse Protection hinterlegen und CAPTCHA Protection aktivieren.
- [ ] Danach Signup, Login, Recovery und Signup-Resend produktiv testen.

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

- [x] Supabase-Projektstatus im Abschlussaudit: `ACTIVE_HEALTHY`, Region `eu-west-1`, PostgreSQL 17.
- [ ] Aktuellen Supabase-Tarif und die tatsächlich verfügbare Backup-Retention im Dashboard verifizieren.
- [ ] Restore-Verantwortung und Ablauf dokumentieren.
- [ ] Separat berücksichtigen, dass Datenbankbackups nicht automatisch die eigentlichen Storage-Objekte wiederherstellen; Brand-/Upload-Assets benötigen bei geschäftskritischer Nutzung eine eigene Recovery-Strategie.
- [ ] Optional vor größerem Launch einen kontrollierten Restore-/Disaster-Recovery-Drill auf nichtproduktiver Umgebung durchführen.

## 10. B · Sinnvoll vor breiter öffentlicher Beta

1. Cloudflare Turnstile produktiv aktivieren und Signup/Login/Recovery/Resend testen.
2. Aktive Supabase Auth-Mailtemplates im Dashboard gegen die Repo-Versionen abgleichen.
3. Verantwortlichen/Benachrichtigungskanal für rote Production-Health- und Deployment-Checks festlegen.
4. Backup-Tarif/Retention bestätigen und Restore-/Storage-Recovery-Runbook festlegen.
5. Content-Security-Policy zunächst im Report-Only-Modus testen und anschließend kontrolliert erzwingen, sobald alle externen Ressourcen inventarisiert sind.
6. Rechtstexte und Verbraucherfluss vor breiter Vermarktung extern fachlich prüfen lassen.

**Nicht Teil des Free-Plan-B-Minimums:** Leaked Password Protection, da diese Funktion im verwendeten Supabase-Free-Plan nicht verfügbar ist.

## 11. C · Kann nach Start einer kontrollierten Beta erfolgen

- Performance-Advisor-Hinweise wie unindexierte Foreign Keys, RLS-Initplan-Optimierungen, mehrfach permissive Read-Policies und ungenutzte Indizes anhand echter Last priorisieren.
- Boolean-Helper-RPCs mit frei übergebbarer User-ID weiter minimieren bzw. in private interne Helfer aufteilen.
- Retry-/Backoff-Strategie für serverseitige Provider-Ausfälle weiter verfeinern.
- Lasttests und optional Supabase Branching/Staging vor größerem öffentlichen Launch etablieren.
- Monitoring später um externe Benachrichtigung/Incident-Prozess und gegebenenfalls Log-Drain ergänzen.
- Leaked Password Protection bei einem späteren Supabase-Plan-Upgrade erneut bewerten.

## 12. Release-Entscheidung

### Kontrollierte Beta mit ausgewählten Rennligen

**GO.** Nach aktuellem Audit sind keine bekannten technischen A-Blocker offen.

### Breit beworbene offene Self-Service-Beta

**GO nach Free-Plan-B-Minimum:** Turnstile/CAPTCHA aktivieren und live testen, Auth-Mailtemplates live abgleichen sowie Monitoring- und Backup/Restore-Verantwortung klären. Externe Legal-/Privacy-Prüfung bleibt vor breiter Vermarktung empfohlen.

## 13. Nicht durch den Abschlussaudit verändert

- keine Fahrer-, Saison- oder Rennergebnisdaten der produktiven Liga `rcc`,
- kein Branding oder Inhalt der produktiven Liga `rcc`,
- keine aktiven Supabase-Mailtemplates im Dashboard,
- keine Supabase-Auth-Passwörter.