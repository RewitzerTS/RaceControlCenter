# RaceVora · Supabase Auth E-Mail-Templates

Fertige HTML-Templates für **Authentication → Email Templates** im Supabase Dashboard.

## Empfohlene Betreffzeilen

| Supabase Template | Datei | Betreff |
|---|---|---|
| Confirm signup | `confirm-signup.html` | `Dein RaceVora-Konto bestätigen` |
| Reset password | `reset-password.html` | `RaceVora Passwort zurücksetzen` |
| Invite user | `invite-user.html` | `Deine Einladung zu RaceVora` |
| Magic link | `magic-link.html` | `Dein RaceVora Login-Link` |
| Change email address | `change-email.html` | `Neue E-Mail-Adresse für RaceVora bestätigen` |
| Reauthentication | `reauthentication.html` | `{{ .Token }} ist dein RaceVora Sicherheitscode` |

Die Link-Templates verwenden die offiziell unterstützten Supabase-Go-Template-Variablen `{{ .ConfirmationURL }}`, `{{ .Email }}` und beim E-Mail-Wechsel `{{ .NewEmail }}`. Die Re-Authentifizierungs-Mail verwendet den sechsstelligen Code `{{ .Token }}`.

## In Supabase einfügen

1. Im Supabase Dashboard das gewünschte Projekt öffnen.
2. **Authentication → Email Templates** öffnen.
3. Das passende Template auswählen.
4. Die Betreffzeile aus der Tabelle und den vollständigen Inhalt der zugehörigen HTML-Datei einfügen.
5. Speichern und anschließend mit einer echten Testadresse prüfen.

## Redirect-Verhalten

RaceVora übergibt die Zielseite im jeweiligen Auth-Aufruf an Supabase. `{{ .ConfirmationURL }}` übernimmt dadurch auch den freigegebenen `redirect_to`-Wert. Für Registrierungen führt der bestehende Flow auf `account-setup.html`, für Passwort-Reset/Einladung auf die jeweils vom Frontend übergebene RaceVora-Seite.

## Produktionshinweis

Supabase schränkt seit dem 3. Juni 2026 die Anpassung von Auth-E-Mail-Templates für **neue Free-Projekte mit Supabase Default SMTP** ein. Für produktiv gebrandete E-Mails sollte ein eigener SMTP-Provider verwendet werden, sofern das Projekt nicht bereits von der Bestandsregelung profitiert bzw. auf einem Plan mit Template-Anpassung läuft.

Keine Liga-spezifischen Namen oder Farben sind in diesen Vorlagen enthalten: Die E-Mails repräsentieren ausschließlich die Plattformmarke **RaceVora**.
