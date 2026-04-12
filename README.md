# Race Control Center · TrackVision Studio

GitHub-Pages-fähiges Saisonstart-Paket mit mehrseitigem Aufbau.

## Struktur
- `index.html` Übersicht
- `kalender.html` Rennkalender
- `ergebnisse.html` Ergebnisse
- `fahrer-wm.html` Fahrer-WM
- `team-wm.html` Team-WM
- `stewards.html` Stewards
- `admin.html` Admin-Bereich
- `rennen-detail.html` Detailansicht für gefahrene Rennen
- `assets/css/style.css` gesamter Stil in einer CSS-Datei
- `assets/js/app.js` Navigation + lokaler Admin-Speicher
- `assets/images/logo.png` Logo
- `data/sample-results.csv` Importbeispiel

## Upload zu GitHub
Die komplette Ordnerstruktur hochladen. Besonders wichtig:
- `assets/css/style.css`
- `assets/js/app.js`
- `assets/images/logo.png`

## Hinweise
- Die Seite ist responsive und passt Inhalte an die Bildschirmgröße an.
- Der Admin-Bereich speichert in dieser statischen Version lokal im Browser via `localStorage`.
- Für mehrere Admins gleichzeitig wäre später ein Backend oder eine Datenbank sinnvoll.

## 2026 Update
- Länderflaggen + Track Maps mit robusterem Matching
- Saisonwechsel startet mit leerem Rennkalender
- Import und Stewarding im Admin-Bereich über der Fahrereingabe


## Architektur-Update 2026

- Saison- und Rennlogik liegt zentral in `assets/js/services/rcc-data.js`.
- Zeitabhängige Fahrzeug-/BOT-Zuordnungen laufen über `assets/js/services/rcc-driver-context.js`.
- Die SQL-Migration für saubere Mid-Season-Wechsel liegt in `database/2026-driver-season-assignments.sql`.
