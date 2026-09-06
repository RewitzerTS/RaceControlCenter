# Production-Härtung · 06.09.2026

Vom Owner für direkte Umsetzung und Veröffentlichung freigegeben. Basis: `main` / `6236bd46a200111f98a5b66a871cf0a85a96d5a9`. Das separate Control-Deck-Redesign von Staging gehört nicht zu diesem Paket.

## Änderungen

- Öffentliche Ergebnisse verwenden ausschließlich bereits veröffentlichte Momentaufnahmen; keine zusätzlichen anonymen Datenbankberechtigungen.
- Abgeschlossener Fehlerzustand, Wiederholen-Aktion und ausgeblendete leere Diagramme.
- Lesbare aktive Racing-Navigation, mobile Überschrift bis 320 Pixel, zugänglicher Logo-Link, Escape/Fokus-Rückkehr und sichtbare Desktop-Hauptbereiche.
- Verständlichere Anmeldungstexte und korrigierter Home-Ergebnislink.
- Tabgebundene Wiederherstellung ungespeicherter Saison-/Importeingaben, nach Nutzer, Liga und Saison getrennt, maximal 24 Stunden. Browser-Dateiobjekte werden nicht gespeichert; kein automatisches Veröffentlichen.
- Verbindliche Prüfung im sicheren Deploy-Helfer vor jeder Auslieferung; erneute Prüfung des freigegebenen Commits nach dem Build. Build-Metadaten enthalten den Commit.
- Prüfungen auf `main` und `staging`, aktuelle Produktionsüberwachung und aktualisierte Tenant-Guard-Erwartung für die legitime Rolle `league_admin`.
- Backup-Quelle auf aktuelles Production-Projekt begrenzt, täglicher tatsächlicher Sicherungslauf statt stiller Deaktivierung. Verschlüsselter R2-Upload wird zurückgelesen und per SHA-256 geprüft.
- Nachprüfung: Öffentliche Sicherheitskontaktdatei wird im Build erhalten; zwei zusätzliche HTTP-Regressionstests verhindern den unbemerkten SPA-Fallback.

## Prüfung und Grenzen

Komponenten-/Logiktests sowie acht Browserprüfungen auf Desktop und Mobil. Browserprüfungen laufen standardmäßig mit synthetischen HTTP-Antworten ohne Datenbankänderungen. Der lokale Production-Kandidat wurde zusätzlich in ausdrücklich lesendem Modus mit der öffentlichen echten RCC-Demo geprüft; alle acht Browserfälle bestanden. Die private Staging-Demo wurde nicht veröffentlicht.

Eine erfolgreiche Backup-Ausführung muss nach dem Push separat anhand des tatsächlich ausgeführten Jobs nachgewiesen werden. Vorhandene Secret-Namen sind kein Verbindungsnachweis.

Weiter offen: Wiederherstellungsprobe in einem neu freigegebenen isolierten Ziel; authentifizierte Ende-zu-Ende-Abläufe für die fünf vollständigen Geschäftsprozesse. Die alten Restore-Helfer sind gesperrt, weil ihr Ziel gelöscht wurde. Sobald private Storage-Objekte vorhanden sind, ist ein authentifizierter Backup-Weg nötig; bis dahin scheitert die Sicherung sichtbar statt Dateien auszulassen.

Supabase-Organisation am 06.09.2026: Free. Schutz gegen bekannte kompromittierte Passwörter erfordert laut [Supabase-Dokumentation](https://supabase.com/docs/guides/auth/password-security) Pro oder höher. Kein Tarifwechsel oder Auth-Konfigurationswechsel vorgenommen.

## Rückkehrpunkt

Vorherige aktive Production-Worker-Version: `f03dcd39-0a3b-4b06-b544-19afb3b20ad7` (05.09.2026). Dieses Paket enthält keine Datenbankmigration, keine Datenumschreibung und keine Änderungen an Produktionsbindungen. Ein Worker-Rollback auf diese Version bleibt getrennt von einem Datenbank-Restore; letzterer ist ausdrücklich nicht Teil des Deployments.
