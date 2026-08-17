# RaceVora Beta-Release-Readiness · 17.08.2026

Status: **technisch weitgehend beta-fähig, rechtlich noch nicht freigabefähig**.

Diese Checkliste trennt bewusst automatisierbare technische Nachweise von Punkten, die Betreiberangaben oder eine manuelle Prüfung im Supabase-Dashboard erfordern.

## 1. Plattform / Deployment

- [x] `https://racevora.com/` ist die produktive Plattformdomain.
- [x] Öffentliche Landingpage, Registrierung, Passwort-Recovery und Passwort-Setup sind im Repository vorhanden.
- [x] Öffentlicher Read-only Race-Hub der bestehenden Liga `rcc` bleibt als Smoke-Ziel erhalten.
- [x] Multi-Tenant-/Rollen-Security wurde in `docs/security-audit-2026-08-16.md` separat auditiert.
- [x] JavaScript-, Browser-, Branding-, Tenant-Security-, Results-/Team-Asset-, AI-Mobile- und Admin-iPhone-Smokes bestehen auf `main`.

## 2. Produktionsmonitoring

- [x] Workflow `.github/workflows/production-health.yml` ergänzt.
- [x] Prüft Landing, Registrierung, Passwort-Recovery, Passwort-Setup und den öffentlichen `rcc` Race Hub.
- [x] Nutzt HTTP-Fehlerprüfung, Inhaltsmarker, Timeouts und drei Versuche.
- [x] Keine eigene Besucher-/Session-/PII-Telemetrie.
- [x] Stündliche Prüfung über GitHub Actions geplant.
- [ ] Benachrichtigungskanal für fehlgeschlagene GitHub Actions organisatorisch festlegen (GitHub Notifications/E-Mail oder später dediziertes Monitoring).

Hinweis: Der aktuelle Supabase-Connector erlaubt in dieser Sitzung keinen Zugriff auf Auth-, API- oder Edge-Function-Logs. Diese Logs konnten daher nicht als Bestandteil dieses Audits bewertet werden.

## 3. Supabase Auth-E-Mails

Versionierte RaceVora-Templates liegen unter `supabase/email-templates/racevora/` für:

- [x] Confirm Signup
- [x] Reset Password
- [x] Invite User
- [x] Magic Link
- [x] Change Email Address
- [x] CI-Smoke prüft Branding und Template-Platzhalter.
- [ ] **MANUELLER LIVE-CHECK:** Im Supabase-Dashboard bestätigen, dass die versionierten RaceVora-HTML-Templates tatsächlich als aktive Auth-Mailtemplates hinterlegt sind.
- [ ] Testzustellung an ein kontrolliertes Testpostfach für Signup, Reset und Invite durchführen.

Der verwendete Supabase-Connector stellt keine Aktion zum Lesen oder Ändern der aktiven Auth-Mailtemplates bereit. Deshalb darf dieser Punkt nicht automatisch als erledigt markiert werden.

## 4. Rechtstexte – RELEASE BLOCKER

Aktueller Befund:

- [ ] `impressum.html` fehlt.
- [ ] `datenschutz.html` fehlt.
- [ ] `agb.html` fehlt.
- [ ] Öffentliche Landingpage enthält keine Rechtstext-Links.
- [ ] Gemeinsamer App-Footer enthält keine Rechtstext-Links.
- [ ] Registrierung enthält noch den sichtbaren Platzhalter: „die Dokumente werden vor dem Marktstart verlinkt“.

### Benötigte Betreiberangaben für das Impressum

Vor Erstellung einer veröffentlichbaren Fassung müssen mindestens die tatsächlich zutreffenden Betreiberangaben vorliegen:

- vollständiger Name / Firma des Diensteanbieters,
- ladungsfähige Anschrift,
- geschäftliche E-Mail-Adresse,
- weitere schnelle Kontaktmöglichkeit, soweit erforderlich bzw. vorgesehen,
- Rechtsform und Vertretungsberechtigte, falls juristische Person,
- Handels-/Unternehmensregister und Registernummer, falls vorhanden,
- Umsatzsteuer-ID bzw. Wirtschafts-ID, falls vorhanden,
- ggf. zuständige Aufsichtsbehörde / berufsrechtliche Angaben, sofern einschlägig.

Rechtsgrundlage für die allgemeine Anbieterkennzeichnung: § 5 Digitale-Dienste-Gesetz (DDG):
https://www.gesetze-im-internet.de/ddg/__5.html

### Benötigte Angaben für die Datenschutzerklärung

Die Datenschutzerklärung muss anhand der tatsächlich eingesetzten Verarbeitungsvorgänge erstellt werden. Für RaceVora sind mindestens zu prüfen und korrekt zu beschreiben:

- Verantwortlicher und Kontaktdaten,
- Account-/Authentifizierungsdaten,
- Liga-, Fahrer- und Rollen-/Berechtigungsdaten,
- Supabase als Backend-/Auth-Infrastruktur,
- Cloudflare/Hosting und technisch erforderliche Server-Logs,
- KI-Ergebnisimport und die dabei verarbeiteten Bild-/Ergebnisdaten,
- OpenAI-Aufruf innerhalb des KI-Imports einschließlich Datenfluss und Aufbewahrung,
- E-Mail-Versand/Auth-Mails,
- lokale Browser-Speicher/technisch erforderliche Cookies bzw. Storage,
- Zwecke, Rechtsgrundlagen, Empfänger, Speicherfristen und Betroffenenrechte,
- etwaige Drittlandübermittlungen und hierfür verwendete Garantien.

DSGVO Art. 13 verlangt bei Datenerhebung u. a. Informationen über Verantwortlichen/Kontaktdaten, Zwecke und Rechtsgrundlagen:
https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679

### AGB

Die AGB dürfen erst finalisiert werden, wenn das konkrete Beta-/Geschäftsmodell feststeht. Vorher zu entscheiden:

- Vertragspartner: Rennliga/Organisation, Verbraucher oder ausschließlich Unternehmer?
- kostenloser Beta-Zugang oder kostenpflichtiger Tarif,
- Leistungsumfang und Verfügbarkeit,
- Laufzeit/Kündigung,
- Preise, Zahlungsweise und Steuern,
- Regeln zu Nutzer-/Liga-Inhalten und Bild-Uploads,
- Rechte an hochgeladenen Inhalten,
- KI-Funktion: Entwurfscharakter und Prüfpflicht der Ligaleitung,
- Haftung/Gewährleistung im gesetzlich zulässigen Rahmen,
- Sperrung/Löschung und Datenexport nach Vertragsende,
- Änderung von Leistungsumfang/AGB,
- ggf. Verbraucherinformationen/Widerruf, falls B2C angeboten wird.

Bei einem B2C-Angebot ist außerdem zu prüfen, welche Informationspflichten nach dem Verbraucherstreitbeilegungsgesetz tatsächlich einschlägig sind. § 36 VSBG:
https://www.gesetze-im-internet.de/vsbg/__36.html

## 5. Vor öffentlicher Beta zwingend

1. Betreiberangaben liefern und Impressum final erstellen.
2. Tatsächliche Datenflüsse/Dienstleister bestätigen und Datenschutzerklärung final erstellen.
3. Beta-Geschäftsmodell festlegen und daraus AGB ableiten.
4. Rechtstexte auf Landing, Registrierung und App-Footer verlinken.
5. Registrierungs-Checkbox mit echten Links statt Platzhalter ausliefern.
6. Supabase Auth-Mailtemplates im Dashboard manuell mit den Repo-Versionen abgleichen.
7. Signup-, Reset- und Invite-Mail je einmal an ein kontrolliertes Testpostfach zustellen.
8. Production-Health-Workflow nach Merge einmal erfolgreich gegen die Live-Domain laufen lassen.
9. Vor kommerziellem Marktstart Rechtstexte und Vertragsfluss fachanwaltlich/datenschutzrechtlich prüfen lassen.

## 6. Nicht durch diesen Release-Check verändert

- keine Liga-, Fahrer-, Saison- oder Ergebnisdaten,
- kein Branding der produktiven Liga `rcc`,
- keine RLS-/Schema-Regeln,
- keine Auth-User,
- keine Supabase-Mailtemplates im Live-Dashboard.
