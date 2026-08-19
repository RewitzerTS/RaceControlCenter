# RaceVora

**RaceVora** ist eine Multi-Tenant-Plattform für Simracing-Rennligen. Sie verbindet Race Hub, Saison- und Fahrerverwaltung, Ergebnisworkflows, Stewarding, Meisterschaften, Rollen und individuelles Liga-Branding in einer gemeinsamen Web-App.

Produktiv: `https://racevora.com`

> Das Repository ist historisch aus dem **Race Control Center (RCC)** entstanden. Interne technische Präfixe wie `RCCData`, `rcc.*` Storage Keys und bestehende Migrationsnamen bleiben vorerst bewusst erhalten, um unnötige technische Migrationen zu vermeiden. Sie sind keine Plattformmarke.

## Plattform vs. Liga-Branding

- **Plattformmarke:** RaceVora
- **Tenant-/Liga-Branding:** individuell pro Liga
- **Produktive Bestandsliga:** `rcc` / Race Control Center — ihre Daten und ihr Liga-Branding dürfen bei Plattformänderungen nicht überschrieben oder zurückgesetzt werden.

## Marke & Messaging

RaceVora ist bewusst kein Akronym. **Race** verankert die Marke klar im Motorsport und Simracing; **Vora** ist ein Kunstwort mit der Assoziation *vor / vorne / vorwärts / Vorsprung*. Die zentrale Markenidee lautet: RaceVora bringt Rennligen organisatorisch und sportlich nach vorne.

Primäre Plattform-Tagline: **Your League. Your Race. One Platform.**

Die vollständige Brand Story, Messaging-Säulen, Claims und Sprachregeln stehen in [`docs/racevora-brand-story.md`](docs/racevora-brand-story.md).

## Repository-Struktur

- `index.html` – aktuelle öffentliche RaceVora-Landingpage
- `assets/` – produktive CSS-, JavaScript-, Bild- und Preview-Assets
- `components/` – wiederverwendete statische HTML-Komponenten
- `data/` – statische Plattform-/Renndaten
- `database/` – historische SQL-Migrationen und gezielte Schemaänderungen; siehe [`database/README.md`](database/README.md)
- `docs/` – aktuelle technische, operative und Marken-Dokumentation
- `docs/archive/` – historische RCC-/RaceVora-Notizen, die nicht den aktuellen Soll-Stand beschreiben
- `scripts/` – Wartungs-, Prüf- und Hilfsskripte
- `supabase/` – Edge Functions, E-Mail-Templates und Supabase-spezifische Dateien
- `tests/` – lokale/CI-nahe Tests und Fixtures
- `.github/workflows/` – CI, Security-, Browser-, Backup- und Produktions-Smokes

Die Dateien `landing.html`, `landing2.html` und `landing3.html` bleiben bewusst als **Legacy-Redirects** auf `index.html` erhalten. So brechen alte Links nicht, während es nur noch eine aktive Landingpage-Implementierung gibt.

## Wichtige Routen

- `/` / `index.html` – öffentliche RaceVora-Landingpage
- `/race-hub.html?league=<slug>` – Race Hub einer Liga
- `/register.html` – Liga-/Owner-Registrierung
- `/account-setup.html` – Auth-Bestätigung und Account-/Liga-Einrichtung
- `/forgot-password.html` – Passwort-Reset anfordern
- `/set-password.html` – Passwort nach Reset/Einladung setzen
- `/admin.html?league=<slug>` – rollenbasierter Adminbereich
- `/kalender.html`, `/ergebnisse.html`, `/fahrer-wm.html`, `/team-wm.html` – öffentliche/rollenabhängige Ligaansichten

## Tech-Stack

- Vanilla HTML/CSS/JavaScript
- Supabase: Auth, PostgreSQL, RLS, RPCs, Edge Functions
- Chart.js
- Cloudflare für die produktive Domain/Deployment-Anbindung
- GitHub Actions für Syntax- und Browser-Smoke-Tests

## Multi-Tenant-Sicherheit

Jede ligaabhängige Anfrage muss im Tenant-Kontext des angeforderten Slugs ausgeführt werden. Die Datenbank nutzt RLS und rollenbasierte Helfer/RPCs; schreibende RPCs müssen zusätzlich ihre Tenant- und Rollenprüfung selbst erzwingen.

Wichtige Regeln:

1. Kein Benutzer aus Liga A darf Daten von Liga B lesen oder verändern.
2. `anon` erhält keine unnötigen Ausführungsrechte auf privilegierte `SECURITY DEFINER`-Funktionen.
3. Neue Datenbankänderungen werden zuerst auf RLS-/RPC-Abhängigkeiten geprüft.
4. Die produktive Liga `rcc` wird nicht als destruktives Testobjekt verwendet.

## Auth und Registrierung

RaceVora nutzt Supabase Auth. Der Signup-Flow ist:

1. Liga-Name und Slug werden vorab auf Verfügbarkeit geprüft.
2. Benutzer registriert sich per E-Mail/Passwort.
3. Bestätigungslink führt auf `account-setup.html`.
4. Session, Liga und Berechtigungen werden geladen bzw. idempotent eingerichtet.
5. Weiterleitung ins Liga-Onboarding/Admin Center.

Gebrandete Supabase-Auth-E-Mail-Templates liegen unter:

`supabase/email-templates/racevora/`

## Zentrale Frontend-Dateien

- `assets/css/pages/landing-next.css` – aktuelle Landingpage inklusive Login-Modal-Grundlayout
- `assets/css/pages/landing-next-responsive.css` – responsive Landing-Anpassungen
- `assets/js/pages/landing-next.js` – Landing-Motion und Preview-Verhalten
- `assets/js/pages/landing.js` – Landing-Login, Session- und Liga-Auswahl
- `assets/js/supabase-client.js` – Supabase-Client und zentraler Tenant-/Auth-Kontext
- `assets/js/services/rcc-data.js` – zentrale Datenabfragen und Ergebnis-/Standings-Helfer
- `assets/js/services/rcc-branding.js` – ligaabhängiges Branding/Theme
- `assets/js/services/rcc-driver-context.js` – saisonabhängige Fahrer-/Team-Zuordnungen
- `assets/js/pages/admin.js` – Admin-Workflows
- `assets/js/pages/register.js` / `account-setup.js` – Registrierung und Account-Setup

## Datenbank

Migrationen liegen unter `database/`. Bestehende Instanzen nicht blind mit allen historischen SQL-Dateien neu bespielen; vor Änderungen Abhängigkeiten und aktuellen Live-Schema-Stand prüfen. Zusätzliche Regeln stehen in [`database/README.md`](database/README.md).

## Lokale Entwicklung

Die Anwendung ist statisch und benötigt einen HTTP-Server:

```bash
python -m http.server 8080
```

Danach z. B. `http://localhost:8080` öffnen.

## Entwicklung und Merge

Neue größere Änderungen werden über Feature-Branches umgesetzt. Vor Merge nach `main` müssen mindestens die relevanten JavaScript- und Browser-Smoke-Checks grün sein.
