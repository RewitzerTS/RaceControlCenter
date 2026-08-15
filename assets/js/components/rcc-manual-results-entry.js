(() => {
  if (window.RCCManualResultsEntry) return;

  const state = {
    mounted: false,
    saving: false,
    drivers: [],
    races: []
  };

  function escape(value) {
    return window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '');
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

  function driverOptions(selected = '') {
    return '<option value="">Fahrer wählen</option>' + state.drivers.map((driver) => {
      const label = driver.display_name || driver.gamertag || driver.ai_driver_reference || 'Fahrer';
      return `<option value="${escape(driver.id)}" ${String(driver.id) === String(selected) ? 'selected' : ''}>${escape(label)}</option>`;
    }).join('');
  }

  function rowTemplate(position) {
    return `
      <tr data-manual-entry-row>
        <td><input class="manual-results-input" data-field="finish_position" inputmode="numeric" min="1" value="${position}"></td>
        <td><select class="manual-results-select" data-field="driver_id">${driverOptions()}</select></td>
        <td><input class="manual-results-input" data-field="grid_position" inputmode="numeric" min="1" placeholder="Grid"></td>
        <td><input class="manual-results-input" data-field="pit_stops" inputmode="numeric" min="0" placeholder="0"></td>
        <td><input class="manual-results-input manual-results-time" data-field="fastest_lap_time" placeholder="01:23,456"></td>
        <td><input class="manual-results-input manual-results-time" data-field="race_time" placeholder="42:15,827"></td>
        <td>
          <select class="manual-results-select" data-field="participation_status">
            <option value="PLAYER" selected>Spieler</option>
            <option value="BOT">KI-Fahrer</option>
          </select>
        </td>
        <td><button type="button" class="button-secondary" data-remove-manual-row aria-label="Zeile entfernen">×</button></td>
      </tr>`;
  }

  function renderRows(count = Math.max(20, state.drivers.length || 0)) {
    const body = document.querySelector('#rcc-manual-results-table tbody');
    if (!body) return;
    const size = Math.max(1, Math.min(30, count));
    body.innerHTML = Array.from({ length: size }, (_, index) => rowTemplate(index + 1)).join('');
  }

  function addRow() {
    const body = document.querySelector('#rcc-manual-results-table tbody');
    if (!body) return;
    const nextPosition = body.querySelectorAll('[data-manual-entry-row]').length + 1;
    body.insertAdjacentHTML('beforeend', rowTemplate(nextPosition));
  }

  function readRows() {
    return [...document.querySelectorAll('[data-manual-entry-row]')].map((row) => {
      const value = (field) => String(row.querySelector(`[data-field="${field}"]`)?.value || '').trim();
      return {
        driver_id: value('driver_id'),
        finish_position: Number(value('finish_position') || 0),
        grid_position: value('grid_position') ? Number(value('grid_position')) : null,
        pit_stops: value('pit_stops') ? Number(value('pit_stops')) : 0,
        fastest_lap_time: value('fastest_lap_time') || null,
        race_time: value('race_time') || null,
        participation_status: value('participation_status') || 'PLAYER'
      };
    }).filter((row) => row.driver_id);
  }

  function setFeedback(message = '', isError = false) {
    const el = document.getElementById('rcc-manual-results-feedback');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message;
    el.classList.toggle('notice-error', Boolean(isError));
  }

  function validateRows(rows) {
    if (!rows.length) return 'Bitte mindestens einen Fahrer eintragen.';
    const driverIds = rows.map((row) => row.driver_id);
    if (new Set(driverIds).size !== driverIds.length) return 'Ein Fahrer darf pro Rennen nur einmal eingetragen werden.';
    const positions = rows.map((row) => row.finish_position);
    if (positions.some((position) => !Number.isInteger(position) || position < 1)) return 'Bitte für jeden Fahrer eine gültige Position eintragen.';
    if (new Set(positions).size !== positions.length) return 'Eine Zielposition darf nur einmal vergeben werden.';
    return '';
  }

  async function saveDraft() {
    if (state.saving) return;
    const raceId = String(document.getElementById('manual-race-select')?.value || '').trim();
    if (!raceId) return setFeedback('Bitte zuerst ein Rennen auswählen.', true);

    const rows = readRows();
    const validationError = validateRows(rows);
    if (validationError) return setFeedback(validationError, true);

    state.saving = true;
    const button = document.getElementById('rcc-save-manual-draft');
    if (button) {
      button.disabled = true;
      button.textContent = 'Speichert …';
    }
    setFeedback('Ergebnis wird als Entwurf gespeichert …');

    try {
      const { data: existingImport, error: existingError } = await window.supabaseClient
        .from('race_result_imports')
        .select('id')
        .eq('race_id', raceId)
        .maybeSingle();
      if (existingError) throw existingError;

      let importId = existingImport?.id || null;
      if (importId) {
        const { error: deleteError } = await window.supabaseClient
          .from('race_result_import_rows')
          .delete()
          .eq('import_id', importId);
        if (deleteError) throw deleteError;

        const { error: updateError } = await window.supabaseClient
          .from('race_result_imports')
          .update({ status: 'under_review', imported_at: new Date().toISOString(), published_at: null })
          .eq('id', importId);
        if (updateError) throw updateError;
      } else {
        const { data: created, error: createError } = await window.supabaseClient
          .from('race_result_imports')
          .insert([{ race_id: raceId, status: 'under_review', imported_at: new Date().toISOString() }])
          .select('id')
          .single();
        if (createError) throw createError;
        importId = created.id;
      }

      const payload = rows.map((row) => ({
        import_id: importId,
        driver_id: row.driver_id,
        finish_position: row.finish_position,
        grid_position: row.grid_position,
        pit_stops: row.pit_stops,
        fastest_lap_time: row.fastest_lap_time,
        race_time: row.race_time,
        awarded_points: 0,
        participation_status: row.participation_status
      }));

      const { error: insertError } = await window.supabaseClient
        .from('race_result_import_rows')
        .insert(payload);
      if (insertError) throw insertError;

      await window.supabaseClient.from('races').update({ status: 'upcoming' }).eq('id', raceId);
      setFeedback('Manuelles Rennergebnis wurde als Entwurf gespeichert. Punkte werden bei der finalen Ergebnisberechnung aus den Liga-Regeln ermittelt.');
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

  function mount(panel) {
    if (!panel || panel.dataset.rccManualEntryMounted === 'true') return true;
    panel.dataset.rccManualEntryMounted = 'true';
    panel.innerHTML = `
      <summary><strong>Ergebnis manuell eingeben</strong></summary>
      <div class="rcc-manual-entry">
        <div class="notice">Wähle zuerst das Rennen. Danach erhältst du eine leere Ergebnistabelle. Der Stand wird nur als Entwurf gespeichert und noch nicht veröffentlicht.</div>
        <div class="form-grid section-spacer-top">
          <div class="field">
            <label for="manual-race-select">Rennen</label>
            <select id="manual-race-select"><option value="">Rennen werden geladen …</option></select>
          </div>
        </div>
        <div id="rcc-manual-entry-editor" hidden>
          <div class="table-wrap section-spacer-top">
            <table class="manual-results-table" id="rcc-manual-results-table">
              <thead><tr><th>Pos.</th><th>Fahrer</th><th>Grid</th><th>Stopps</th><th>Beste</th><th>Zeit</th><th>Teilnahme</th><th></th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="card-actions section-spacer-top">
            <button type="button" class="button-secondary" id="rcc-add-manual-row">+ Zeile</button>
            <button type="button" class="button-primary" id="rcc-save-manual-draft">Als Entwurf speichern</button>
          </div>
          <div id="rcc-manual-results-feedback" class="notice" hidden></div>
        </div>
      </div>`;

    fetchContextData().then(() => {
      const select = document.getElementById('manual-race-select');
      if (!select) return;
      select.innerHTML = '<option value="">Rennen wählen</option>' + state.races.map((race) =>
        `<option value="${escape(race.id)}">R${escape(race.round_number)} · ${escape(race.grand_prix_name)}</option>`
      ).join('');
      select.addEventListener('change', () => {
        const editor = document.getElementById('rcc-manual-entry-editor');
        if (editor) editor.hidden = !select.value;
        if (select.value) {
          renderRows();
          setFeedback('');
        }
      });
    }).catch((error) => setFeedback(`Rennen/Fahrer konnten nicht geladen werden: ${error.message}`, true));

    panel.addEventListener('click', (event) => {
      if (event.target.closest('#rcc-add-manual-row')) addRow();
      if (event.target.closest('#rcc-save-manual-draft')) saveDraft();
      if (event.target.closest('[data-remove-manual-row]')) event.target.closest('[data-manual-entry-row]')?.remove();
    });

    state.mounted = true;
    return true;
  }

  window.RCCManualResultsEntry = { mount, saveDraft };
})();
