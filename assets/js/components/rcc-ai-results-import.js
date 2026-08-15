(() => {
  if (window.RCCAIResultsImport) return;

  const IMAGE_PREP_TIMEOUT_MS = 20000;
  const AI_ANALYSIS_TIMEOUT_MS = 90000;
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const MAX_IMAGE_DIMENSION = 2200;

  const state = {
    panel: null,
    races: [],
    drivers: [],
    selectedFiles: [],
    analysisRows: [],
    warnings: [],
    analyzing: false,
    saving: false,
    analysisRunId: 0
  };

  function escape(value) {
    return window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '');
  }

  function normalize(value) {
    return String(value ?? '')
      .trim()
      .replace(/Ã¼/g, 'ü')
      .replace(/Ãœ/g, 'Ü')
      .replace(/Ã¶/g, 'ö')
      .replace(/Ã–/g, 'Ö')
      .replace(/Ã¤/g, 'ä')
      .replace(/Ã„/g, 'Ä')
      .replace(/ÃŸ/g, 'ß')
      .replace(/Ã©/g, 'é')
      .replace(/Ã‰/g, 'É')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function setFeedback(message = '', isError = false) {
    const feedback = state.panel?.querySelector('#rcc-ai-results-feedback');
    if (!feedback) return;
    feedback.hidden = !message;
    feedback.textContent = message;
    feedback.classList.toggle('notice-error', Boolean(isError));
  }

  function selectedRace() {
    const raceId = String(state.panel?.querySelector('#rcc-ai-race-select')?.value || '').trim();
    return state.races.find((race) => String(race.id) === raceId) || null;
  }

  async function fetchContextData() {
    const season = await window.RCCData?.fetchCurrentSeason?.().catch(() => null);
    let raceQuery = window.supabaseClient
      .from('races')
      .select('id, grand_prix_name, round_number, status')
      .order('round_number', { ascending: true });

    if (season?.id) raceQuery = raceQuery.eq('season_id', season.id);

    const [raceResponse, driverResponse] = await Promise.all([
      raceQuery,
      window.supabaseClient
        .from('drivers')
        .select('id, display_name, gamertag, ai_driver_reference')
        .order('display_name', { ascending: true })
    ]);

    if (raceResponse.error) throw raceResponse.error;
    if (driverResponse.error) throw driverResponse.error;
    state.races = raceResponse.data || [];
    state.drivers = driverResponse.data || [];
  }

  function driverLabel(driver) {
    const name = driver.display_name || driver.gamertag || driver.ai_driver_reference || 'Fahrer';
    const gamertag = driver.gamertag && driver.gamertag !== name ? ` · ${driver.gamertag}` : '';
    return `${name}${gamertag}`;
  }

  function driverOptions(selectedId = '') {
    return '<option value="">Fahrer zuordnen</option>' + state.drivers.map((driver) =>
      `<option value="${escape(driver.id)}" ${String(driver.id) === String(selectedId) ? 'selected' : ''}>${escape(driverLabel(driver))}</option>`
    ).join('');
  }

  function exactDriverMatch(rawName) {
    const key = normalize(rawName);
    if (!key) return null;

    for (const driver of state.drivers) {
      if (normalize(driver.gamertag) === key) return { driverId: driver.id, participationStatus: 'PLAYER', source: 'Gamertag' };
      if (normalize(driver.ai_driver_reference) === key) return { driverId: driver.id, participationStatus: 'BOT', source: 'KI-Fahrer' };
      if (normalize(driver.display_name) === key) return { driverId: driver.id, participationStatus: 'PLAYER', source: 'Anzeigename' };
    }

    const fuzzy = [];
    for (const driver of state.drivers) {
      [
        [driver.gamertag, 'PLAYER', 'Gamertag'],
        [driver.ai_driver_reference, 'BOT', 'KI-Fahrer'],
        [driver.display_name, 'PLAYER', 'Anzeigename']
      ].forEach(([value, participationStatus, source]) => {
        const candidate = normalize(value);
        if (!candidate || candidate.length < 4) return;
        if (candidate.includes(key) || key.includes(candidate)) {
          fuzzy.push({ driverId: driver.id, participationStatus, source });
        }
      });
    }

    const unique = fuzzy.filter((entry, index, array) =>
      array.findIndex((candidate) => String(candidate.driverId) === String(entry.driverId)) === index
    );
    return unique.length === 1 ? unique[0] : null;
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function analysisRow(raw, index) {
    const match = exactDriverMatch(raw.driver);
    return {
      key: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      rawDriver: String(raw.driver || '').trim(),
      driverId: match?.driverId || '',
      participationStatus: match?.participationStatus || 'PLAYER',
      matchSource: match?.source || '',
      position: parseNumber(raw.position),
      gridPosition: parseNumber(raw.grid_position),
      pitStops: parseNumber(raw.pit_stops) ?? 0,
      fastestLap: String(raw.fastest_lap || '').trim(),
      raceTime: String(raw.race_time || '').trim(),
      confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : 0,
      rawPayload: raw
    };
  }

  function confidenceLabel(value) {
    const percentage = Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100);
    return `${percentage}%`;
  }

  function renderAnalysisTable() {
    const wrap = state.panel?.querySelector('#rcc-ai-results-table-wrap');
    const saveButton = state.panel?.querySelector('#rcc-save-ai-draft');
    if (!wrap) return;

    if (!state.analysisRows.length) {
      wrap.innerHTML = '<div class="notice">Nach der KI-Auswertung erscheint hier eine bearbeitbare Ergebnistabelle.</div>';
      if (saveButton) saveButton.hidden = true;
      return;
    }

    wrap.innerHTML = `
      <table class="manual-results-table rcc-ai-results-table">
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Ausgelesen</th>
            <th>Fahrer</th>
            <th>Grid</th>
            <th>Stopps</th>
            <th>Beste Runde</th>
            <th>Rennzeit</th>
            <th>Teilnahme</th>
            <th>KI</th>
          </tr>
        </thead>
        <tbody>
          ${state.analysisRows.map((row) => `
            <tr data-ai-result-row="${escape(row.key)}" class="${row.driverId ? '' : 'rcc-ai-row-needs-mapping'}">
              <td><input class="manual-results-input" data-field="position" inputmode="numeric" min="1" value="${escape(row.position ?? '')}"></td>
              <td>
                <strong>${escape(row.rawDriver || '—')}</strong>
                <div class="muted rcc-ai-match-source">${escape(row.matchSource || 'nicht zugeordnet')}</div>
              </td>
              <td><select class="manual-results-select" data-field="driverId">${driverOptions(row.driverId)}</select></td>
              <td><input class="manual-results-input" data-field="gridPosition" inputmode="numeric" min="1" value="${escape(row.gridPosition ?? '')}"></td>
              <td><input class="manual-results-input" data-field="pitStops" inputmode="numeric" min="0" value="${escape(row.pitStops ?? 0)}"></td>
              <td><input class="manual-results-input manual-results-time" data-field="fastestLap" value="${escape(row.fastestLap)}" placeholder="01:23,456"></td>
              <td><input class="manual-results-input manual-results-time" data-field="raceTime" value="${escape(row.raceTime)}" placeholder="42:15,827"></td>
              <td>
                <select class="manual-results-select" data-field="participationStatus">
                  <option value="PLAYER" ${row.participationStatus === 'PLAYER' ? 'selected' : ''}>Spieler</option>
                  <option value="BOT" ${row.participationStatus === 'BOT' ? 'selected' : ''}>KI-Fahrer</option>
                </select>
              </td>
              <td><span class="preview-badge ${row.confidence < 0.7 ? 'notice-warning' : ''}">${confidenceLabel(row.confidence)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

    if (saveButton) saveButton.hidden = false;
  }

  function renderWarnings() {
    const warningBox = state.panel?.querySelector('#rcc-ai-warnings');
    if (!warningBox) return;
    if (!state.warnings.length) {
      warningBox.hidden = true;
      warningBox.innerHTML = '';
      return;
    }
    warningBox.hidden = false;
    warningBox.innerHTML = `<strong>Hinweise der KI:</strong><ul>${state.warnings.map((warning) => `<li>${escape(warning)}</li>`).join('')}</ul>`;
  }

  function renderSelectedFiles() {
    const list = state.panel?.querySelector('#rcc-ai-selected-files');
    const analyzeButton = state.panel?.querySelector('#rcc-analyze-images');
    if (!list) return;

    if (!state.selectedFiles.length) {
      list.innerHTML = '<span class="muted">Noch keine Bilder ausgewählt.</span>';
      if (analyzeButton) analyzeButton.disabled = true;
      return;
    }

    list.innerHTML = state.selectedFiles.map((file, index) =>
      `<span class="rcc-ai-file-chip"><strong>${index + 1}.</strong> ${escape(file.name)} <button type="button" data-remove-ai-file="${index}" ${state.analyzing ? 'disabled' : ''} aria-label="${escape(file.name)} entfernen">×</button></span>`
    ).join('');
    if (analyzeButton) analyzeButton.disabled = state.analyzing || !selectedRace();
  }

  function timeoutPromise(ms, message) {
    return new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    });
  }

  function withTimeout(promise, ms, message) {
    return Promise.race([promise, timeoutPromise(ms, message)]);
  }

  function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };
      reader.onload = () => finish(resolve, String(reader.result || ''));
      reader.onerror = () => finish(reject, reader.error || new Error('Bild konnte nicht gelesen werden.'));
      reader.onabort = () => finish(reject, new Error('Bildverarbeitung wurde abgebrochen.'));
      reader.readAsDataURL(blob);
    });
  }

  function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.9) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Bild konnte nicht komprimiert werden.'));
          return;
        }
        resolve(blob);
      }, type, quality);
    });
  }

  function loadImageElement(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      const cleanup = () => URL.revokeObjectURL(objectUrl);
      image.onload = () => resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, cleanup });
      image.onerror = () => {
        cleanup();
        reject(new Error(`Bild „${file.name}“ konnte vom Browser nicht geöffnet werden.`));
      };
      image.src = objectUrl;
    });
  }

  async function decodeImage(file) {
    if (typeof window.createImageBitmap === 'function') {
      try {
        const bitmap = await withTimeout(
          window.createImageBitmap(file),
          IMAGE_PREP_TIMEOUT_MS,
          `Bild „${file.name}“ konnte nicht rechtzeitig decodiert werden.`
        );
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => bitmap.close?.()
        };
      } catch (error) {
        console.warn('createImageBitmap fehlgeschlagen, Fallback auf Image-Element:', error);
      }
    }

    return withTimeout(
      loadImageElement(file),
      IMAGE_PREP_TIMEOUT_MS,
      `Bild „${file.name}“ konnte nicht rechtzeitig geladen werden.`
    );
  }

  async function optimizeImage(file) {
    if (!file?.type?.startsWith('image/')) throw new Error(`„${file?.name || 'Datei'}“ ist kein unterstütztes Bild.`);
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`„${file.name}“ ist größer als 20 MB. Bitte das Bild vor dem Upload verkleinern.`);
    }

    if (file.size <= 2_500_000) {
      return withTimeout(
        readAsDataUrl(file),
        IMAGE_PREP_TIMEOUT_MS,
        `Bild „${file.name}“ konnte nicht rechtzeitig gelesen werden.`
      );
    }

    const decoded = await decodeImage(file);
    try {
      const longest = Math.max(decoded.width || 0, decoded.height || 0);
      if (!longest) throw new Error(`Bild „${file.name}“ hat ungültige Abmessungen.`);

      const scale = longest > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longest : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Bildverarbeitung wird von diesem Browser nicht unterstützt.');

      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
      const compressed = await withTimeout(
        canvasToBlob(canvas, 'image/jpeg', 0.9),
        IMAGE_PREP_TIMEOUT_MS,
        `Bild „${file.name}“ konnte nicht rechtzeitig komprimiert werden.`
      );
      return withTimeout(
        readAsDataUrl(compressed),
        IMAGE_PREP_TIMEOUT_MS,
        `Bild „${file.name}“ konnte nach der Komprimierung nicht gelesen werden.`
      );
    } finally {
      decoded.cleanup?.();
    }
  }

  async function requireAdmin() {
    if (typeof window.requireAdminSession === 'function') return window.requireAdminSession();
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data?.session) throw new Error('Bitte zuerst als Ligaleitung einloggen.');
    return data.session;
  }

  function setAnalyzingUi(isAnalyzing) {
    const button = state.panel?.querySelector('#rcc-analyze-images');
    const cancelButton = state.panel?.querySelector('#rcc-cancel-ai-analysis');
    const raceSelect = state.panel?.querySelector('#rcc-ai-race-select');
    const imageInput = state.panel?.querySelector('#rcc-ai-image-input');

    if (button) {
      button.disabled = isAnalyzing || !state.selectedFiles.length || !selectedRace();
      button.textContent = isAnalyzing ? 'KI liest Bilder …' : 'Bilder mit KI auslesen';
    }
    if (cancelButton) cancelButton.hidden = !isAnalyzing;
    if (raceSelect) raceSelect.disabled = isAnalyzing;
    if (imageInput) imageInput.disabled = isAnalyzing;
    renderSelectedFiles();
  }

  async function getFunctionErrorMessage(error) {
    if (!error) return 'Unbekannter Fehler';
    try {
      if (error.context?.clone) {
        const payload = await error.context.clone().json();
        if (payload?.error) return String(payload.error);
        if (payload?.message) return String(payload.message);
      } else if (error.context?.json) {
        const payload = await error.context.json();
        if (payload?.error) return String(payload.error);
        if (payload?.message) return String(payload.message);
      }
    } catch (_) {
      // Fall back to the SDK error message below.
    }
    return String(error.message || error.name || 'Unbekannter Fehler');
  }

  function cancelAnalysis() {
    if (!state.analyzing) return;
    state.analysisRunId += 1;
    state.analyzing = false;
    setAnalyzingUi(false);
    setFeedback('KI-Auswertung abgebrochen. Du kannst die Bilder ändern oder die Auswertung erneut starten.');
  }

  async function analyzeImages() {
    if (state.analyzing) return;
    const race = selectedRace();
    if (!race) return setFeedback('Bitte zuerst ein Rennen auswählen.', true);
    if (!state.selectedFiles.length) return setFeedback('Bitte mindestens ein Ergebnisbild auswählen.', true);
    if (state.selectedFiles.length > 8) return setFeedback('Es können maximal 8 Ergebnisbilder gleichzeitig ausgewertet werden.', true);

    const runId = state.analysisRunId + 1;
    state.analysisRunId = runId;
    state.analyzing = true;
    setAnalyzingUi(true);
    setFeedback('Bilder werden für die KI-Auswertung vorbereitet …');

    try {
      await withTimeout(requireAdmin(), 15000, 'Die Admin-Sitzung konnte nicht rechtzeitig geprüft werden. Bitte Seite neu laden und erneut einloggen.');
      if (runId !== state.analysisRunId) return;

      const images = [];
      for (let index = 0; index < state.selectedFiles.length; index += 1) {
        setFeedback(`Bild ${index + 1} von ${state.selectedFiles.length} wird vorbereitet …`);
        images.push(await optimizeImage(state.selectedFiles[index]));
        if (runId !== state.analysisRunId) return;
      }

      setFeedback('KI wertet die Bilder aus … Das dauert normalerweise etwa 20–40 Sekunden.');
      const invocation = window.supabaseClient.functions.invoke('analyze-race-result-images', {
        body: {
          race_name: race.grand_prix_name,
          images,
          drivers: state.drivers.map((driver) => ({
            id: driver.id,
            display_name: driver.display_name,
            gamertag: driver.gamertag,
            ai_driver_reference: driver.ai_driver_reference
          }))
        }
      });

      const { data, error } = await withTimeout(
        invocation,
        AI_ANALYSIS_TIMEOUT_MS,
        'Die KI-Auswertung hat nach 90 Sekunden nicht geantwortet. Bitte erneut versuchen.'
      );
      if (runId !== state.analysisRunId) return;

      if (error) throw new Error(await getFunctionErrorMessage(error));
      if (data?.error) throw new Error(data.error);

      state.analysisRows = (Array.isArray(data?.rows) ? data.rows : []).map(analysisRow);
      state.warnings = Array.isArray(data?.warnings) ? data.warnings.filter(Boolean) : [];

      if (!state.analysisRows.length) {
        renderAnalysisTable();
        renderWarnings();
        setFeedback('Die KI konnte aus den Bildern keine Ergebniszeilen erkennen. Bitte andere oder schärfere Screenshots verwenden.', true);
        return;
      }

      renderAnalysisTable();
      renderWarnings();
      const missing = state.analysisRows.filter((row) => !row.driverId).length;
      setFeedback(
        missing
          ? `KI-Auswertung fertig. ${missing} Fahrer konnten nicht automatisch zugeordnet werden und müssen vor dem Speichern gewählt werden.`
          : `KI-Auswertung fertig. ${state.analysisRows.length} Ergebniszeilen wurden erkannt. Bitte die Tabelle vor dem Speichern kontrollieren.`
      );
    } catch (error) {
      if (runId !== state.analysisRunId) return;
      console.error(error);
      setFeedback(`KI-Auswertung fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      if (runId === state.analysisRunId) {
        state.analyzing = false;
        setAnalyzingUi(false);
      }
    }
  }

  function readEditableRows() {
    return [...(state.panel?.querySelectorAll('[data-ai-result-row]') || [])].map((row) => {
      const value = (field) => String(row.querySelector(`[data-field="${field}"]`)?.value || '').trim();
      const key = row.dataset.aiResultRow;
      const source = state.analysisRows.find((item) => item.key === key);
      return {
        driver_id: value('driverId'),
        finish_position: value('position') ? Number(value('position')) : 0,
        grid_position: value('gridPosition') ? Number(value('gridPosition')) : null,
        pit_stops: value('pitStops') ? Number(value('pitStops')) : 0,
        fastest_lap_time: value('fastestLap') || null,
        race_time: value('raceTime') || null,
        participation_status: value('participationStatus') || 'PLAYER',
        driver_name_raw: source?.rawDriver || null,
        raw_payload: source?.rawPayload || null
      };
    });
  }

  function validateRows(rows) {
    if (!rows.length) return 'Die Tabelle enthält keine Ergebniszeilen.';
    if (rows.some((row) => !row.driver_id)) return 'Bitte alle ausgelesenen Fahrer einem RCC-Fahrer zuordnen.';
    const driverIds = rows.map((row) => row.driver_id);
    if (new Set(driverIds).size !== driverIds.length) return 'Ein Fahrer darf pro Rennen nur einmal eingetragen werden.';
    const positions = rows.map((row) => row.finish_position);
    if (positions.some((position) => !Number.isInteger(position) || position < 1)) return 'Bitte für jede Zeile eine gültige Zielposition eintragen.';
    if (new Set(positions).size !== positions.length) return 'Eine Zielposition darf nur einmal vergeben werden.';
    return '';
  }

  async function saveDraft() {
    if (state.saving) return;
    const race = selectedRace();
    if (!race) return setFeedback('Bitte zuerst ein Rennen auswählen.', true);

    const rows = readEditableRows();
    const validationError = validateRows(rows);
    if (validationError) return setFeedback(validationError, true);

    state.saving = true;
    const button = state.panel?.querySelector('#rcc-save-ai-draft');
    if (button) {
      button.disabled = true;
      button.textContent = 'Speichert …';
    }
    setFeedback('KI-Ergebnis wird als Entwurf gespeichert …');

    try {
      const session = await requireAdmin();
      const { data: existingImport, error: existingError } = await window.supabaseClient
        .from('race_result_imports')
        .select('id')
        .eq('race_id', race.id)
        .maybeSingle();

      if (existingError) throw existingError;

      const now = new Date().toISOString();
      const sourceFilename = state.selectedFiles.length === 1
        ? `KI · ${state.selectedFiles[0].name}`
        : `KI-Bildimport · ${state.selectedFiles.length} Bilder`;
      let importId = existingImport?.id || null;

      if (importId) {
        const { error: deleteError } = await window.supabaseClient
          .from('race_result_import_rows')
          .delete()
          .eq('import_id', importId);
        if (deleteError) throw deleteError;

        const { error: updateError } = await window.supabaseClient
          .from('race_result_imports')
          .update({
            status: 'under_review',
            source_filename: sourceFilename,
            imported_by: session?.user?.id || null,
            imported_at: now,
            published_by: null,
            published_at: null
          })
          .eq('id', importId);
        if (updateError) throw updateError;
      } else {
        const { data: created, error: createError } = await window.supabaseClient
          .from('race_result_imports')
          .insert([{
            race_id: race.id,
            status: 'under_review',
            source_filename: sourceFilename,
            imported_by: session?.user?.id || null,
            imported_at: now
          }])
          .select('id')
          .single();
        if (createError) throw createError;
        importId = created.id;
      }

      const payload = rows.map((row) => ({
        import_id: importId,
        driver_id: row.driver_id,
        driver_name_raw: row.driver_name_raw,
        finish_position: row.finish_position,
        grid_position: row.grid_position,
        pit_stops: row.pit_stops,
        fastest_lap_time: row.fastest_lap_time,
        race_time: row.race_time,
        awarded_points: 0,
        participation_status: row.participation_status,
        raw_payload: row.raw_payload
      }));

      const { error: insertError } = await window.supabaseClient
        .from('race_result_import_rows')
        .insert(payload);
      if (insertError) throw insertError;

      setFeedback('KI-Rennergebnis wurde als Entwurf gespeichert. Es kann jetzt unter „Entwürfe & Freigabe“ geprüft werden.');
    } catch (error) {
      console.error(error);
      setFeedback(`Entwurf konnte nicht gespeichert werden: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      state.saving = false;
      if (button) {
        button.disabled = false;
        button.textContent = 'Als Entwurf speichern';
      }
    }
  }

  function handleFileSelection(fileList) {
    if (state.analyzing) return;
    const incoming = [...(fileList || [])].filter((file) => file.type.startsWith('image/'));
    const combined = [...state.selectedFiles, ...incoming];
    const unique = combined.filter((file, index, list) =>
      list.findIndex((candidate) =>
        candidate.name === file.name &&
        candidate.size === file.size &&
        candidate.lastModified === file.lastModified
      ) === index
    );
    state.selectedFiles = unique.slice(0, 8);
    state.analysisRows = [];
    state.warnings = [];
    renderSelectedFiles();
    renderAnalysisTable();
    renderWarnings();

    const oversized = state.selectedFiles.find((file) => file.size > MAX_IMAGE_BYTES);
    if (oversized) {
      setFeedback(`„${oversized.name}“ ist größer als 20 MB. Bitte das Bild vor der KI-Auswertung verkleinern.`, true);
    } else if (unique.length > 8) {
      setFeedback('Es werden maximal 8 Bilder verwendet. Weitere ausgewählte Dateien wurden nicht übernommen.', true);
    } else {
      setFeedback('');
    }

    const input = state.panel?.querySelector('#rcc-ai-image-input');
    if (input) input.value = '';
  }

  function buildPanel() {
    if (state.panel) return state.panel;

    const panel = document.createElement('section');
    panel.id = 'rcc-ai-results-import-panel';
    panel.className = 'panel admin-panel-wide admin-panel-accent rcc-results-workflow-panel';
    panel.innerHTML = `
      <div class="rcc-ai-results-import">
        <div class="notice">
          Wähle zuerst das Rennen und lade anschließend Screenshots der Ergebnisansicht hoch. Die KI-Erkennung schreibt nichts direkt in das veröffentlichte Rennergebnis – du kannst alle Werte vorher kontrollieren und bearbeiten.
        </div>

        <div class="form-grid section-spacer-top">
          <div class="field">
            <label for="rcc-ai-race-select">Rennen</label>
            <select id="rcc-ai-race-select"><option value="">Rennen werden geladen …</option></select>
          </div>
          <div class="field full">
            <label for="rcc-ai-image-input">Ergebnisbilder · maximal 8 · je maximal 20 MB</label>
            <input type="file" id="rcc-ai-image-input" accept="image/*" multiple>
          </div>
        </div>

        <div id="rcc-ai-selected-files" class="rcc-ai-file-list section-spacer-top">
          <span class="muted">Noch keine Bilder ausgewählt.</span>
        </div>

        <div class="card-actions section-spacer-top">
          <button type="button" class="button-primary" id="rcc-analyze-images" disabled>Bilder mit KI auslesen</button>
          <button type="button" class="button-secondary" id="rcc-cancel-ai-analysis" hidden>Auswertung abbrechen</button>
        </div>

        <div id="rcc-ai-warnings" class="notice notice-warning section-spacer-top" hidden></div>
        <div id="rcc-ai-results-table-wrap" class="table-wrap section-spacer-top">
          <div class="notice">Nach der KI-Auswertung erscheint hier eine bearbeitbare Ergebnistabelle.</div>
        </div>

        <div class="card-actions section-spacer-top">
          <button type="button" class="button-primary" id="rcc-save-ai-draft" hidden>Als Entwurf speichern</button>
        </div>
        <div id="rcc-ai-results-feedback" class="notice section-spacer-top" hidden></div>
      </div>`;

    panel.querySelector('#rcc-ai-race-select')?.addEventListener('change', () => {
      const button = panel.querySelector('#rcc-analyze-images');
      if (button) button.disabled = !selectedRace() || !state.selectedFiles.length || state.analyzing;
      state.analysisRows = [];
      state.warnings = [];
      renderAnalysisTable();
      renderWarnings();
      setFeedback('');
    });

    panel.querySelector('#rcc-ai-image-input')?.addEventListener('change', (event) => {
      handleFileSelection(event.target.files);
    });

    panel.querySelector('#rcc-analyze-images')?.addEventListener('click', analyzeImages);
    panel.querySelector('#rcc-cancel-ai-analysis')?.addEventListener('click', cancelAnalysis);
    panel.querySelector('#rcc-save-ai-draft')?.addEventListener('click', saveDraft);

    panel.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-ai-file]');
      if (!remove || state.analyzing) return;
      const index = Number(remove.dataset.removeAiFile);
      if (Number.isInteger(index)) {
        state.selectedFiles.splice(index, 1);
        state.analysisRows = [];
        state.warnings = [];
        renderSelectedFiles();
        renderAnalysisTable();
        renderWarnings();
        setFeedback('');
      }
    });

    panel.addEventListener('change', (event) => {
      const driverSelect = event.target.closest('[data-ai-result-row] [data-field="driverId"]');
      if (!driverSelect) return;
      const row = driverSelect.closest('[data-ai-result-row]');
      row?.classList.toggle('rcc-ai-row-needs-mapping', !driverSelect.value);
    });

    state.panel = panel;
    return panel;
  }

  async function open() {
    const panel = buildPanel();
    if (!window.RCCWizardDialog?.open) throw new Error('Dialog-Komponente ist nicht geladen.');

    window.RCCWizardDialog.open(panel, {
      title: 'KI-Bilder importieren',
      headerActionLabel: 'Schließen',
      onHeaderAction: () => {
        if (state.analyzing) cancelAnalysis();
        window.RCCWizardDialog.close?.();
      }
    });

    setFeedback('Rennen und Fahrer werden geladen …');
    try {
      await fetchContextData();
      const select = panel.querySelector('#rcc-ai-race-select');
      if (select) {
        const previous = select.value;
        select.innerHTML = '<option value="">Rennen wählen</option>' + state.races.map((race) =>
          `<option value="${escape(race.id)}">R${escape(race.round_number)} · ${escape(race.grand_prix_name)}</option>`
        ).join('');
        if (state.races.some((race) => String(race.id) === String(previous))) select.value = previous;
      }
      renderSelectedFiles();
      setFeedback('');
    } catch (error) {
      console.error(error);
      setFeedback(`Rennen/Fahrer konnten nicht geladen werden: ${error.message || 'Unbekannter Fehler'}`, true);
    }
    return true;
  }

  window.RCCAIResultsImport = { open, analyzeImages, saveDraft, cancelAnalysis };
})();
