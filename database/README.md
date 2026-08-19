# RaceVora Datenbankänderungen

`database/` ist das historische Änderungsprotokoll für das Supabase/PostgreSQL-Schema von RaceVora.

## Regeln

- SQL-Dateien hier sind **Migrationen bzw. gezielte Produktionsänderungen**, kein vollständiges Bootstrap-Schema.
- Bestehende Dateien werden nicht nachträglich umsortiert oder umbenannt, wenn dadurch Verweise oder die Änderungshistorie unklar werden könnten.
- Neue Änderungen erhalten möglichst einen Datumspräfix (`YYYY-...`) und einen klaren Zweck im Dateinamen.
- Vor produktiven Änderungen immer RLS-, RPC-, Trigger- und Tenant-Abhängigkeiten prüfen.
- Die produktive Liga `rcc` darf nicht als destruktives Testobjekt verwendet werden.
- Historische Migrationen nicht gesammelt und ungeprüft gegen eine bestehende Instanz ausführen.

Der aktuelle Live-Schema-Stand wird über Supabase und die angewendeten Migrationen bestimmt, nicht allein durch die alphabetische Reihenfolge dieses Verzeichnisses.
