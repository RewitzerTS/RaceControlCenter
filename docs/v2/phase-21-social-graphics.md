# Phase 21 · Social Graphics

## Implementiert

- Graphics Studio für Ligaleitung und Platform Owner unter `/admin/graphics`
- Launch-Core: Race Result, Podium, Winner, Driver Standings, Team Standings und Achievement Card
- feste PNG-Formate 1:1 (1080×1080), 4:5 (1080×1350) und 9:16 (1080×1920)
- deterministisches Canvas-Rendering ohne AI-Image-Abhängigkeit
- strukturierte Vorschau, PNG-Download und nachvollziehbare Render-Historie
- vollständige UI-Texte in Deutsch, Englisch, Spanisch und Französisch

## Dateien

- `v2/src/graphics/GraphicsStudioPage.tsx`
- `v2/src/graphics/graphics.ts`
- `v2/src/graphics/renderPng.ts`
- `v2/src/graphics/graphics.test.ts`
- `v2/supabase/migrations/20260820192159_v2_social_graphics.sql`
- `v2/supabase/tests/phase-21-social-graphics.sql`
- `v2/scripts/assert-social-graphics.mjs`

## Datenbank

- `social_graphic_renders` speichert nur deterministische Render-Manifeste und Provenienz, keine PNG-Binärdaten.
- Race Result, Podium und Winner sind zwingend an eine konkrete `result_version_id` gebunden.
- `get_social_graphics_workspace()` liefert ausschließlich den autorisierten Tenant-Kontext und aktuelle offizielle Daten.
- `record_social_graphic_render()` validiert Rolle, Tenant, Feature Flag und aktuellen Result-Pointer erneut serverseitig.
- `private.process_graphics_event()` markiert alte Render-Manifeste nach Revision oder Void als `outdated`.
- `graphics_enabled` ist im isolierten Staging-Projekt aktiviert.

## Security

- Production-Projekt und V1/RCC wurden nicht berührt.
- RLS ist aktiv; Tabellenrechte sind entzogen und tenant-spezifische Lesezugriffe erfordern League-Admin-Fähigkeit.
- Browser erhält weder Service Role noch freie Datenbankabfragen.
- Die beiden exponierten RPCs sind actor-bound, setzen einen leeren `search_path` und prüfen Auth, Tenant, Rolle und Feature Flag im Funktionskörper.
- Der Graphics-Processor ist nur für `service_role` ausführbar und bleibt ein unabhängiger Downstream-Consumer.

## Tests

- 32 Unit-/Komponententests bestanden.
- alle V2-Vertragsprüfungen bestanden.
- Transaktionstest bestätigt Result-Version-Bindung, Revision-Invalidierung und unabhängigen Processor; Fixtures wurden vollständig zurückgerollt.
- TypeScript und Production-Build bestanden.
- Impeccable UI-Detektor: keine Treffer.
- Supabase Advisors: keine neue fehlende RLS-Policy oder fehlender FK-Index; neue Indizes sind vor realer Nutzung erwartungsgemäß als unbenutzt gemeldet.

## Ergebnis

Phase 21 ist vollständig implementiert und im isolierten Staging-Schema aktiv. PNG-Erzeugung bleibt downstream: ein Renderfehler kann kein offizielles Ergebnis-Publishing beeinflussen.

## Offene Punkte

- Die bestehende Cloudflare-Staging-Domain liefert vor dem nächsten Deployment noch einen älteren Asset-Build.
- Realistische Demo-Daten für alle sechs Vorlagen werden in Phase 22 angelegt und Full E2E geprüft.

## Nächster Schritt

Phase 22 · Demo Full E2E: owner-only Demo-League mit realistischen Fahrern, Teams, Kalender, Result-Varianten, Steward-Fällen, Revisionen und vollständiger End-to-End-Verifikation.
