# RCC V10.5.3 Cleanup

Historische Notiz aus `CLEANUP_NOTES.txt`.

## Damaliger Stand

Entfernt aus dem Root-Verzeichnis:

- doppelte Bilder (`HOF.png`, `Helm.png`, `Pokal.png`, `Stern.png`)
- doppelte Trackmap-Bilder im Root
- doppelte JS-Dateien im Root
- doppelte SQL-Dateien im Root
- `header.html` / `footer.html` im Root (`components/` wird verwendet)
- `style.css` im Root (`assets/css/style.css` wird verwendet)
- `icons_src/`
- `testfile` / `testwrite`
- `results (1).js` / `standings (2).js` / `_inline_index.js`
- unreferenzierte `assets/js/results.js` / `assets/js/standings.js`

Die funktional genutzten Dateien sollten anschließend in `assets/`, `components/`, `database/` und `data/` liegen.

> Historische Momentaufnahme; nicht als aktueller Soll-Stand verwenden.
