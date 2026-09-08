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
- [x] Ergebnisse: komplette Punktematrix, Fahrer-Fixierung, Fastest Lap/BOT, korrekte offizielle Punkte, Verlauf/Filter/Vergleich.
- [x] Meisterschaft: Fahrer-/Team-WM, Tendenzen, optionale Statistiken, Profilverlinkungen (auf Staging verifiziert; noch nicht Production).
- [x] Grid, Fahrer- und Teamprofile, Renndetails (auf Staging verifiziert; noch nicht Production).
- [x] Strecken, Streckenprofile, Regeln und Historie (Staging).
- [x] Nicht mehr benötigte Racing-Einbettungsbrücken entfernen; Career-Kompatibilität erhalten.
- [x] Gesamten Racing-Weg auf Desktop und Mobilgeräten prüfen.
- [ ] Separate Production-Freigabe für den vollständigen Racing-Umbau einholen.

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

Verifiziert am 2026-09-08:

- Vollständige Release-Prüfung bestanden: 259 Tests in 55 Dateien, alle Vertrags-/Build-Prüfungen sowie 34 Desktop-/Mobil-Browserprüfungen. Enthält 12 neue Logik-/Abfragetests einschließlich Vergleich mit der bisherigen Matrix und Tests für lange Namen, 320px-Breite, 24 Rennen, Scroll-Fixierung, Vergleich, Fehler/Wiederholen und leere Saison.
- Zwei gebündelte Desktop-/Mobil-Sichtprüfungen abgeschlossen; Diagrammkontrast innerhalb der Ligafarben korrigiert. Kein Redesign.
- Staging-Quellstand `4388de9251247c6e8f97ca2a09a70a4e199adf62`, Worker-Version `a7d99dc9-1976-49b5-a8b4-9055459366da`.
- Angemeldete private QA-Liga vor und nach dem Deployment verglichen: 20 Fahrer; Spitzenwerte 25 und 18 Punkte unverändert; 1 Fastest-Lap-Markierung; 0 BOT-Markierungen. Nach dem Deployment zusätzlich DOM-verifiziert: 0 Iframes im Hauptinhalt, 1 native Ergebnisansicht, 2 initialisierte Diagramme und 2 Vergleichsauswahlen nach Betätigung des Filters.
- Öffentliche Build-Kennungen bestätigen: Production weiterhin `36a56b9e8ac7a2476b66fd4968b9c66f74a4aca6` mit eigener Datenbank. Keine Datenbankänderungen oder QA-Datenübertragung.

Die abschließende Dokumentation wird separat committed und verändert das veröffentlichte App-Build nicht. Meisterschaft und weitere Ansichten bleiben vorerst eingebettet; Meisterschaft ist der nächste Umsetzungsschritt.

## Production-Freigabe und Veröffentlichung am 2026-09-08

Der Nutzer hat den Push auf den Feature-/Staging-Branch ausdrücklich bestätigt und anschließend die Übernahme dieses Standes auf Production freigegeben. Kalender und Ergebnisse wurden mit Quellstand `d0c6f6b8b232e2781a5c32c3095bbd5085b03275` veröffentlicht; Production-Worker-Version: `c89789c1-e212-417f-bffa-766d11ab4a96`.

Die verpflichtende Release-Prüfung bestand erneut mit 259 Tests und 34 Browserprüfungen. Danach bestanden acht zusätzliche lesende Live-Browserprüfungen auf racevora.com (Desktop/Mobil: Navigation, Kalenderbreite, öffentliche Ergebnisse ohne privates Saisonraster, Streckenkarte und Rennlink). Die öffentliche Build-Kennung bestätigt den Quellstand sowie die unveränderte Production-Datenbank. Es wurden keine Datenbankmigrationen oder QA-Datenübertragungen durchgeführt.

Feature- und Staging-Branch wurden erfolgreich auf GitHub gesichert. Die zusätzliche Aktualisierung von `main` wurde von der automatischen Aktionsprüfung mangels branchspezifischer Freigabe abgelehnt; `main` blieb deshalb auf `36a56b9e8ac7a2476b66fd4968b9c66f74a4aca6`. Das Live-Deployment ist erfolgreich und hiervon unabhängig. Für `main` ist eine gesonderte ausdrückliche Bestätigung einzuholen; keine Umgehung oder erzwungene Aktualisierung.

Weitere Racing-Migrationsschritte bleiben zunächst Staging-Arbeit und benötigen vor ihrer Live-Veröffentlichung eine neue Freigabe.

Nachtrag: Die branchspezifische Freigabe wurde anschließend erteilt; `main`, `staging` und der Feature-Branch wurden auf `34f5721` gesichert. Die veröffentlichte Production-Anwendung blieb dabei unverändert.

## Dritter Umsetzungsschritt: Meisterschaft

Fahrer- und Team-WM sind als direkte React-Ansichten umgesetzt. Liga-/Saisonkontext, Tendenzen gegenüber dem vorherigen Rennen, mobile optionale Statistiken, Fahrzeuglogos sowie Fahrer-/Teamprofil-Links bleiben erhalten. Die gemeinsame lesende Ergebnisabfrage wurde um Zielposition und Team-Snapshots ergänzt; es gibt keine neuen Datenbanktabellen oder Berechtigungsänderungen.

Die Sortierung und Teamzuordnung werden gegen die bisherige Berechnung getestet, einschließlich Ersatzfahrern, Gleichständen, Teamwechseln und Fahrern ohne Punkte. Es werden weiterhin ausschließlich veröffentlichte `awarded_points` verwendet. Schnellste Runden werden gemessen und dem gespeicherten Punkteinhaber zugeordnet, ohne einen Bonus erneut aufzuschlagen.

Vorher-Abgleich auf angemeldetem Staging: private QA-Liga, 20 Fahrer, QA Fahrer Eins mit 25 Punkten / 1 Sieg / 1 Podium / 1 schnellster Runde, QA Fahrer Zwei mit 18 Punkten / 1 Podium. Team-WM: McLaren mit 43 Punkten.

Die 20 gezielten Logik-/Abfragetests für Ergebnisse und Meisterschaft bestehen. Die vollständige Release-Prüfung, Staging-Veröffentlichung und der Nachher-Abgleich werden vor Abschluss separat dokumentiert. Production ist nicht Teil dieser Freigabe.

### Verifizierter Meisterschaft-Meilenstein, 2026-09-08

- Staging-Quellstand: `201d0361118c2c700aafbdac5174a66abda044d3`.
- Staging-Worker-Version: `c1011dcf-b007-4591-9fe9-aba416a25552`.
- Vollständige Release-Prüfung bestanden: 267 Tests in 56 Dateien, alle bestehenden Vertragsprüfungen und 42 Desktop-/Mobil-Browserprüfungen.
- Zwei gebündelte Sichtprüfungen durchgeführt; Desktop-Statistikschalter und Podium-Hintergründe korrigiert. Der Funktionstest erkannte zusätzlich den falschen Logo-Assetpfad, der vor Veröffentlichung korrigiert wurde.
- Angemeldeter Nachher-Abgleich auf Staging: dieselben 20 Fahrer und dieselben Spitzenwerte/Statistiken wie vorher; McLaren unverändert mit 43 Punkten. Beide Teamlogos erfolgreich geladen; keine Iframes im Meisterschaft-Hauptinhalt. Fahrer-/Teamwechsel funktioniert direkt in der App.
- Öffentliche Buildkennung bestätigt Staging-Umgebung und eigene Staging-Datenbank. Production bleibt auf `d0c6f6b8b232e2781a5c32c3095bbd5085b03275` und unveränderter Production-Datenbank.
- Implementierung auf Feature- und Staging-Branch gepusht. Diese abschließende Dokumentation verändert das veröffentlichte App-Build nicht.

Als nächster Schritt folgen Grid, Profile und Renndetails. Sie bleiben bis zu ihrer Migration eingebettet. Keine neue Production-Freigabe erteilt.

## Grid-Meilenstein, 2026-09-08

Das Grid ist auf Staging eine native React-Ansicht. Quellstand `8b96f09`, Worker-Version `ed90e9b5-61e7-47e3-bd51-8c923e04f139`. Die tatsächliche Saisonbesetzung bestimmt die Fahrerzahl; 20 und 22 Sitze sind getestet. Unbekannte Teilnehmertypen werden nicht als BOT interpretiert. Team- und Fahrerlinks behalten den Liga-Kontext.

Verifikation: 271 Tests in 57 Dateien, bestehende Vertragsprüfungen und 46 Desktop-/Mobil-Browserprüfungen bestanden. Angemeldeter Staging-Abgleich: QA Testsaison mit 20 Sitzen, zwei QA-Spielern mit ihren Gamertags und KI-Sitz-Zuordnungen, zehn geladenen Fahrzeuglogos, null Iframes im Hauptinhalt und kein horizontaler Seitenüberlauf. Sichtprüfung im angemeldeten Browser durchgeführt.

Fahrerprofile, Teamprofile und Renndetails sind noch NICHT nativ umgesetzt; die Links führen weiterhin zu ihren vorhandenen eingebetteten Ansichten. Die historischen Statistik- und Performance-Funktionen wurden für die nächste Migration untersucht, aber noch nicht ersetzt. Production bleibt unverändert. Keine Datenbankänderungen durchgeführt.

## Gemeinsamer Profil- und Renndetail-Meilenstein, 2026-09-08

Fahrerprofile, Teamprofile und Renndetails sind jetzt gemeinsam als native React-Ansichten auf Staging veröffentlicht. Quellstand `9421dc9aabf1658ec9a79ce0768d8812e4e94ecb`, Worker-Version `0c6b34d8-4c27-4465-86b6-6ec6eb717752`. Der bestehende Look bleibt erhalten; Tabellen scrollen auf schmalen Bildschirmen innerhalb ihres Bereichs. Die drei Ansichten benötigen keine eingebetteten Dokumente oder Legacy-Skripte.

Erhalten sind Karriere-/Saisonauswahl, Fahrer- und Teamstatistiken, gewichteter Leistungsindex, letzte Rennen, Saison-, Strecken- und Fahrzeughistorie, direkte Profil-/Rennlinks und der vorhandene Head-to-Head-Einstieg. Renndetails zeigen die aktuelle offizielle Wertung, Fastest Lap, explizite Teilnehmerstatus, gespeicherte Zeiten, Ergebnisversionen, Streckenkarte und zugängliche Steward-Einträge. Optionale Metadaten haben einen separaten Fehler-/Wiederholen-Zustand, sodass deren Ausfall die offizielle Ergebnistabelle nicht blockiert.

Die paginierten Datenabfragen sind explizit auf Liga und Saison begrenzt; Renndetails laden nur die ausgewählte Saison. Punkte werden unverändert aus der aktuellen veröffentlichten Version gelesen. Ersatzfahrer, gespeicherte Punkteinhaber und Fahrzeugwechsel werden berücksichtigt. Unbekannte IDs zeigen einen Leerzustand statt Daten einer anderen Auswahl. Keine Datenbank-, Berechtigungs- oder Production-Änderungen.

Verifikation:

- Vollständige Release-Prüfung bestanden: 284 Tests in 58 Dateien, sämtliche bestehenden Vertrags-/Build-Prüfungen und 56 Desktop-/Mobil-Browserprüfungen.
- Darin 13 neue Logik-/Abfragetests einschließlich Vergleich mit den bisherigen Fahrer-, Team- und Performance-Berechnungen sowie 10 neue Browserprüfungen für Navigation, Saisonwechsel, Fehler/Wiederholen, leere/ungültige Auswahl, Metadaten-Ausfälle und mobile Breiten.
- Zwei gebündelte Sichtprüfungsrunden; bestehende globale Profil-CSS-Kollision beseitigt, lokale Flaggen ergänzt und schmale Tabellen lesbar gehalten. Kein Redesign.
- Angemeldeter Staging-Abgleich in der privaten QA-Liga: QA Fahrer Eins mit 25 Punkten, 1 Start, 1 Sieg, 1 Podium und 1 schnellster Runde. McLaren mit 43 Punkten, 2 Starts und 2 Podien. Werte entsprechen der zuvor geprüften veröffentlichten Wertung.
- Monaco-Renndetails: 25/18 Punkte, 1 Fastest-Lap-Markierung, beide Teilnehmer PLAYER, gespeicherte Rennzeiten 20:00.000/20:05.000, V2 aktuell und V1 ersetzt; bestehender abgeschlossener QA-Steward-Fall sichtbar. Streckenkarte und Teamlogos laden erfolgreich.
- Alle drei angemeldeten Seiten: jeweils 1 native Ansicht, 0 Iframes im Hauptinhalt und kein horizontaler Seitenüberlauf. Fahrer → Team → Rennen direkt in der App geprüft.
- Öffentliche Build-Kennungen bestätigen Staging auf obigem Quellstand und eigener Datenbank. Production bleibt auf `d0c6f6b8b232e2781a5c32c3095bbd5085b03275` mit unveränderter Production-Datenbank.

Die Abschlussdokumentation wird separat gesichert und verändert das veröffentlichte App-Build nicht. Strecken, Streckenprofile, Regeln und Historie sowie der abschließende Abbau verbleibender Einbettungsbrücken sind weitere, noch offene Migrationsschritte. Keine neue Production-Freigabe erteilt.

## Abschluss der nativen Racing-Migration auf Staging, 2026-09-08

Die letzten drei Arbeitspakete sind umgesetzt: Streckenübersicht und Streckenprofile, Regeln/FAQs sowie Rekorde, Hall of Fame und Saisonarchiv werden direkt in React gerendert. Alle Racing-Unterseiten benötigen keine Iframes mehr. Nicht mehr benötigte Racing-spezifische HTML-/CSS-Brücken wurden aus LegacyLeagueView entfernt; die von Career/Head-to-Head noch benötigte Kompatibilität bleibt erhalten. Alte öffentliche URLs bleiben erreichbar und leiten in die App weiter.

Staging-Quellstand: `338e3e62527c82d16c45a1aa6d11853f2b98561a`. Worker-Version: `01337cce-82c3-4c05-91b4-1cd3529c5c9a`.

Die vorhandenen Berechnungen und Katalogdaten wurden übernommen und gegen die bisherigen Implementierungen getestet. Offizielle Punkte stammen weiterhin ausschließlich aus der aktuellen veröffentlichten Ergebnisversion. Regeln und FAQs werden lesend aus den Liga-Einstellungen geladen; fehlende Daten, ungültige Auswahl und Ladefehler haben eigene Zustände. Liga-/Saisonfilter, direkte Profil- und Rennlinks sowie Browser-Zurück sind geprüft. Die statische Hall-of-Fame-Historie der Saisons 1–13 gehört laut ausdrücklicher Nutzerbestätigung ausschließlich RCC und wird nur dort geladen; andere Ligen erhalten keine fremden Titel. Es wurde kein neues Meisterschafts-Datenmodell eingeführt.

Verifikation:

- Vollständige Release-Prüfung bestanden: 297 Tests in 59 Dateien, sämtliche Vertrags-/Build-Prüfungen und 72 Desktop-/Mobil-Browserprüfungen.
- 13 neue Logik-/Abfragetests prüfen unter anderem Parität der Strecken- und Rekordberechnungen, F1-25-/F1-26-Zuordnung, Zeitformate, Regeln und RCC-Archivbegrenzung. 16 neue Browserprüfungen decken die neuen Seiten, Filter, Navigation, aktuelle Archiv-Ergebnisversionen, Fehler/Wiederholen und mobile Breiten ab.
- Impeccable für Härtung und begrenzte Sichtprüfung verwendet; bestehende Optik beibehalten. Die Browserprüfung fand und behob die gleichzeitige Aktivmarkierung aller Historie-Schalter. Der gezielte UI-Detektor meldete keine Befunde.
- Angemeldeter Staging-Abgleich: unverändert zehn nicht festgelegte QA-Regeln und fünf FAQs. Monaco mit einem Rennen, zwei Starts und Liga-Bestzeit 1:10.000 von QA Fahrer Eins; Tabelle unverändert 25/18 Punkte, je ein Start, Fastest Lap bei QA Fahrer Eins, Pole bei QA Fahrer Zwei.
- QA-Rekorde: 25/18 Fahrerpunkte, 43 McLaren-Punkte, ein Sieg und zwei Team-Podien. QA-Hall-of-Fame korrekt leer, Saisonarchiv korrekt leer bei weiterhin aktiver QA-Saison. Vollständige Archivtabellen und das RCC-Archiv wurden mit isolierten Browser-Testdaten geprüft, nicht durch Änderungen an QA-/Produktivdaten.
- Neue angemeldete Ansichten ohne Iframes; aktive Historie-Auswahl korrekt. Ein vorübergehender Fehler der Liga-Zugangsprüfung verschwand nach Betätigung von „Erneut laden“; weder Neuanmeldung noch Berechtigungsänderung notwendig.
- Öffentliche Build-Kennungen bestätigen Staging mit eigener Datenbank. Production bleibt unverändert auf `d0c6f6b8b232e2781a5c32c3095bbd5085b03275` und seiner bisherigen Datenbank. Keine Migrationen und keine Übertragung von QA-Daten.

Damit ist der Racing-Umbau auf Staging abgeschlossen. Die Übernahme des vollständigen Umbaus auf Production bleibt ein separater Freigabeschritt. Die abschließende Dokumentation verändert das veröffentlichte App-Build nicht.
