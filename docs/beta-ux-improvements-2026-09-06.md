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
- [x] Staging-E2E: Konto durch Nutzer erstellt und angemeldet → Profil durch QA ausgefüllt → private Liga angefragt. E-Mail-Zustellung wurde vom Agenten nicht selbst beobachtet.
- [x] Staging-E2E: Beitrittsanfrage → Annahme. Nutzer führte die Annahme mit dem Owner-Konto durch; anschließend Mitgliedschaft als Fahrer und Verknüpfung mit QA Fahrer Eins in der Verwaltung verifiziert. Erneuter Fahrer-Login nach Annahme nicht separat beobachtet.
- [x] Staging-E2E: Ergebnisentwurf → Veröffentlichung → Wertung; dabei doppelte Bonusanzeige gefunden und behoben.
- [x] Staging-E2E: Testfall → Stimme → Entscheidung → offizielle Ergebnisrevision V2 (durch Ligaleitung; Fahrer-Protest/Einspruch nicht separat getestet).
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

- Der Nutzer hat ein zweites Konto erstellt und angemeldet. Profil QA Fahrer Eins / QA_EINS mit automatisch vergebener Profilnummer #1 gespeichert; Anfrage an die private QA-Liga sichtbar mit „Prüfung läuft“. Nach Annahme durch den Nutzer: 0 offene Anfragen, 2 Mitglieder, Testkonto mit Rolle Fahrer und Zuordnung QA Fahrer Eins bestätigt.
- P2: Einige Steward-Auswahlwerte erscheinen noch auf Englisch. Die konkret aufgetretene Meldung zur fehlenden Stimme wurde in DE/EN/ES/FR ergänzt.
- Saisonfilter für die Ergebnismatrix ergänzt: aktuelle Sitzzuordnungen plus historische Punkteinhaber bleiben erhalten; ungenutzte Spiel-Fahrer werden nicht mitgezählt. Regressionstest erfolgreich, Kontrolle nach ergänzendem Deployment steht aus.
- CSV-Importcode geprüft: points wird als veröffentlichter Punktwert übernommen. Hinweis in DE/EN/ES/FR ergänzt, dass ein Bonus bereits enthalten sein muss.

## Veröffentlichungsnachweis

Erstes Staging-Deployment erfolgreich: Quellcommit `968bc45eaf27ae323eeba8352f99fde1f63631fc`, Worker-Version `732ddb07-a9b6-4d90-98c5-0c0d08fe01d8`. Vollständiger Release-Check erfolgreich (236 Unit-/Komponententests, Vertragsprüfungen und Browser-Suite). Production unverändert auf `fd00914b3ca5273e9bc1d9a80a877cd8a571927c`. Die anschließend ergänzten E2E-Korrekturen durchlaufen vor Veröffentlichung dieselbe vollständige Prüfung.

Ergänzendes Deployment `6d8aed6690c57009bf5f962d915ffc72e35561b3`, Worker `94dc4332-50bc-45f6-98e8-6be10782e4dc`, mit 237 Tests und 16 Browserprüfungen erfolgreich. Die Kontrolle im bestehenden Browser zeigte jedoch alte Skripte: `/v1-assets/*` hatte trotz unveränderlicher Dateinamen einen einjährigen immutable-Cache. Deshalb erhalten eingebettete JS-/CSS-URLs jetzt automatisch die Build-Revision, und diese ungehashten Assets müssen revalidiert werden. Damit bekommen auch bereits besuchte Browser die Korrekturen ohne manuelles Cache-Löschen. Build-Vertragsprüfung dafür ergänzt; abschließendes Deployment folgt mit denselben Gates.

Die ursprünglichen neun UI/UX-Punkte sind umgesetzt. Neue E2E-Befunde sind oben ausdrücklich separat erfasst; eine vollständige Beta-Freigabe wird daraus nicht abgeleitet.
