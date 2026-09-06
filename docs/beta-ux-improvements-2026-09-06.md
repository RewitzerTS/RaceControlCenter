# Beta-Verbesserungen · 6. September 2026

Basis: UI/UX-Audit vom 6. September. Ziel: bestehendes Design verbessern, keine neue Designsprache und keine Änderung der Wertungsregeln. Veröffentlichung zunächst ausschließlich auf Staging.

## Umsetzung

- [x] P1: Mobile Fahrer-WM mit Position, Fahrer und Punkten direkt sichtbar; weitere Angaben erreichbar halten.
- [x] P1: Kontrast von Handlungsbuttons und Rennnamen verbessern.
- [x] P2: Anmeldung/Registrierung verständlicher formulieren und Feldhinweise barrierefrei verknüpfen.
- [x] P2: Bereichsnavigation und nächste Aktionen eindeutig beschriften.
- [x] P2: Fehlenden Ligakontext verständlich behandeln; Tutorials nicht auf fehlenden Zielen fortsetzen.
- [x] P2: Instagram-Entwürfe nach interner Navigation wiederherstellen; neue Textblöcke sinnvoll platzieren.
- [x] P2: Landingpage lädt Animationsbilder bedarfsgerecht und das mobile Video nur bei passendem Gerät.
- [x] P2: Unabhängige Rennkarten-/Streckenkarten-Bedienung und ausreichende Touch-Flächen.
- [x] P2: Demo als Beispieldaten kennzeichnen und nächsten Einstieg anbieten.
- [x] P1: Im echten E2E gefundene doppelte Fastest-Lap-Addition in der Anzeige verhindern: versionierte Ergebniswerte sind verbindlich, inklusive Steward-Abzügen. Keine Datenbank-/Wertungsregeländerung.

## Prüfung und Übergabe

- [x] Automatisierte Komponenten-, Vertrags- und Browserprüfungen ergänzen und ausführen (236 Tests, 16 Desktop-/Mobil-Browsertests; erneuter vollständiger Release-Lauf folgt).
- [ ] Desktop/Mobil: Landingpage, Kalender, Ergebnisse, Meisterschaft, Profil und Fehlersituationen prüfen.
- [ ] Staging-E2E: Registrierung → Profil → Liga (mit echten Konten, soweit zugänglich).
- [ ] Staging-E2E: Beitrittsanfrage → Annahme (mit getrennten Rollen, soweit zugänglich).
- [ ] Staging-E2E: Ergebnisentwurf → Veröffentlichung → Wertung.
- [ ] Staging-E2E: Protest → Entscheidung → Ergebnisrevision.
- [ ] Änderungen committen, Staging-Branch pushen, Staging sicher deployen und Version kontrollieren.

Nicht ausführbare Prüfungen werden ausdrücklich offen dokumentiert, nicht als bestanden gewertet. Keine Änderungen an echten Production-Daten. Production-Deployment erst nach Freigabe.

## Echter Staging-E2E: Beobachtungen

Mit ausdrücklicher Freigabe wurde die private Liga `QA Beta UX 2026-09-06` angelegt (ID `2e1c116b-4788-4d35-9b08-224443a19942`, Slug `qa-beta-ux-2026-09-06`). Testsaison mit zwei fiktiven Spielern QA_EINS/QA_ZWEI, 18 Spiel-KI-Fahrern und einem Monaco-Rennen; Fastest-Lap-Regel aktiv.

- Saisonwizard erfolgreich gespeichert.
- CSV mit zwei Ergebniszeilen als Entwurf gespeichert; danach separat als V1 veröffentlicht.
- Testfall RV-2026-0001 erstellt. Finalisierung ohne Stimme wurde erwartungsgemäß abgewiesen. Stimme gespeichert, Entscheidung mit einem Punkt Abzug veröffentlicht; offizielle Ergebnisrevision V2 angezeigt.
- Öffentliche Ergebnistabelle zeigte vor Revision 27 statt der importierten 26 Punkte. Nach einem Punkt Abzug zeigte sie 25. Codeprüfung bestätigte die zusätzliche Legacy-Bonuskorrektur auf bereits versionierte Werte; Anzeige-Fix und Regressionstest ergänzt. Erneute Kontrolle nach Deployment steht aus.
- Keine BOT-Markierung bei den beiden Testspielern; Fastest-Lap-Markierung sichtbar.
- Testdaten bleiben dauerhaft und ausschließlich in Staging erhalten. Keine Löschung durchgeführt.

Noch offen / nicht als bestanden gewertet:

- Registrierung mit Bestätigungsmail und Beitrittsanfrage mit getrenntem Fahrer-/Leitungs-Konto: aktuell nur die bestehende Owner-Sitzung verfügbar.
- P2: Steward-Fehler und einige Auswahlwerte erscheinen noch auf Englisch.
- P2: Ergebnistabelle zählt 22 Fahrer, obwohl der Saisonwizard 20 Sitze bestätigt. Auch die beiden ersetzten Spiel-Fahrer erscheinen mit 0 Punkten. Saisonfilter gesondert prüfen.
- P2: CSV-Hinweis soll klarstellen, ob Punkte bereits den Bonus enthalten; nicht ohne Prüfung der gesamten Importkette ändern.

Die ursprünglichen neun UI/UX-Punkte sind umgesetzt. Neue E2E-Befunde sind oben ausdrücklich separat erfasst; eine vollständige Beta-Freigabe wird daraus nicht abgeleitet.
