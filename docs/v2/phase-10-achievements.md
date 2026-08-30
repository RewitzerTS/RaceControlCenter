# Phase 10 — Achievements

## Ergebnis

RaceVora V2 besitzt 50 unveränderlich definierte Core Achievements und 11 deterministische Racecraft Achievements. Freischaltungen werden ausschließlich aus veröffentlichten Rennergebnissen berechnet; KI oder manuelle Client-Eingaben sind nicht beteiligt.

## Datenmodell

- `achievement_definitions`: versionierte Regeln, Übersetzungsschlüssel und VC-Werte.
- `driver_achievement_events`: unveränderliches Ereignisprotokoll für Freischaltung und Widerruf.
- `driver_achievements`: aktuelle Projektion pro globaler Fahreridentität.

Die Core-Metriken sind Starts, klassifizierte Zieleinläufe, Siege, Podien, Poles, schnellste Runden und gefahrene Ligen. Nur aktive, registrierte und global verknüpfte Fahrer werden ausgewertet; Bots und unbeanspruchte Identitäten bleiben ausgeschlossen.

Die zusätzlichen Racecraft Achievements würdigen besondere Rennverläufe und Serien:

- `Auferstanden`: Podium direkt nach einem DNF.
- `Comeback-König`: Sieg direkt nach einem DNF.
- `Phönix`: Sieg nach zwei unmittelbar aufeinanderfolgenden DNFs.
- `Perfektes Wochenende`: Pole-Position, Sieg und schnellste Runde im selben Rennen.
- `Vom Ende nach vorn`: Sieg von Startplatz 10 oder schlechter.
- `Schadensbegrenzung`: Podium von Startplatz 15 oder schlechter.
- `Unaufhaltsam`: drei Siege in Folge.
- `Mr. Consistent`: fünf klassifizierte Zieleinläufe in Folge.
- `Qualifying-Monster`: drei Pole-Positions in Folge.
- `Sonntagsfahrer`: drei schnellste Runden in Folge.
- `Ohne Umwege`: Sieg im ersten offiziellen RaceVora-Rennen.

## Korrekturen und Historie

Veröffentlichung, Revision und Annullierung eines Ergebnisses lösen eine deterministische Neuberechnung aus. Fällt eine Bedingung nach einer Korrektur weg, wird ein Widerrufsereignis angehängt. Historische Ergebnisse dürfen Achievements freischalten, erzeugen aber keine rückwirkenden VC.

## Sicherheit

Fahrer lesen nur ihre eigenen Freischaltungen. Definitionen sind für angemeldete Nutzer lesbar; Mutation und Verarbeitung bleiben dem Service vorbehalten. Die SQL-Regression prüft Anzahl, Idempotenz, Revision, Annullierung, Unveränderlichkeit und RLS-Isolation.
