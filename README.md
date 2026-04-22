# Race Control Center · TrackVision Studio

GitHub-Pages-fähige Liga-Webseite mit Supabase-Backend für Saisonverwaltung, Kalender, Ergebnisse, Stewarding und Admin-Workflow.

## Seitenstruktur
- `index.html` – Dashboard / Übersicht
- `kalender.html` – Rennkalender
- `ergebnisse.html` – Ergebnis-Matrix
- `fahrer-wm.html` – Fahrerwertung
- `team-wm.html` – Teamwertung
- `rennen-detail.html` – Renn-Detailseite inkl. Stewarding
- `regeln-faq.html` – Regeln + FAQ
- `hall-of-fame.html` – Historie / Champions
- `admin.html` – Admin Center

## Tech-Stack (Frontend)
- Vanilla HTML/CSS/JS
- Chart.js für Trends/Diagramme
- Supabase JS Client (Auth + Database)

Wichtige Dateien:
- `assets/js/services/rcc-data.js` – zentrale Datenabfragen + Standings-Logik
- `assets/js/services/rcc-driver-context.js` – saisonabhängige Fahrer-/Team-Zuordnungen
- `assets/js/pages/admin.js` – Admin-Workflows
- `assets/css/style.css` und `assets/css/pages/index-dashboard.css` – UI/Responsive/Dashboard

---

## Supabase Workflow (Stand 2026)

### 1) Voraussetzungen
1. Supabase-Projekt anlegen.
2. In Supabase **Authentication → Providers** mindestens E-Mail/Passwort aktivieren.
3. Im Frontend die Projekt-URL + `anon` Key hinterlegen (siehe `assets/js/supabase-client.js`).

### 2) SQL-Migrationen anwenden
Die Migrationen liegen unter `database/`.

Empfohlene Reihenfolge für neue Setups:
1. Basis-Workflow + RLS:
   - `database/supabase-workflow-upgrade.sql`
2. Saisonhistorie/Hall-of-Fame:
   - `database/2026-season-history.sql`
   - `database/2026-v10.4.5-hof-upgrade.sql`
   - optional Seeds: `database/2026-hof-seed-seasons-2-14.sql`
3. Fahrer-/Saison-Zuordnungen:
   - `database/2026-driver-season-assignments.sql`
4. Stewarding/Workflow-Erweiterungen:
   - `database/2026-v11-steward-workflow.sql`
5. Content-/FAQ-Erweiterungen:
   - `database/2026-v11.2-league-content.sql`
   - `database/2026-v11.3-faq-items.sql`
6. Slot-/Ledger-Logik (falls genutzt):
   - `database/2026-v11.1-season-slot-ledger.sql`

> Hinweis: Bei bestehenden Instanzen bitte die jeweiligen Dateien prüfen, da viele Skripte `if not exists`/`add column if not exists` nutzen.

### 3) Admin-Zugriff einrichten
Admin-Rechte werden über `public.app_admins` gesteuert.

Beispiel (Supabase SQL Editor):
```sql
insert into public.app_admins (user_id)
values ('<AUTH_USER_UUID>')
on conflict (user_id) do nothing;
```

Die Policies im Workflow-Skript erlauben Schreibzugriff nur für `is_app_admin()`.

### 4) Typischer Betriebsablauf
1. **Saison aktiv halten** (`seasons.is_active = true` genau eine Saison).
2. Rennen im Admin Center anlegen / verschieben.
3. Ergebnisse per CSV importieren (`race_result_imports` + `race_result_import_rows`).
4. Steward-Fälle/Strafen pflegen (`steward_cases`, `race_penalties`).
5. Entwurf veröffentlichen → schreibt in `race_results`, setzt Rennen auf `completed`.
6. Saisonabschluss im Admin Center:
   - Champions in `championship_history`
   - alte Saison `is_active = false`
   - neue aktive Saison wird angelegt

### 5) Performance-Hinweis (aktuelle Saison)
Ergebnisse/WM-Seiten laden nur die aktive Saison (Rennen + zugehörige Result-Zeilen) statt globaler Vollabfragen.

---

## Deployment (GitHub Pages)
1. Repository/Dateien nach GitHub pushen.
2. GitHub Pages auf Branch + Root aktivieren.
3. Sicherstellen, dass Supabase-Projekt CORS/Redirects für die Pages-Domain zulässt.

## Lokale Entwicklung
Da es eine statische App ist, genügt ein lokaler HTTP-Server (kein `file://`).

Beispiel:
```bash
python -m http.server 8080
```
Dann: `http://localhost:8080` öffnen.
