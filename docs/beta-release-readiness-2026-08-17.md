# RaceVora Beta-Release-Readiness · 17.08.2026

Status: **technisch weitgehend beta-fähig; Rechtstexte vorhanden; Verbraucher-Widerrufsfunktion noch als Release-Blocker offen.**

## 1. Plattform / Deployment

- [x] Produktivdomain `https://racevora.com/`.
- [x] Landingpage, Registrierung, Passwort-Recovery und Passwort-Setup vorhanden.
- [x] Öffentlicher Read-only Race-Hub der bestehenden Liga `rcc` bleibt als Smoke-Ziel erhalten.
- [x] Multi-Tenant-/Rollen-Security separat auditiert (`docs/security-audit-2026-08-16.md`).
- [x] JavaScript-, Browser-, Branding-, Tenant-Security-, Results-/Team-Asset-, AI-Mobile- und Admin-iPhone-Smokes vorhanden.

## 2. Produktionsmonitoring

- [x] Stündlicher Workflow `.github/workflows/production-health.yml`.
- [x] HTTP-Fehlerprüfung, Inhaltsmarker, Timeouts und Retries.
- [x] Keine eigene Besucher-/Session-/PII-Telemetrie.
- [ ] Benachrichtigungskanal für fehlgeschlagene GitHub Actions organisatorisch festlegen.

Der aktuelle Supabase-Connector erlaubt in dieser Sitzung keinen Zugriff auf Auth-, API- oder Edge-Function-Logs. Diese Logs konnten daher nicht als Bestandteil dieses Audits bewertet werden.

## 3. Supabase Auth-E-Mails

Versionierte RaceVora-Templates unter `supabase/email-templates/racevora/`:

- [x] Confirm Signup
- [x] Reset Password
- [x] Invite User
- [x] Magic Link
- [x] Change Email Address
- [x] CI-Smoke prüft Branding und Template-Platzhalter.
- [ ] **MANUELLER LIVE-CHECK:** Im Supabase-Dashboard bestätigen, dass diese Versionen als aktive Auth-Mailtemplates hinterlegt sind.
- [ ] Testzustellung für Signup, Reset und Invite an ein kontrolliertes Testpostfach durchführen.

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
- [x] `widerruf.html` mit Verbraucher-Widerrufsbelehrung.
- [x] Rechtstext-Links auf der Landingpage.
- [x] Rechtstext-Links im gemeinsamen App-Footer.
- [x] Registrierung enthält echte Links statt des früheren Platzhalters.
- [x] Registrierung kennzeichnet die Beta als kostenlos.
- [x] Datenschutzerklärung beschreibt Cloudflare, Supabase, jsDelivr, Browser-Speicher und optionalen OpenAI-KI-Import.
- [x] Neuer CI-Workflow `Legal Release Smoke` schützt Seiten, Betreiberangaben und Verlinkungen gegen Regressionen.

## 6. Verbraucher-Widerruf – RELEASE BLOCKER

Seit 19.06.2026 verlangt § 356a BGB bei online geschlossenen Fernabsatzverträgen eine hervorgehobene elektronische Widerrufsfunktion. Sie muss mindestens Name, Vertragsidentifikation und das elektronische Kommunikationsmittel für die Eingangsbestätigung erfassen; anschließend ist eine gesonderte Bestätigungsfunktion erforderlich. Nach Absenden muss unverzüglich eine Eingangsbestätigung auf einem dauerhaften Datenträger übermittelt werden, die Inhalt sowie Datum und Uhrzeit enthält.

Aktueller Stand:

- [x] Widerrufsbelehrung öffentlich vorhanden.
- [x] `Vertrag widerrufen` ist auf Landingpage und App-Footer hervorgehoben verlinkt.
- [ ] Elektronisches Widerrufsformular mit zweistufiger Bestätigung implementieren.
- [ ] Widerruf serverseitig revisionsfest mit Zeitstempel erfassen.
- [ ] Automatische Eingangsbestätigung an das vom Verbraucher angegebene elektronische Kommunikationsmittel versenden.

Bis diese drei offenen Punkte umgesetzt sind, sollte RaceVora **nicht als vollständig für einen allgemeinen Verbraucher-Marktstart freigegeben** werden.

## 7. Vor öffentlicher Verbraucher-Beta noch zwingend

1. Elektronische Widerrufsfunktion inkl. automatischer Eingangsbestätigung fertigstellen.
2. Supabase Auth-Mailtemplates im Dashboard mit den Repo-Versionen abgleichen.
3. Signup-, Reset- und Invite-Mail je einmal an ein kontrolliertes Testpostfach zustellen.
4. Rechtstexte und Vertragsfluss vor breiter Vermarktung fachanwaltlich/datenschutzrechtlich prüfen lassen.

## 8. Nicht durch diesen Block verändert

- keine Liga-, Fahrer-, Saison- oder Ergebnisdaten,
- kein Branding der produktiven Liga `rcc`,
- keine RLS-/Schema-Regeln,
- keine Auth-User,
- keine Supabase-Mailtemplates im Live-Dashboard.
