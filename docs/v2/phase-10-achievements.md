# Phase 10 — Achievements

## Ergebnis

RaceVora V2 besitzt 50 unveränderlich definierte Core Achievements. Freischaltungen werden ausschließlich aus veröffentlichten Rennergebnissen berechnet; KI oder manuelle Client-Eingaben sind nicht beteiligt.

## Datenmodell

- `achievement_definitions`: versionierte Regeln, Übersetzungsschlüssel und VC-Werte.
- `driver_achievement_events`: unveränderliches Ereignisprotokoll für Freischaltung und Widerruf.
- `driver_achievements`: aktuelle Projektion pro globaler Fahreridentität.

Die Metriken sind Starts, klassifizierte Zieleinläufe, Siege, Podien, Poles, schnellste Runden und gefahrene Ligen. Nur aktive, registrierte und global verknüpfte Fahrer werden ausgewertet; Bots und unbeanspruchte Identitäten bleiben ausgeschlossen.

## Korrekturen und Historie

Veröffentlichung, Revision und Annullierung eines Ergebnisses lösen eine deterministische Neuberechnung aus. Fällt eine Bedingung nach einer Korrektur weg, wird ein Widerrufsereignis angehängt. Historische Ergebnisse dürfen Achievements freischalten, erzeugen aber keine rückwirkenden VC.

## Sicherheit

Fahrer lesen nur ihre eigenen Freischaltungen. Definitionen sind für angemeldete Nutzer lesbar; Mutation und Verarbeitung bleiben dem Service vorbehalten. Die SQL-Regression prüft Anzahl, Idempotenz, Revision, Annullierung, Unveränderlichkeit und RLS-Isolation.
