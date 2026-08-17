# RaceVora Beta-Release-Readiness · 17.08.2026

Status: **kontrollierte Beta technisch freigabefähig; aktuell keine bekannten technischen A-Blocker. Vor einer breit beworbenen, vollständig offenen Self-Service-Beta sind noch Sicherheits-, Betriebs- und externe Legal-Checks sinnvoll.**

## 1. A · Beta-Blocker

**Stand nach Abschlussaudit: 0 offen.**

Im finalen Audit gefundene Blocker wurden vor Freigabe geschlossen:

- [x] Registrierung → E-Mail-Bestätigung → serverseitige Liga-Erstellung → Vertragsbestätigung → Onboarding live erfolgreich getestet.
- [x] Vertragsbestätigung wird als serverseitiger Datensatz mit Status, Versandzeitpunkt, Provider-ID und Versuchszahl dokumentiert.
- [x] Registrierungs-CORS-Fehler beseitigt; der tenant-spezifische `x-rcc-league-slug`-Header wird im Registration-Flow nicht mehr unnötig mitgesendet.
- [x] Öffentlicher elektronischer Widerruf serverseitig gegen direkten Skript-/Mail-Abuse begrenzt: 20 akzeptierte Erklärungen global / 15 Minuten und 3 pro Bestätigungs-E-Mail / 15 Minuten.
- [x] Kostenpflichtige KI-Ergebnisanalyse serverseitig quota-geschützt, bevor OpenAI aufgerufen wird: 48 Bild-Einheiten / 10 Minuten pro Nutzer, 160 / 24 Stunden pro Nutzer und 800 / 24 Stunden global.
- [x] KI-Quota-Ledger ist RLS-geschützt und für `anon`/`authenticated` nicht direkt lesbar oder schreibbar.
- [x] KI-Edge-Function `analyze-race-result-images` produktiv als Version 10, `ACTIVE`, `verify_jwt=true`.
- [x] Beide Abuse-Schutz-Migrationen sind in der Supabase-Migrationshistorie produktiv eingetragen.
- [x] Cloudflare Worker und GitHub Pages nach dem finalen Security-Merge erfolgreich deployed.
- [x] Produktive Liga `rcc` nach allen Migrationen unverändert verifiziert.

## 2. Plattform / Deployment

- [x] Produktivdomain `https://racevora.com/`.
- [x] Landingpage, Registrierung, Passwort-Recovery und Passwort-Setup vorhanden.
- [x] Öffentlicher Read-only Race-Hub der bestehenden Liga `rcc` bleibt als Smoke-Ziel erhalten.
- [x] Multi-Tenant-/Rollen-Security separat auditiert (`docs/security-audit-2026-08-16.md`).
- [x] JavaScript-, Browser-, Branding-, Tenant-Security-, Results-/Team-Asset-, AI-Mobile- und Admin-iPhone-Smokes vorhanden.
- [x] Legal Release Smoke, Contract Confirmation Smoke und Electronic Withdrawal Flow als Release-Gates vorhanden.
- [x] Neue CI-Gates für Withdrawal Rate Limit und AI Analysis Quota vorhanden.
- [x] Finaler Security-PR #377 vor Merge vollständig grün (14 Checks).

## 3. Tenant-Isolation / Datenbank-Security

- [x] Alle geprüften öffentlichen Basistabellen haben RLS aktiviert.
- [x] Besonders sensible Tabellen (`platform_owners`, `consumer_withdrawals`, `contract_confirmations`, `ai_analysis_usage`) sind für Browserrollen zusätzlich direkt gesperrt.
- [x] Öffentliche Views (`v_driver_context`, `v_driver_standings`, `v_season_points_ledger`, `v_team_standings`) verwenden `security_invoker=true` und umgehen damit die RLS ihrer Basistabellen nicht.
- [x] Keine geprüfte `SECURITY DEFINER`-Funktion ist für `anon` ausführbar.
- [x] Schreibende `SECURITY DEFINER`-RPCs wurden stichprobenartig auf `auth.uid()` sowie Liga-/Rollenprüfung kontrolliert; für die geprüften Schreibpfade wurden keine ungeschützten Mutationen gefunden.
- [x] `consume_ai_analysis_quota` ist bewusst `SECURITY DEFINER`, prüft aber selbst den eingeloggten Nutzer sowie Owner/Admin/Platform-Owner, bevor der private Quota-Ledger beschrieben wird.

Supabase Security Advisor meldet `SECURITY DEFINER`-RPCs weiterhin als Warnung, weil sie für `authenticated` aufrufbar sind. Für die geprüften mutierenden RPCs ist das beabsichtigt und mit internen Berechtigungschecks abgesichert; die Warnung wird deshalb nicht pauschal durch Entfernen von `SECURITY DEFINER` „behoben“.

## 4. Produktionsmonitoring

- [x] Stündlicher Workflow `.github/workflows/production-health.yml`.
- [x] HTTP-Fehlerprüfung, Inhaltsmarker, Timeouts und Retries.
- [x] Landing, Registrierung, Passwort-Flows und öffentlicher `rcc` Race-Hub werden read-only geprüft.
- [x] Rechtliche Seiten werden im Production Health überwacht.
- [x] Widerrufs-Edge-Function wird nicht-mutierend per `OPTIONS` geprüft.
- [x] HTTP→HTTPS, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` und `security.txt` werden geprüft.
- [x] Keine eigene Besucher-/Session-/PII-Telemetrie notwendig.
- [ ] Benachrichtigungskanal und verantwortliche Person für fehlgeschlagene Production-Health/GitHub-Actions-Läufe organisatorisch festlegen.

Supabase-Auth-Logs sind über den verbundenen Connector abrufbar. Die aktuelle Stichprobe enthält erfolgreiche Signup-/Verify-/Session-/Logout-Flows. Das ersetzt kein dauerhaftes Alerting.

## 5. Supabase Auth / E-Mails

Versionierte RaceVora-Templates unter `supabase/email-templates/racevora/`:

- [x] Confirm Signup
- [x] Reset Password
- [x] Invite User
- [x] Magic Link
- [x] Change Email Address
- [x] CI-Smoke prüft Branding und Template-Platzhalter.
- [x] Custom SMTP über Resend grundsätzlich versandfähig.
- [x] Signup-Mail an kontrolliertes Testpostfach erfolgreich zugestellt.
- [x] Reset-Mail an kontrolliertes Testpostfach erfolgreich zugestellt.
- [x] Invite-Mail erfolgreich zugestellt und Einladung live bestätigt.
- [x] Rollenwechsel im Mitgliederflow live geprüft.
- [ ] **MANUELLER LIVE-CHECK:** Im Supabase-Dashboard bestätigen, dass die Repo-Versionen als aktive Auth-Mailtemplates hinterlegt sind.
- [ ] **VOR OFFENER SELF-SERVICE-BETA:** Supabase „Leaked Password Protection“ aktivieren; der Security Advisor meldet diese Funktion aktuell als deaktiviert.
- [ ] **VOR OFFENER SELF-SERVICE-BETA:** CAPTCHA/Bot-Schutz (bevorzugt Cloudflare Turnstile oder hCaptcha) für öffentliche Auth-Flows aktivieren und Frontend-Token an Supabase Auth übergeben.

Die kontrollierte Beta kann mit bestätigten Testern betrieben werden. Für eine breit beworbene Registrierung senkt CAPTCHA das Risiko, dass Bots Signup-/Recovery-E-Mailkontingente und unnötige Accounts erzeugen.

## 6. Betreiber / Kontakt

- [x] Betreiber: Richard Rewitzer.
- [x] Anschrift: Hohenzollernstr. 9, 72622 Nürtingen, Deutschland.
- [x] Allgemeiner Kontakt: `kontakt@racevora.com`.
- [x] Support: `support@racevora.com`.
- [x] Betrieb zunächst als Privatperson.
- [x] Beta kostenlos.
- [x] Nutzung auch für private/Hobby-Ligen und Verbraucher möglich.

## 7. Rechtstexte / Vertragsfluss

- [x] `impressum.html`.
- [x] `datenschutz.html`.
- [x] `agb.html` für die kostenlose Beta.
- [x] `widerruf.html` mit Verbraucher-Widerrufsbelehrung und elektronischer Widerrufsfunktion.
- [x] Rechtstext-Links auf Landingpage und im gemeinsamen App-Footer.
- [x] Registrierung enthält echte Links und kennzeichnet die Beta als kostenlos.
- [x] Datenschutzerklärung beschreibt Cloudflare, Supabase, Resend, jsDelivr, Browser-Speicher und optionalen OpenAI-KI-Import.
- [x] Vertragsbestätigung auf dauerhaftem Medium technisch live verifiziert.
- [x] `Legal Release Smoke` schützt Seiten, Betreiberangaben und Verlinkungen gegen Regressionen.
- [ ] **VOR BREITER VERMARKTUNG:** Rechtstexte, Vertrags-/Widerrufsfluss und Datenschutz fachanwaltlich/datenschutzrechtlich prüfen lassen.

Die technischen Maßnahmen sind keine Aussage, dass RaceVora „100 % rechtssicher“ oder anwaltlich geprüft ist.

## 8. Verbraucher-Widerruf

- [x] Hervorgehobener öffentlicher Einstieg `Vertrag widerrufen`.
- [x] Zweistufiges Formular: Angaben prüfen → `Widerruf bestätigen`.
- [x] Server-seitige Speicherung in separater `consumer_withdrawals`-Tabelle.
- [x] RLS aktiv; direkte Tabellenrechte für `PUBLIC`, `anon` und `authenticated` entzogen.
- [x] Eindeutige Referenz und UTC-Zeitstempel.
- [x] Automatische Eingangsbestätigung über Resend.
- [x] `confirmation_sent_at` und Provider-ID werden serverseitig dokumentiert.
- [x] Betreiberkopie an `kontakt@racevora.com`.
- [x] Zusätzlicher herunterladbarer Eingangsbeleg im Browser.
- [x] Echter Live-CI-Test gegen Supabase + Resend erfolgreich.
- [x] Server-seitige Abuse-Schranke greift bereits vor Datensatz-/Mailversand.

## 9. Backup / Recovery

- [x] Supabase-Projektstatus im Abschlussaudit: `ACTIVE_HEALTHY`, Region `eu-west-1`, PostgreSQL 17.
- [ ] Aktuellen Supabase-Tarif und damit die tatsächlich verfügbare Backup-Retention im Dashboard verifizieren.
- [ ] Vor breiter Beta Restore-Verantwortung und Ablauf dokumentieren: gewünschtes Restore-Ziel wählen, Downtime kommunizieren, Restore durchführen, anschließend Auth/Liga/RLS/Storage verifizieren.
- [ ] Separat berücksichtigen, dass Supabase-Datenbankbackups die eigentlichen Storage-Objekte nicht wiederherstellen; Brand-/Upload-Assets benötigen deshalb eine eigene Backup-/Recovery-Strategie, falls sie geschäftskritisch werden.
- [ ] Optional vor größerem Launch einen kontrollierten Restore-/Disaster-Recovery-Drill auf nichtproduktiver Umgebung durchführen.

## 10. B · Sinnvoll vor breiter öffentlicher Beta

1. Leaked Password Protection in Supabase Auth aktivieren.
2. CAPTCHA/Turnstile in Signup, Login bzw. Recovery nach gewünschtem Schutzumfang integrieren und Supabase Bot Protection aktivieren.
3. Aktive Supabase Auth-Mailtemplates im Dashboard gegen die Repo-Versionen abgleichen.
4. Verantwortlichen/Benachrichtigungskanal für rote Production-Health- und Deployment-Checks festlegen.
5. Backup-Tarif/Retention bestätigen und Restore-/Storage-Recovery-Runbook festlegen.
6. Content-Security-Policy zunächst im Report-Only-Modus testen und anschließend kontrolliert erzwingen, sobald alle externen Ressourcen inventarisiert sind.
7. Rechtstexte und Verbraucherfluss vor breiter Vermarktung extern fachlich prüfen lassen.

## 11. C · Kann nach Start einer kontrollierten Beta erfolgen

- Performance-Advisor-Hinweise wie unindexierte Foreign Keys, RLS-Initplan-Optimierungen, mehrfach permissive Read-Policies und ungenutzte Indizes anhand echter Last priorisieren.
- Boolean-Helper-RPCs mit frei übergebbarer User-ID weiter minimieren bzw. in private interne Helfer aufteilen, um unnötige Rollen-/Membership-Enumeration zu reduzieren.
- Retry-/Backoff-Strategie für serverseitige Provider-Ausfälle weiter verfeinern.
- Lasttests und optional Supabase Branching/Staging vor größerem öffentlichen Launch etablieren.
- Monitoring später um externe Benachrichtigung/Incident-Prozess und gegebenenfalls Log-Drain ergänzen.

## 12. Release-Entscheidung

### Kontrollierte Beta mit ausgewählten Rennligen

**GO.** Es sind nach aktuellem Audit keine bekannten technischen A-Blocker offen. Registrierung, Vertragsbestätigung, Auth, Rollen-/Tenant-Schutz, Mobile-Smokes, Legal-Smokes, elektronischer Widerruf, Produktionsmonitoring und kostenrelevante Abuse-Grenzen sind vorhanden bzw. live verifiziert.

### Breit beworbene offene Self-Service-Beta

**GO nach B-Minimum:** Leaked Password Protection + CAPTCHA/Bot-Schutz aktivieren, Auth-Mailtemplates live abgleichen, Monitoring-Verantwortung und Backup/Restore klären. Externe Legal-/Privacy-Prüfung bleibt für breite Vermarktung empfohlen.

## 13. Nicht durch den Abschlussaudit verändert

- keine Fahrer-, Saison- oder Rennergebnisdaten der produktiven Liga `rcc`,
- kein Branding oder Inhalt der produktiven Liga `rcc`,
- keine aktiven Supabase-Mailtemplates im Dashboard,
- keine Supabase-Auth-Passwörter.