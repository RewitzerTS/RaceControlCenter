# RaceVora · Verschluesselte Off-Site-Backups aktivieren

Stand: 17.08.2026

Die technische Backup-Automation ist in `.github/workflows/encrypted-offsite-backup.yml` vorbereitet, aber **standardmaessig deaktiviert**. Sie wird erst aktiv, wenn der externe Speicher und die benoetigten GitHub-Secrets eingerichtet sind.

## Zielarchitektur

- Quelle: produktives Supabase-Projekt `kjccstcbqygxuqkvdaqw`.
- Datenbank: logischer Supabase-CLI-Dump von Rollen, Schema und Daten plus separater PostgreSQL-17-Auth-Datenexport im selben verschluesselten Archiv.
- Storage: aktuell ein oeffentlicher Bucket `league-brand-assets`; am 17.08.2026 wurden 4 Objekte inventarisiert.
- Verschluesselung: Backup wird auf dem temporaeren GitHub-Runner mit GnuPG/AES-256 symmetrisch verschluesselt, bevor es den Runner verlaesst.
- Off-Site-Ziel: privater Cloudflare-R2-Bucket `racevora-backups` mit **EU-Jurisdiction**.
- R2-Endpunkt: `https://d6a0b4e37ee0e3c967648473dbe190e1.eu.r2.cloudflarestorage.com`.
- GitHub speichert **kein** Backup als Actions-Artefakt und committed keine Backup-Dateien.

Cloudflare dokumentiert fuer R2, dass eine EU-Jurisdiction die Speicherung der Objekte innerhalb der Europaeischen Union garantiert. R2-Buckets mit Jurisdiction muessen ueber den entsprechenden `.eu.r2.cloudflarestorage.com`-Endpunkt angesprochen werden.

## 1. EU-R2-Bucket erstellen

Im Cloudflare Dashboard:

1. **R2 Object Storage** oeffnen.
2. **Create bucket**.
3. Bucketname exakt `racevora-backups`.
4. Unter Location **Specify jurisdiction → European Union (EU)** waehlen.
5. Bucket erstellen.
6. **Keinen Public Development URL / keine Custom Domain / keinen oeffentlichen Zugriff aktivieren.**

Die Jurisdiction kann laut Cloudflare nach Erstellung des Buckets nicht nachtraeglich geaendert werden. Deshalb direkt EU waehlen.

## 2. Bucket-beschraenkte R2-Zugangsdaten erstellen

Im R2-Bereich einen API Token/S3-Zugang erstellen:

- Berechtigung: **Object Read & Write**.
- Zugriff ausschliesslich auf den Bucket `racevora-backups` beschraenken.
- Kein Account-Admin-Token verwenden.

Cloudflare zeigt danach **Access Key ID** und **Secret Access Key** an. Den Secret Access Key nicht in Chats, Issues, Commits oder Dokumente kopieren.

## 3. Supabase-Datenbankverbindung als GitHub Secret hinterlegen

In GitHub:

`RewitzerTS/RaceControlCenter → Settings → Secrets and variables → Actions → Secrets`

Secret anlegen:

- `SUPABASE_DB_URL`

Als Wert eine produktive Supabase-Postgres-Verbindungs-URL verwenden, die der GitHub-Runner erreichen kann. Der Wert enthaelt Datenbankzugangsdaten und darf niemals committed oder hier im Repository dokumentiert werden.

## 4. Weitere GitHub Actions Secrets

Folgende Secrets anlegen:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `BACKUP_ENCRYPTION_PASSPHRASE`

Fuer `BACKUP_ENCRYPTION_PASSPHRASE` einen langen, zufaelligen, einzigartigen Wert verwenden. Der Workflow verlangt mindestens 24 Zeichen. Diese Passphrase getrennt von R2/Supabase sicher verwahren: Ohne sie kann ein verschluesseltes Backup nicht wiederhergestellt werden.

**Keinen dieser Secret-Werte an ChatGPT senden.**

## 5. Ersten Backup-Lauf manuell testen

Solange die taegliche Automation noch deaktiviert ist:

1. GitHub → **Actions → Encrypted Off-site Backup**.
2. **Run workflow**.
3. `force` fuer diesen Test aktivieren.
4. Lauf starten.

Der Workflow muss folgende Schritte erfolgreich abschliessen:

1. Secret-Konfiguration pruefen.
2. Supabase CLI bereitstellen.
3. Rollen-/Schema-/Daten-Dump und Auth-Datenexport erstellen.
4. Storage-Buckets inventarisieren.
5. Aktuell oeffentliche Storage-Objekte herunterladen.
6. Backup lokal als `.tar.gz` paketieren.
7. Paket mit GnuPG/AES-256 verschluesseln.
8. Nur die `.gpg`-Datei und deren SHA-256-Datei in R2 hochladen.
9. Groesse des hochgeladenen R2-Objekts gegen die lokale verschluesselte Datei pruefen.
10. Lokale temporaere Backup-Dateien vom Runner entfernen.

Der Workflow bricht bewusst ab, wenn ein **privater Supabase-Storage-Bucket** entdeckt wird. Das verhindert, dass spaeter unbemerkt ein unvollstaendiges Backup als erfolgreich gilt. Dann muss die Storage-Backup-Strategie um authentifizierten Source-Zugriff erweitert werden.

## 6. Taegliche Backups aktivieren

Erst nachdem der manuelle Test gruen ist:

GitHub → **Settings → Secrets and variables → Actions → Variables**

Repository Variable anlegen:

- Name: `RACEVORA_BACKUPS_ENABLED`
- Wert: `true`

Danach laeuft der Workflow taeglich per GitHub Actions Schedule. Ohne diese Variable bleibt der eigentliche Backup-Job bei Zeitplaenen deaktiviert.

## 7. R2 pruefen

Nach dem ersten erfolgreichen Lauf muss im privaten R2-Bucket ein Pfad nach folgendem Muster vorhanden sein:

```text
daily/YYYY/MM/DD/racevora-backup-YYYYMMDDTHHMMSSZ.tar.gz.gpg
daily/YYYY/MM/DD/racevora-backup-YYYYMMDDTHHMMSSZ.tar.gz.gpg.sha256
```

Die `.gpg`-Datei ist das verschluesselte Backup. Die `.sha256`-Datei dient zur Integritaetspruefung des verschluesselten Objekts.

## 8. Restore-Probe

Eine Restore-Probe niemals zuerst gegen die produktive Datenbank ausfuehren und niemals `rcc` als destruktives Testziel verwenden.

Fuer einen Test:

1. Verschluesselte `.gpg`-Datei aus R2 lokal herunterladen.
2. SHA-256 gegen die zugehoerige `.sha256`-Datei pruefen.
3. Mit GnuPG entschluesseln; Passphrase interaktiv eingeben.
4. Archiv in einer geschuetzten lokalen/testweisen Umgebung entpacken.
5. Backup-Format 2, Datenbank-/Auth-Dumps und `storage/storage-manifest.json` pruefen.
6. Restore nur in ein getrenntes nichtproduktives Supabase-Ziel durchfuehren.

Der eigentliche Datenbank-Restore und die anschliessende Auth-/Storage-Rekonfiguration sind in `docs/operations-runbook.md` beschrieben.

## 9. Aufbewahrung

Aktuell loescht der Workflow **keine** alten R2-Backups automatisch. Eine R2-Lifecycle-Regel sollte erst bewusst nach Festlegung der betrieblichen und datenschutzrechtlichen Aufbewahrungsdauer konfiguriert werden. Dadurch kann die Automation keine Backup-Historie versehentlich loeschen.
