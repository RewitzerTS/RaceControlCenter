# Phase 15 — Driver Experience

## Ergebnis

Home beantwortet zuerst, was für den Fahrer gerade im Racing relevant ist. Die deterministische Priorität lautet: aktuelles offizielles Ergebnis, nächstes Rennen, anschließend Career-Start.

## Inhalte

Die Startseite liest ausschließlich bereits geschützte Projektionen:

- Career-Statistiken und letztes Renndatum
- Level, Rank, Lifetime XP und Fortschritt
- Vora-Credit-Wallet
- Anzahl freigeschalteter Achievements
- maximal drei aktive Racing-Challenges
- nächstes Rennen im aktuellen Liga-Kontext

Für Racing, Career, Vora und Profil existieren stabile Routen mit ehrlichen Ausbauzuständen. Die Home-Seite erfindet bei fehlenden oder fehlerhaften Daten keine Werte.

## Ressourcen und Sicherheit

Alle Leseabfragen laufen parallel erst nach bestätigter Session und aktiver globaler Fahreridentität. Sie verwenden den bestehenden Browser-Client mit RLS und Tenant-Header. Es gibt keine direkten Inserts, Updates oder Deletes.

## Verifikation

Unit-Tests prüfen die Hero-Priorität und XP-Fortschrittsgrenzen. Ein statischer Vertrag prüft Navigation, Mobile-Safe-Areas, zentrale Zustände, erlaubte Tabellenzugriffe und das Fehlen von Client-Mutationen.
