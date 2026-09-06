# RaceVora · Off-site-Backup-Betrieb

Stand: 06.09.2026

## Aktueller Sicherungsweg

- Production: `znnkwjogtvzwfkwnmawp`. Staging ist keine Backup-Quelle.
- Ziel: privater EU-R2-Bucket `racevora-backups` am bestehenden Endpunkt `https://d6a0b4e37ee0e3c967648473dbe190e1.eu.r2.cloudflarestorage.com`.
- Datenbank: Rollen, Schema, Daten und separater Auth-Datenexport; Recovery-Format 2.
- Storage: öffentliche Objektdateien samt SHA-256 und Bucket-Definitionen. Leere private Buckets bleiben als private Definition erhalten. Sobald private Objekte vorhanden sind, bricht die Sicherung ausdrücklich ab; dann muss ein authentifizierter Backup-Weg ergänzt werden. Keine Dateien werden stillschweigend ausgelassen und keine Buckets veröffentlicht.
- Verschlüsselung: GnuPG/AES-256 auf dem temporären Runner, vor dem Upload. Keine Datenbank-Backups in Git oder GitHub-Artefakten.

## GitHub Actions

Workflow: **Encrypted Off-site Backup**. Der Backup-Job läuft täglich um 02:17 UTC, bei manueller Ausführung und nach Änderungen an seiner Definition auf `main`. Pull Requests prüfen nur die Definition und haben keinen Backup-Zugriff.

Die frühere Variable `RACEVORA_BACKUPS_ENABLED` und der `force`-Schalter werden nicht mehr verwendet. Fehlende Zugänge, falsches Datenbankprojekt und fehlgeschlagene Exporte führen zu einem roten Lauf statt einem grünen, übersprungenen Backup. Zum bewussten Pausieren den Workflow in GitHub deaktivieren; dies ist kein gesunder Sicherungsbetrieb.

Erforderliche Actions-Secrets:

- `SUPABASE_DB_URL`: Session-Pooler aus **RaceVora Production**, Port 5432, Rolle `postgres.znnkwjogtvzwfkwnmawp`, Datenbank `postgres`. Der direkte Projekt-Host wird ebenfalls akzeptiert, benötigt jedoch IPv6-Erreichbarkeit. Der alte Projektzugang wird abgelehnt.
- `R2_ACCESS_KEY_ID` und `R2_SECRET_ACCESS_KEY`: ausschließlich für den privaten Backup-Bucket berechtigt.
- `BACKUP_ENCRYPTION_PASSPHRASE`: mindestens 24 zufällige Zeichen, separat sicher verwahren.

Keine geheimen Werte in Chat, Issues, Logs oder Dokumente kopieren. Die Bestätigung vorhandener Secret-Namen beweist nicht, dass die Werte zum aktuellen Projekt gehören.

## Erfolgreicher Backup-Nachweis

Der Job `encrypted-backup` muss tatsächlich ausgeführt und alle Schritte erfolgreich abgeschlossen haben: Datenbank/Auth, Storage, Verschlüsselung, Upload und Remote-Prüfung. Nur `validate-backup-definition` grün reicht nicht.

Die Dateien liegen unter `daily/YYYY/MM/DD/racevora-backup-YYYYMMDDTHHMMSSZ.tar.gz.gpg` mit zugehöriger `.sha256`-Datei. Der Workflow löscht keine älteren R2-Backups; eine Aufbewahrungsfrist muss separat beschlossen werden. Ein erfolgreicher Upload beweist noch keine erfolgreiche Wiederherstellung.

## Wiederherstellungsprobe – noch offen

Das historische Drill-Projekt `lugedxtmfitxrkacmjpb` wurde gelöscht. Die Datenbank- und Storage-Restore-Helfer sind deshalb vor jeglichem Zugriff gesperrt. Alte Recovery-Manifeste dokumentieren ausschließlich damalige Prüfungen.

Eine neue Probe benötigt ein separat freigegebenes, isoliertes Ziel und ausschließlich dafür geltende Zugänge. **Weder Production `znnkwjogtvzwfkwnmawp` noch Staging `nfvwarlowjqphytqqtxz` darf dafür zurückgesetzt werden.** Vor Freigabe sind Kosten, Pooler, Sicherheitsregeln, Auth-/Storage-Rekonfiguration und die Wiederherstellungsprüfung zu klären.

Historische Schritte im [Operations-Runbook](operations-runbook.md) bleiben als Referenz erhalten, gelten aber nicht als aktuelle Betriebsabnahme.
