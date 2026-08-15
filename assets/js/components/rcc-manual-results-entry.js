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
        .select('id, display_name, gamertag, ai_driver_reference, league_team, car_name, is_active')
        .eq('is_active', true)
        .order('display_name', { ascending: true })
    ]);

    if (raceResponse.error) throw raceResponse.error;
    if (driverResponse.error) throw driverResponse.error;
    state.races = raceResponse.data || [];
    state.drivers = driverResponse.data || [];
  }

  function driverTeam(driver) {
    return String(driver?.league_team || driver?.car_name || '').trim() || '—';
  }

  function encodeIdentity(driverId, participationStatus) {
    return `${driverId}::${participationStatus}`;
  }

  function decodeIdentity(value) {
    const [driverId = '', rawStatus = 'PLAYER'] = String(value || '').split('::');
    return {
      driverId: String(driverId || '').trim(),
      participationStatus: String(rawStatus || '').toUpperCase() === 'BOT' ? 'BOT' : 'PLAYER'
    };
  }

  function identityOptions(selected = '') {
    const options = ['<option value="">Fahrer wählen</option>'];

    state.drivers.forEach((driver) => {
      const displayName = String(driver.display_name || driver.gamertag || driver.ai_driver_reference || 'Fahrer').trim();
      const gamertag = String(driver.gamertag || '').trim();
      const aiReference = String(driver.ai_driver_reference || '').trim();

      if (gamertag || !aiReference) {
        const value = encodeIdentity(driver.id, 'PLAYER');
        const label = gamertag && gamertag !== displayName
          ? `${displayName} · ${gamertag} · Spieler`
          : `${displayName} · Spieler`;
        options.push(`<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(label)}</option>`);
      }

      if (aiReference) {
        const value = encodeIdentity(driver.id, 'BOT');
        const assignedLabel = gamertag && displayName !== aiReference ? ` · KI für ${displayName}` : ' · KI';
        options.push(`<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(`${aiReference}${assignedLabel}`)}</option>`);
      }
    });

    return options.join('');
  }

  function rowTemplate(position) {
    return `
      <tr data-manual-entry-row>
        <td><input class="manual-results-input" data-field="finish_position" inputmode="numeric" min="1" value="${position}"></td>
        <td><select class="manual-results-select" data-field="driver_identity">${identityOptions()}</select></td>
        <td data-field="team" class="rcc-result-team-cell">—</td>
        <td><input class="manual-results-input" data-field="grid_position" inputmode="numeric" min="1" placeholder="Grid"></td>
        <td><input class="manual-results-input" data-field="pit_stops" inputmode="numeric" min="0" placeholder="0"></td>
        <td><input class="manual-results-input manual-results-time" data-field="fastest_lap_time" placeholder="01:23,456"></td>
        <td><input class="manual-results-input manual-results-time" data-field="race_time" placeholder="42:15,827"></td>
      </tr>`;
  }

  function renderRows(count = Math.max(20, state.drivers.length || 0)) {
    const body = document.querySelector('#rcc-manual-results-table tbody');
    if (!body) return;
    const size = Math.max(1, Math.min(30, count));
    body.innerHTML = Array.from({ length: size }, (_, index) => rowTemplate(index + 1)).join('');
  }

  function updateRowTeam(row) {
    if (!row) return;
    const identity = decodeIdentity(row.querySelector('[data-field="driver_identity"]')?.value || '');
    const driver = state.drivers.find((entry) => String(entry.id) === identity.driverId);
    const teamCell = row.querySelector('[data-field="team"]');
    if (teamCell) teamCell.textContent = driver ? driverTeam(driver) : '—';
  }

  function readRows() {
    return [...document.querySelectorAll('[data-manual-entry-row]')].map((row) => {
      const value = (field) => String(row.querySelector(`[data-field="${field}"]`)?.value || '').trim();
      const identity = decodeIdentity(value('driver_identity'));
      const driver = state.drivers.find((entry) => String(entry.id) === identity.driverId);
      return {
        driver_id: identity.driverId,
        finish_position: Number(value('finish_position') || 0),
        grid_position: value('grid_position') ? Number(value('grid_position')) : null,
        pit_stops: value('pit_stops') ? Number(value('pit_stops')) : 0,
        fastest_lap_time: value('fastest_lap_time') || null,
        race_time: value('race_time') || null,
        participation_status: identity.participationStatus,
        driver_name_raw: identity.participationStatus === 'BOT'
          ? String(driver?.ai_driver_reference || driver?.display_name || '').trim() || null
          : String(driver?.gamertag || driver?.display_name || '').trim() || null,
        raw_payload: {
          source: 'manual',
          selected_identity: identity.participationStatus,
          team: driver ? driverTeam(driver) : null
        }
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

    const timeValidation = window.RCCResultTimeFormat?.normalizeWithin?.(
      document.getElementById('rcc-manual-entry-editor') || document
    );
    if (timeValidation && !timeValidation.valid) {
      timeValidation.firstInvalid?.focus();
      timeValidation.firstInvalid?.reportValidity();
      return;
    }

    const rows = readRows();
    const validationError = validateRows(rows);
    if (validationError) return setFeedback(validationError, true);
    if (!window.RCCResultDraft?.save) return setFeedback('Der gemeinsame Entwurfs-Workflow ist nicht geladen.', true);

    state.saving = true;
    const button = document.getElementById('rcc-save-manual-draft');
    if (button) {
      button.disabled = true;
      button.textContent = 'Speichert …';
    }
    setFeedback('Ergebnis wird als gemeinsamer Entwurf gespeichert …');

    try {
      await window.RCCResultDraft.save({
        raceId,
        rows,
        sourceFilename: 'Manuelle Eingabe'
      });
      setFeedback('Manuelles Rennergebnis wurde als Entwurf gespeichert. Es liegt jetzt zusammen mit KI-Entwürfen unter „Entwürfe & Freigabe“.');
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
        <div class="notice">Wähle zuerst das Rennen. Danach erhältst du eine leere Ergebnistabelle. Spieler und zugeordnete KI-Fahrer werden direkt im Fahrerfeld unterschieden; Punkte berechnet RCC erst bei der finalen Freigabe.</div>
        <div class="form-grid section-spacer-top">
          <div class="field">
            <label for="manual-race-select">Rennen</label>
            <select id="manual-race-select"><option value="">Rennen werden geladen …</option></select>
          </div>
        </div>
        <div id="rcc-manual-entry-editor" hidden>
          <div class="table-wrap section-spacer-top">
            <table class="manual-results-table" id="rcc-manual-results-table">
              <thead><tr><th>Pos.</th><th>Fahrer</th><th>Team</th><th>Grid</th><th>Stopps</th><th>Beste</th><th>Zeit</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="card-actions section-spacer-top">
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

    panel.addEventListener('change', (event) => {
      const identitySelect = event.target.closest('[data-manual-entry-row] [data-field="driver_identity"]');
      if (identitySelect) updateRowTeam(identitySelect.closest('[data-manual-entry-row]'));
    });

    panel.addEventListener('click', (event) => {
      if (event.target.closest('#rcc-save-manual-draft')) saveDraft();
    });

    state.mounted = true;
    return true;
  }

  window.RCCManualResultsEntry = { mount, saveDraft };
})();
