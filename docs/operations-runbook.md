# RaceVora Operations & Recovery Runbook

Stand: 17.08.2026

Dieses Runbook beschreibt den operativen Mindeststandard fuer die kontrollierte RaceVora-Beta. Es ersetzt keine externe Datenschutz-, Rechts- oder Infrastrukturberatung.

## 1. Verantwortung und Incident-Kanal

- Operative Verantwortung: **Richard Rewitzer**.
- Primaerer technischer Incident-Kanal: GitHub Issues im Repository `RewitzerTS/RaceControlCenter` mit dem Label `production-health`.
- Der bestehende Workflow `.github/workflows/production-health.yml` prueft die produktiven Kernrouten stuendlich.
- `.github/workflows/production-health-incident.yml` erzeugt bei einem fehlgeschlagenen geplanten/manuellen Production-Health-Lauf automatisch ein Incident-Issue bzw. aktualisiert das bereits offene Issue.
- Sobald ein nachfolgender Production-Health-Lauf wieder erfolgreich ist, wird das offene Incident-Issue automatisch mit Verweis auf den erfolgreichen Lauf geschlossen.
- Allgemeiner Kontakt: `kontakt@racevora.com`.
- Support/Security-Eingang: `support@racevora.com`.

Pull-Request-Smokes erzeugen bewusst keine Produktions-Incidents.

## 2. Erste Reaktion auf einen Production-Health-Alarm

1. Das `production-health`-Issue und den verlinkten GitHub-Actions-Lauf oeffnen.
2. Pruefen, welcher konkrete Check fehlschlaegt: Domain/Cloudflare, statische Seite, Security Header, Supabase Edge Function oder oeffentlicher Race Hub.
3. Cloudflare-Deployment-Check des letzten `main`-Commits kontrollieren.
4. Bei Supabase-bezogenen Fehlern Projektstatus und relevante Auth/API/Edge-Function-Logs pruefen.
5. Keine destruktiven Datenbank- oder Restore-Aktionen ausfuehren, solange Ursache und Recovery-Punkt nicht klar sind.
6. Bei einem Datenvorfall zuerst Schreibzugriffe/fehlerhafte Deployments stoppen bzw. zurueckrollen, dann Datenstand sichern und erst danach Recovery planen.

## 3. Besonders geschuetzter Produktionstenant

Die Liga mit Slug `rcc` ist produktiv und darf niemals als Testziel fuer destructive Recovery-, Reset-, Migrations- oder Restore-Drills verwendet werden.

Vor jedem Recovery-Schritt sicherstellen, dass Quelle, Zielprojekt und Tenant eindeutig identifiziert sind.

## 4. Supabase-Backup-Status im aktuellen Free-Plan

Am 17.08.2026 wurde fuer das produktive Supabase-Projekt `kjccstcbqygxuqkvdaqw` der Organisationsplan **Free** verifiziert. Projektstatus: `ACTIVE_HEALTHY`, Region `eu-west-1`, PostgreSQL 17.

Nach aktueller Supabase-Dokumentation gilt fuer den Free-Plan:

- keine garantierten automatischen Datenbankbackups,
- keine Point-in-Time-Recovery-Funktion,
- Free-Projekte sollen regelmaessig selbst per Supabase CLI `db dump` exportiert und ausserhalb von Supabase gesichert werden,
- Datenbankbackups enthalten nicht die eigentlichen Supabase-Storage-Dateien.

Daher darf die kontrollierte Beta nicht davon ausgehen, dass Supabase im Free-Plan einen jederzeit verfuegbaren Restore-Punkt bereitstellt.

## 5. Backup-Policy fuer die kontrollierte Beta

Bis zu einem Upgrade auf einen Plan mit garantierten automatischen Backups gilt:

- **taeglicher Zielrhythmus** fuer ein logisches Datenbankbackup, sobald mehrere externe Ligen aktiv Daten pflegen,
- zusaetzliches Backup unmittelbar vor groesseren Schema-/Datenmigrationen oder risikoreichen Produktionsaenderungen,
- mindestens ein aktuelles Backup ausserhalb von Supabase und ausserhalb des produktiven Systems aufbewahren,
- Backups wegen moeglicher personenbezogener Daten verschluesselt und zugriffsbeschraenkt speichern,
- Datenbank-Verbindungsstrings, Datenbankpasswoerter, Service-Role-Keys oder Supabase-Access-Tokens niemals in Repository-Dateien, Issues oder Actions-Logs schreiben.

Wenn dieser Backup-Rhythmus betrieblich nicht verlaesslich eingehalten werden kann, sollte vor einer breiten Self-Service-Beta auf einen Supabase-Plan mit automatischen Backups gewechselt werden.

## 6. Logisches Datenbankbackup

Supabase empfiehlt fuer einen portablen logischen Export getrennte Dumps fuer Rollen, Schema und Daten. Verbindung immer ueber einen lokal gesetzten Secret-Wert bereitstellen, zum Beispiel `SUPABASE_DB_URL`; den Wert niemals committen.

Aktueller offizieller Grundablauf:

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql
supabase db dump --db-url "$SUPABASE_DB_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

Die erzeugten Dateien muessen nach dem Export in einen verschluesselten Off-Site-Speicher verschoben werden. Sie duerfen nicht in dieses Git-Repository eingecheckt werden.

Wichtig: Ein Standard-CLI-Dump ist kein Ersatz fuer einen vollstaendigen Supabase-Projektklon. Auth-Konfiguration, API-Keys, Edge Functions, Realtime-/Projektsettings und Storage-Objekte muessen im Disaster-Recovery-Plan separat beruecksichtigt werden.

## 7. Supabase Storage

Ein Datenbankdump enthaelt nur Datenbank-/Storage-Metadaten, nicht die eigentlichen Objektdateien.

Fuer geschäftskritische Uploads/Assets deshalb separat:

1. alle produktiv verwendeten Buckets inventarisieren,
2. Objektdateien regelmaessig ueber Supabase Storage/S3-kompatiblen Zugriff in einen geschuetzten externen Speicher spiegeln,
3. Bucket-Namen und benoetigte Policies/Settings im Repo bzw. in Migrationen dokumentieren,
4. bei einem Restore zuerst Datenbank und Policies validieren und danach die Objektdateien in die korrekten Buckets zurueckspielen.

## 8. Auth und Projektkonfiguration

Ein Disaster-Recovery-Test muss neben den App-Tabellen auch pruefen:

- Auth-Nutzer und deren Migrations-/Restore-Pfad,
- aktive Auth-Mailtemplates und SMTP-Konfiguration,
- Turnstile/CAPTCHA-Konfiguration,
- Redirect-URLs/Auth-Settings,
- Edge Functions und deren Secrets,
- Realtime-/Database-Settings,
- Storage-Buckets, Policies und Objektdateien.

Secrets werden nicht im Runbook gespeichert. Bei einem neuen Zielprojekt muessen sie aus dem jeweiligen Secret-Manager/Dashboard neu gesetzt werden.

## 9. Restore-Verantwortung und Ablauf

Restore-Verantwortlicher ist Richard Rewitzer.

Standardvorgehen:

1. Incident einfrieren und Ursache dokumentieren.
2. Letztes belastbares Backup identifizieren und Integritaet/Datum pruefen.
3. Wenn moeglich **nicht zuerst ueber Produktion restaurieren**, sondern in einem getrennten nichtproduktiven Supabase-Projekt wiederherstellen.
4. Schema, RLS/Policies, Rollen, zentrale Tabellen und Tenant-Isolation pruefen.
5. Insbesondere sicherstellen, dass der geschuetzte `rcc`-Tenant korrekt und unverfaelscht vorhanden ist.
6. Auth, Edge Functions, Turnstile, Mailversand und Storage separat rekonfigurieren/validieren.
7. Erst nach erfolgreicher Validierung einen produktiven Recovery-Schritt planen.
8. Nach Recovery Production Health, Login, Registrierung, Passwort-Recovery, Race Hub und zentrale Adminpfade testen.
9. Incident-Issue mit Ursache, Recovery-Punkt und getroffenen Massnahmen dokumentieren.

Ein Restore kann Downtime verursachen. Bei unbekannter Datenkonsistenz keine Nutzer-Schreibvorgaenge parallel zum Restore zulassen.

## 10. CLI-Restore-Grundmuster

Fuer einen zuvor per Supabase CLI erzeugten logischen Export beschreibt Supabase aktuell folgenden PSQL-Grundablauf fuer ein **Zielprojekt**:

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$TARGET_DB_URL"
```

Dieser Ablauf darf nicht blind gegen die Produktion ausgefuehrt werden. Vorher muessen Zielprojekt, Extensions, Migration History, Auth-/Storage-Sonderfaelle und erforderliche Projektkonfigurationen geprueft werden.

## 11. Recovery-Drill

Vor einer breit beworbenen Self-Service-Beta sollte mindestens einmal ein kontrollierter Disaster-Recovery-Drill in einer nichtproduktiven Umgebung erfolgen:

- Backup erstellen,
- Restore in separates Ziel,
- Kern-Tabellen/RLS/Tenant-Isolation validieren,
- Auth-/Storage-Recovery dokumentieren,
- Production-Code nicht gegen dieses Testziel umschalten,
- `rcc` niemals als destruktives Testziel verwenden.

Danach den tatsaechlichen RPO/RTO und fehlende manuelle Schritte in diesem Runbook nachtragen.
