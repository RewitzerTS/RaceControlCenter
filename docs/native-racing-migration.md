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

- [x] Kalender: aktuelle Saison, nächste/gefahrene Rennen, Streckenkarten, Rennlinks, Archiv-Auswahl, Lade-/Fehler-/Leerzustände und Mobilansicht.
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

## Verifizierter Staging-Meilenstein

- Veröffentlichter Quellstand: `f65b1a32714265da0c022ea6a490029eb6f96692`.
- Staging-Worker-Version: `5a49715b-437c-4484-b992-cf55da282c03`.
- Vollständige Release-Prüfung erfolgreich: TypeScript, 247 Tests in 54 Dateien, Vertrags-/Build-Prüfungen und 26 Desktop-/Mobil-Browserprüfungen mit Testdaten.
- Anschließend mit dem angemeldeten Staging-Zugang lesend geprüft: Der native Kalender der privaten QA-Liga zeigt Monaco, Termin, Wetter und Steward-Fall; die Streckenkarte öffnet sich korrekt.
- Einschränkung des zusätzlichen anonymen Live-Smokes: Vier Prüfungen erwarteten Rennen der fest hinterlegten Liga `rcc`. Diese Liga existiert in Staging nicht, deshalb liefen diese Prüfungen in einen Timeout. Die Ursache wurde lesend bestätigt; weder Berechtigungen noch Daten wurden dafür geändert. Der angemeldete QA-Test ist davon getrennt.
- Production wurde unverändert auf Quellstand `36a56b9e8ac7a2476b66fd4968b9c66f74a4aca6` bestätigt. Keine Datenbankänderungen oder Übertragung von QA-Daten.

Die Dokumentation dieses Prüfergebnisses wird in einem nachfolgenden reinen Dokumentations-Commit gesichert; sie verändert das veröffentlichte App-Build nicht. Als Nächstes folgen Ergebnisse und Meisterschaft. Production erhält diesen Umbau nicht ohne neue Freigabe.

## Zweiter Umsetzungsschritt: Ergebnisse

Die Ergebnisübersicht ist als native React-Ansicht implementiert: Punktematrix mit fixierter Fahrerspalte, Fastest-Lap-/BOT-Markierungen, direkte Fahrer-/Rennlinks, Punkteverlauf, WM-Abstand sowie Spitze/Mein Fahrer/Vergleich. Die vorhandene Optik und Ligafarben bleiben erhalten; Diagrammwerte stehen zusätzlich als zugängliche Tabelle bereit.

Die Datenanbindung liest ausschließlich die aktuelle aktive Saison der angefragten Liga und die jeweils aktuelle veröffentlichte Ergebnisversion. Gespeicherte `awarded_points` werden nicht neu berechnet. Ersatzfahrer-Punkte gehören weiterhin dem gespeicherten vertretenen Fahrer. Anonyme Besucher verwenden veröffentlichte Zuordnungen statt des privaten Saisonrasters; angemeldete Benutzer lesen das bestehende Saisonraster unter dessen bisherigen Berechtigungen. Eigene Fahreridentität wird separat, explizit nach Benutzer und vorhandenen Ligafahrern aufgelöst. Fehler dieser optionalen Abfrage blockieren keine Ergebnisse.

Zwischenstand der Prüfung: 12 neue Logik-/Abfragetests einschließlich Vergleich mit der bisherigen Matrix bestanden; erster Desktop-/Mobil-Browserlauf 24/24 bestanden. Kleine Nachbesserungen an Diagrammkontrast, Vergleichsvorauswahl und Prüfbarkeit werden im abschließenden Release-Lauf erneut geprüft. Veröffentlichung und abschließende Staging-Prüfung stehen noch aus. Meisterschaft und weitere Ansichten bleiben vorerst eingebettet.
