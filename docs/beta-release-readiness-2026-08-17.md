# RaceVora Beta-Release-Readiness · 17.08.2026

Status: **technisch beta-fähig; Verbraucher-Widerruf und zentrale Auth-Mailflows live verifiziert; vor breiter öffentlicher Beta bleiben nur wenige manuelle Betriebs-/Templatechecks offen.**

## 1. Plattform / Deployment

- [x] Produktivdomain `https://racevora.com/`.
- [x] Landingpage, Registrierung, Passwort-Recovery und Passwort-Setup vorhanden.
- [x] Öffentlicher Read-only Race-Hub der bestehenden Liga `rcc` bleibt als Smoke-Ziel erhalten.
- [x] Multi-Tenant-/Rollen-Security separat auditiert (`docs/security-audit-2026-08-16.md`).
- [x] JavaScript-, Browser-, Branding-, Tenant-Security-, Results-/Team-Asset-, AI-Mobile- und Admin-iPhone-Smokes vorhanden.
- [x] Legal Release Smoke und Electronic Withdrawal Flow als zusätzliche Release-Gates vorhanden.

## 2. Produktionsmonitoring

- [x] Stündlicher Workflow `.github/workflows/production-health.yml`.
- [x] HTTP-Fehlerprüfung, Inhaltsmarker, Timeouts und Retries.
- [x] Landing, Registrierung, Passwort-Flows und öffentlicher `rcc` Race-Hub werden read-only geprüft.
- [x] Rechtliche Seiten werden im Production Health überwacht.
- [x] Widerrufs-Edge-Function wird nicht-mutierend per `OPTIONS` geprüft.
- [x] Keine eigene Besucher-/Session-/PII-Telemetrie.
- [ ] Benachrichtigungskanal für fehlgeschlagene GitHub Actions organisatorisch festlegen.

Supabase-Auth-Logs sind inzwischen über den verbundenen Connector abrufbar. Die aktuelle Stichprobe enthält erfolgreiche Auth-/Session-Requests und keine sichtbaren Auth-Fehler. Das ersetzt kein dauerhaftes Alerting.

## 3. Supabase Auth-E-Mails

Versionierte RaceVora-Templates unter `supabase/email-templates/racevora/`:

- [x] Confirm Signup
- [x] Reset Password
- [x] Invite User
- [x] Magic Link
- [x] Change Email Address
- [x] CI-Smoke prüft Branding und Template-Platzhalter.
- [x] Custom SMTP über Resend für RaceVora eingerichtet und grundsätzlich versandfähig.
- [ ] **MANUELLER LIVE-CHECK:** Im Supabase-Dashboard bestätigen, dass die Repo-Versionen als aktive Auth-Mailtemplates hinterlegt sind.
- [x] Signup-Mail an kontrolliertes Testpostfach erfolgreich zugestellt.
- [x] Reset-Mail an kontrolliertes Testpostfach erfolgreich zugestellt.
- [x] Invite-Mail erfolgreich zugestellt und Einladung live bestätigt.
- [x] Rollenwechsel im Mitgliederflow live geprüft: Einladung als Ligaleitung, anschließend Wechsel auf `member` erfolgreich.

Signup und Reset wurden über Supabase Auth ausgelöst, von Resend als zugestellt gemeldet und tatsächlich im Zielpostfach gefunden. Der Invite-Flow wurde zusätzlich vollständig über die produktive Mitgliederverwaltung getestet; Supabase bestätigte Einladung, Account-Bestätigung und den anschließenden Rollenwechsel. Der aktuell aktive Template-Inhalt im Supabase-Dashboard kann über den verfügbaren Connector weiterhin nicht zuverlässig ausgelesen werden, deshalb bleibt nur der direkte Template-Abgleich manuell offen.

## 4. Betreiber / Kontakt

- [x] Betreiber: Richard Rewitzer.
- [x] Anschrift: Hohenzollernstr. 9, 72622 Nürtingen, Deutschland.
- [x] Allgemeiner Kontakt: `kontakt@racevora.com`.
- [x] Support: `support@racevora.com`.
- [x] Betrieb zunächst als Privatperson.
- [x] Beta kostenlos.
- [x] Nutzung auch für private/Hobby-Ligen und Verbraucher möglich.

## 5. Rechtstexte

- [x] `impressum.html`.
- [x] `datenschutz.html`.
- [x] `agb.html` für die kostenlose Beta.
- [x] `widerruf.html` mit Verbraucher-Widerrufsbelehrung und elektronischer Widerrufsfunktion.
- [x] Rechtstext-Links auf der Landingpage.
- [x] Rechtstext-Links im gemeinsamen App-Footer.
- [x] Registrierung enthält echte Links statt des früheren Platzhalters.
- [x] Registrierung kennzeichnet die Beta als kostenlos.
- [x] Datenschutzerklärung beschreibt Cloudflare, Supabase, Resend, jsDelivr, Browser-Speicher und optionalen OpenAI-KI-Import.
- [x] `Legal Release Smoke` schützt Seiten, Betreiberangaben und Verlinkungen gegen Regressionen.

## 6. Verbraucher-Widerruf

Der zuvor offene Verbraucher-Release-Blocker ist technisch geschlossen:

- [x] Hervorgehobener öffentlicher Einstieg `Vertrag widerrufen`.
- [x] Zweistufiges Formular: Angaben prüfen → `Widerruf bestätigen`.
- [x] Server-seitige Speicherung in separater `consumer_withdrawals`-Tabelle.
- [x] RLS aktiv; direkte Tabellenrechte für `PUBLIC`, `anon` und `authenticated` entzogen.
- [x] Eindeutige Referenz und UTC-Zeitstempel.
- [x] Automatische Eingangsbestätigung über Resend.
- [x] Bestätigung enthält Referenz, Name, Vertrags-/Accountkennung, Inhalt, Datum und Uhrzeit.
- [x] `confirmation_sent_at` und Resend Provider-ID werden serverseitig dokumentiert.
- [x] Betreiberkopie an `kontakt@racevora.com`.
- [x] Zusätzlicher herunterladbarer Eingangsbeleg im Browser.
- [x] Echter Live-CI-Test gegen Supabase + Resend erfolgreich.
- [x] Testmail tatsächlich zugestellt; Testdatensätze anschließend entfernt.

## 7. Vor breiter öffentlicher Beta noch offen

1. Aktive Supabase Auth-Mailtemplates im Dashboard einmal gegen die Repo-Versionen abgleichen.
2. Organisatorisch festlegen, wer fehlgeschlagene Production-Health/GitHub-Actions-Meldungen beobachtet.
3. Rechtstexte und Vertragsfluss vor breiter Vermarktung fachanwaltlich/datenschutzrechtlich prüfen lassen.

Die Punkte 1–2 sind Betriebs-/Releasechecks und keine bekannten technischen Funktionsblocker der Plattform. Punkt 3 ist eine externe rechtliche Qualitätssicherung und keine Aussage, dass die vorhandenen Texte anwaltlich geprüft wären.

## 8. Nicht durch diesen Block verändert

- keine Liga-, Fahrer-, Saison- oder Ergebnisdaten,
- kein Branding oder Inhalt der produktiven Liga `rcc`,
- keine aktiven Supabase-Mailtemplates im Dashboard.
