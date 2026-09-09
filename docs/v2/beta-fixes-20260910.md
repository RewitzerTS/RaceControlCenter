# Beta-Korrekturen

Scope: bestehendes Design erhalten, zunächst Staging; Production unverändert.

- [x] Registrierung: vorhandenes Konto verständlich behandeln; Login/Passwort-Reset anbieten.
- [x] Liga-Auswahl im Tablet-Menü innerhalb des sichtbaren Bereichs halten.
- [x] Safe Area mit aktivem Farbthema synchronisieren (Header und Dokumentoberfläche).
- [x] Mobile Seitenbreite und Owner-Aktionsbuttons korrigieren.
- [x] Persönliches Farbthema einklappbar machen.
- [x] Renn-Detail: alte Anordnung Renninfos/Stewards, danach Platzierungen; Ergebnisversionen entfernen.
- [x] Wöchentlich drei Challenges, Auszahlung abgeschlossener Challenges bei Ablauf, idempotente Rotation.
- [x] Discord-Sichtbarkeit / öffentliche Ligaseite klären.
- [ ] Automatisierte Tests und Desktop-/Tablet-/Mobilprüfung.

Bestätigt: wöchentliche Rotation, nur abgeschlossene Challenges vergüten.
Diagnose: Production-Challenges endeten am 06.09.2026 ohne Nachfolger.
RCC public_discord ist gespeichert; bislang keine Ausgabe in der nativen Oberfläche.

## Staging-Datenbank

Migration 20260909215117_weekly_challenge_rotation am 10.09.2026 nach expliziter Freigabe
nur auf nfvwarlowjqphytqqtxz angewendet. Keine Production-Migration.
Aktuell drei Aufgaben, sechs vorab angelegte Nachfolger; Cron läuft minütlich erfolgreich.
Erste neue Woche: 10.09.2026 00:00 bis 17.09.2026 00:00 (Europe/Berlin).
Legacy-Gutschriften bleiben unverändert. Neue Regeln (Version 2) zahlen erst bei Ablauf.
Ergebniskorrekturen können eine Auszahlung nachträglich rückgängig machen.

Transaktionaler SQL-Test weekly-challenges.sql erfolgreich und vollständig zurückgerollt:
echte Ergebnisveröffentlichung, drei Abschlüsse, keine vorzeitige Auszahlung, kein BOT-Fortschritt,
500 VC genau einmal, Rücknahme auf 0 VC und Wiederaufnahme nach verpasster Woche.
Keine Testnutzer zurückgeblieben. Neue private Funktionen sind für Browserrollen nicht aufrufbar.
Advisor: private Rotationstabelle bewusst ohne Client-RLS-Policy (deny by default);
übrige Meldungen betreffen bereits bestehende RPCs bzw. Auth-Einstellungen.

## Discord / Liga-Seite

Bestehender öffentlicher Einstieg für RCC: /racing/calendar?league=rcc.
Keine dedizierte öffentliche Liga-Profilseite gefunden; gespeicherter Discord-Link wird nicht
gerendert. Eine neue öffentliche Seite ist eine separate Produktentscheidung, nicht Teil
dieser Fehlerkorrekturen.
