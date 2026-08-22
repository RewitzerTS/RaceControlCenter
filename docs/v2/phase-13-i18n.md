# Phase 13 — Internationalisierung

## Ergebnis

Die V2-Shell unterstützt Deutsch, Englisch, Spanisch und Französisch. Deutsch ist der garantierte Fallback; eine explizite gespeicherte Auswahl hat Vorrang vor der Browsersprache.

## Vertrag

Alle vier Kataloge besitzen dieselben 72 Schlüssel. Sichtbare Shell-Texte, Gamification-Begriffe und Sprachbezeichnungen kommen aus dem Katalog statt aus hartcodierten Komponenten. Variablen werden über benannte Platzhalter eingesetzt.

Zahlen, Datum, Uhrzeit und Pluralformen verwenden die jeweilige Locale über die `Intl`-APIs. Sprache und Zeitzone bleiben voneinander unabhängig. Die Auswahl wird unter `racevora.locale` gespeichert und aktualisiert `document.documentElement.lang`.

## Verifikation

Komponententests prüfen Priorität, Browsererkennung, Fallback, Speicherung sowie lokalisierte Formatierung und Pluralregeln. Ein statischer Vertrag prüft Schlüsselparität, erlaubte Startsprachen und das Fehlen der bekannten hartcodierten Statuskopien in der Shell.
