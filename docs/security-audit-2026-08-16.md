# RaceVora Security Audit · 2026-08-16

## Scope

Audit der Multi-Tenant-Sicherheitsgrenzen für Supabase RLS, schreibende RPCs, privilegierte Identitätstabellen und die beiden produktiven Edge Functions.

Ziel: Ein Nutzer aus Liga A darf weder Daten von Liga B lesen/verändern noch Rollen- oder Plattformrechte eskalieren. Die produktive Liga `rcc` wurde ausschließlich read-only geprüft und nicht als destruktives Testobjekt verwendet.

## Bestätigte Findings und Fixes

### 1. Owner-Demotion über direkte `league_members`-Updates

Die alte UPDATE-Policy erlaubte Liga-Admins, eine bestehende `owner`-Zeile als Ausgangszeile zu verwenden und sie auf eine niedrigere Rolle zu ändern. Der vorgesehene Rollen-RPC verbot dies bereits, die direkte Tabellenpolicy jedoch nicht.

**Fix:** Für Nicht-Plattform-Owner muss jetzt sowohl die bestehende als auch die neue Rolle `<> 'owner'` sein.

### 2. Owner-Demotion über `manage-league-member`

Die Edge Function verwendet `service_role` und umgeht damit RLS. Vor dem Upsert wurde die bestehende Zielrolle nicht geprüft.

**Fix:** Bestehende Owner können in der Edge Function nur noch vom Plattform-Owner verändert werden. Die bereits produktiven Safe-Redirect- und Rate-Limit-Behandlungen bleiben erhalten.

### 3. KI-Ergebnisanalyse ohne Liga-Rollenprüfung

`analyze-race-result-images` war auf Gateway-Ebene mit `verify_jwt=true` geschützt, prüfte im Funktionscode jedoch nicht, ob der eingeloggte Nutzer die ausgewählte Liga verwalten darf.

**Fix:** Die Function verlangt nun:

- gültigen authentifizierten Nutzer,
- `x-rcc-league-slug` als angeforderten Tenant,
- Zugriff auf genau diese Liga,
- Rolle `owner` oder `admin` bzw. Plattform-Owner.

Der `OPENAI_API_KEY` wird erst nach erfolgreicher Autorisierung geladen und der kostenpflichtige OpenAI-Aufruf erst danach ausgeführt.

### 4. Ergebnis-Publish: Fahrer nicht explizit an Tenant gebunden

`publish_race_result_draft` lief als SECURITY INVOKER und hatte dadurch bereits RLS als zweite Barriere, verband die übergebenen `driver_id` jedoch nicht zusätzlich explizit mit `v_league_id`.

**Fix:**

- `can_manage_race_workflow(p_race_id)` erzwingt owner/admin + angeforderten Tenant,
- jede `driver_id` wird vor dem Publish gegen `v_league_id` geprüft,
- der eigentliche Driver-Join enthält ebenfalls `d.league_id = v_league_id`,
- Cross-League-Driver werden explizit abgelehnt.

### 5. Legacy `apply_race_penalties` anonym ausführbar

Die mutierende Legacy-RPC war nicht mehr im Frontend referenziert, aber für `anon` ausführbar und hatte keinen eigenen Rollen-/Tenant-Guard.

**Fix:** Anonyme Ausführung entzogen; authenticated benötigt zusätzlich `can_manage_race_workflow(p_race_id)`.

### 6. Steward-Cases: geschlossene-only Policy durch breite Policy ausgehebelt

Postgres RLS SELECT-Policies sind permissiv und werden mit OR kombiniert. Eine breite Request-Scope-Policy machte die speziellere `closed`-Bedingung für öffentliche/member Reads wirkungslos.

**Fix:** Die breite Policy wurde entfernt. Öffentliche/member Reads sehen nur `status = 'closed'` im angeforderten Tenant; Staff sieht offene/geschlossene Fälle nur mit passender Liga-Rolle im angeforderten Tenant.

### 7. Race Substitutions: Staff-Policy durch breite Request-Policy ausgehebelt

`race_substitutions` wird ausschließlich im Admin-Workflow geladen. Eine zusätzliche breite authenticated Request-Scope-Policy erlaubte dennoch allgemeinen Ligamitgliedern das Lesen.

**Fix:** Breite Policy entfernt; SELECT bleibt auf owner/admin/steward im angeforderten Tenant beschränkt.

### 8. Direkte Clientrechte auf privilegierte Identitätstabellen

`platform_owners` war bereits mit RLS ohne Policy effektiv direkt gesperrt, hatte aber unnötige Tabellen-Grants. `app_admins` besaß zusätzlich eine Legacy-SELECT-Policy, die jedem authenticated Nutzer das Enumerieren erlaubte.

**Fix:**

- direkte `anon`/`authenticated`-Grants auf `platform_owners` und `app_admins` entzogen,
- breite `app_admins`-SELECT-Policy entfernt,
- `is_platform_owner()` bleibt der schmale auth-only SECURITY-DEFINER-Helfer.

## Live-Deployment

Edge Functions erfolgreich deployed und aktiv:

- `manage-league-member` → Version 6, `verify_jwt=true`
- `analyze-race-result-images` → Version 8, `verify_jwt=true`

Die SQL-Migration `database/2026-harden-tenant-write-paths.sql` wurde zunächst vollständig in `BEGIN ... ROLLBACK` gegen das Live-Schema validiert und anschließend nach grünen CI-Gates produktiv committed.

## Live-Verifikation nach Migration

Verifiziert:

- `apply_race_penalties(uuid)`: `anon EXECUTE = false`, `authenticated EXECUTE = true`
- `publish_race_result_draft(uuid,uuid,jsonb)`: `anon EXECUTE = false`, `authenticated EXECUTE = true`
- `is_platform_owner()`: weiterhin `anon EXECUTE = false`, `authenticated EXECUTE = true`
- keine `anon`/`authenticated` Tabellen-Grants mehr auf `platform_owners`/`app_admins`
- `league_members` UPDATE-Policy schützt bestehende und neue Owner-Rollen
- Steward-Public-Policy enthält `status = 'closed'` + Request-Tenant
- Race-Substitution-SELECT ist Staff + Request-Tenant
- Publish-RPC enthält Tenant-Guard, Driver-League-Bindung und Cross-League-Rejection

## Schutz der Liga `rcc`

Nach der Migration read-only bestätigt:

- Slug: `rcc`
- Name: `Race Control Center`
- Status: `active`
- Öffentlich: `true`
- Brand Name: `Race Control Center`

Keine Liga-, Fahrer-, Ergebnis-, Saison- oder sonstigen ligaspezifischen Inhaltsdaten wurden durch die Security-Migration geschrieben, gelöscht oder zurückgesetzt.
