# Phase 14 — React V2 Shell

## Ergebnis

Die technische Foundation wurde zur produktnahen RaceVora-Shell ausgebaut. Desktop und Tablet verwenden eine feste Driver-Navigation; auf kleinen Displays wechselt dieselbe Informationsarchitektur zu einer sicheren Bottom Navigation.

## Navigationsvertrag

Die normale Oberfläche enthält Home, Racing, Career, Vora und Profil. Ligaleitung startet weiterhin in dieser Driver Experience und öffnet den späteren Adminbereich bewusst. Die Rolle wird angezeigt, verändert aber weder den Root-Startpunkt noch die serverseitige Autorisierung.

## Zustände und Bedienung

Die Shell besitzt übersetzte Sitzungs-, Lade-, Fehler-, Identity- und Leerdatenzustände, sichtbare Tastaturfoki, mindestens 44 Pixel hohe zentrale Ziele, Safe-Area-Abstände und Reduced-Motion-Verhalten. Sprache, Liga-Kontext und Abmeldung bleiben im Kopfbereich erreichbar.

## Sicherheit

Navigation und Rollenanzeige sind ausschließlich Präsentationskontext. Datenzugriff bleibt an die bestehende Supabase-Sitzung, den Tenant-Header und RLS gebunden. Die Shell enthält keine privilegierten Schlüssel oder Client-Mutationen.
