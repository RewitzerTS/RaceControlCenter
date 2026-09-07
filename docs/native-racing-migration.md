# Racing direkt in der App

Freigabe: 2026-09-07. Der Nutzer möchte die eingebetteten älteren Racing-Seiten durch direkt gerenderte App-Seiten ersetzen. Kein Redesign und keine Änderung von Funktionen, Wertungen oder Ligadaten.

## Verbindliche Grenzen

- Entwicklung und Veröffentlichung zunächst ausschließlich auf Staging.
- Production bleibt bis zu einer separaten ausdrücklichen Freigabe unverändert.
- Menüpunkte, direkte URLs, Liga-/Saisonkontext und Browser-Zurück bleiben erhalten.
- Kein Iframe und kein nachträgliches Einfügen alter HTML-Seiten für migrierte Ansichten.
- Bestehende Backend-Daten, Berechtigungen und offizielle Ergebnisversionen weiterverwenden.
- Keine Übertragung von QA-Daten nach Production.

## Umsetzung in überprüfbaren Schritten

- [ ] Kalender: aktuelle Saison, nächste/gefahrene Rennen, Streckenkarten, Rennlinks, Archiv-Auswahl, Lade-/Fehler-/Leerzustände und Mobilansicht.
- [ ] Ergebnisse: komplette Punktematrix, Fahrer-Fixierung, Fastest Lap/BOT, korrekte offizielle Punkte, Verlauf/Filter/Vergleich.
- [ ] Meisterschaft: Fahrer-/Team-WM, Tendenzen, optionale Statistiken, Profilverlinkungen.
- [ ] Grid, Fahrer- und Teamprofile, Renndetails.
- [ ] Strecken, Streckenprofile, Regeln und Historie.
- [ ] Nicht mehr benötigte Einbettungsbrücken nach vollständiger Funktionsparität entfernen.
- [ ] Gesamten Racing-Weg auf Desktop und Mobilgeräten prüfen; Production-Freigabe einholen.

Jeder Schritt erhält Funktions-, Fehler- und Navigationstests. Ein begonnener Schritt ist nicht automatisch abgeschlossen oder live freigegeben.

## Erster Umsetzungsschritt

Der Kalender ist als React-Ansicht implementiert, ohne HTML-Injektion, Iframe oder globale Legacy-Skripte. Die weiteren Racing-Ansichten bleiben vorerst unverändert eingebettet. Lokale Streckenbilder und Flaggen werden wiederverwendet; ein Test gleicht den typisierten Streckenkatalog mit der bisherigen Quelle ab, damit die Zuordnung nicht auseinanderläuft.

Die Datenabfragen bleiben lesend und explizit an Liga und Saison gebunden. Beim Verlassen einer Liga werden laufende Abfragen abgebrochen. Kalender und Archiv haben unabhängige Fehler-/Wiederholen-Zustände. Auswahlzustände werden getrennt je Liga gespeichert; blockierter Browserspeicher verhindert die Nutzung nicht.

Die bisherige zeitbasierte Kalender-Einteilung in nächste/gefahrene Rennen bleibt erhalten. Sie bedeutet weiterhin nicht automatisch, dass ein offizielles Ergebnis veröffentlicht wurde. Änderungen an dieser fachlichen Regel sind nicht Teil des UI-Umbaus.

Vor Veröffentlichung: komplette Release-Prüfung, Desktop-/Mobil-Browserprüfungen sowie anschließend eine lesende Prüfung des Staging-Deployments. Production erhält diesen Umbau nicht ohne neue Freigabe.
