# Phase 11 — Credits und Garage

## Ergebnis

Virtual Credits (VC) basieren auf einem unveränderlichen, vorzeichenbehafteten Ledger. Der Wallet-Stand ist eine serverseitig gepflegte Projektion und kann vom Client nicht direkt verändert werden.

## Quellen und Käufe

- Neue aktive Fahreridentitäten erhalten einmalig 500 VC Willkommensguthaben.
- Berechtigte Achievement-Freischaltungen schreiben VC gut; ein Widerruf erzeugt die Gegenbuchung.
- `purchase_cosmetic` sperrt die Wallet, belastet das Ledger und vergibt den Gegenstand in einer Transaktion.
- Ein Idempotenzschlüssel verhindert Doppelkäufe durch Doppelklicks oder parallele Anfragen.

## Garage

Der Startkatalog enthält ausschließlich kosmetische Frames, Banner, Titles, Effects und Cards. Leistungssteigerungen, XP-Booster, Lootboxen und Pay-to-win-Mechaniken sind ausgeschlossen.

## Sicherheit

Fahrer können nur eigene Wallet-, Ledger-, Kauf- und Besitzdaten lesen. Der öffentliche Kauf-RPC bindet die Identität an `auth.uid()` und gewährt keine direkte Tabellenmutation. Die Regression prüft Gutschrift, Gegenbuchung, historische Sperre, atomaren Kauf, Idempotenz, Unterdeckung, Unveränderlichkeit und RLS.
