(() => {
  if (window.RCCResultCorrection) return;

  const state = {
    initialized: false,
    loading: false,
    saving: false,
    imports: [],
    drivers: [],
    editingRaceId: '',
    editingPublishedImportId: '',
    editingOpenImportId: ''
  };

  function escape(value) {
    return window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureStylesheet() {
    if (document.querySelector('link[data-rcc-result-correction="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-result-correction.css';
    link.dataset.rccResultCorrection = 'true';
    document.head.appendChild(link);
  }

  function ensureRoot() {
    const list = document.getElementById('publish-workflow-list');
    if (!list?.parentNode) return null;
    let root = document.getElementById('rcc-result-correction');
    if (root) return root;
    root = document.createElement('section');
    root.id = 'rcc-result-correction';
    root.className = 'rcc-result-correction';
    list.parentNode.insertBefore(root, list);
    return root;
  }

  function sourceIsCorrection(item = {}) {
    const filename = String(item.source_filename || '').trim();
    if (/^Korrektur\b/i.test(filename)) return true;
    return (item.race_result_import_rows || []).some((row) => String(row?.raw_payload?.source || '').toLowerCase() === 'correction');
  }

  function byRace() {
    const map = new Map();
    state.imports.forEach((item) => {
      const raceId = String(item.race_id || '');
      if (!raceId) return;
      if (!map.has(raceId)) map.set(raceId, { published: null, open: null });
      const entry = map.get(raceId);
      if (item.status === 'published') {
        if (!entry.published || new Date(item.published_at || item.updated_at || 0) > new Date(entry.published.published_at || entry.published.updated_at || 0)) entry.published = item;
      } else if (['draft', 'under_review'].includes(item.status)) {
        if (!entry.open || new Date(item.imported_at || item.updated_at || 0) > new Date(entry.open.imported_at || entry.open.updated_at || 0)) entry.open = item;
      }
    });
    return [...map.entries()]
      .map(([raceId, versions]) => ({ raceId, ...versions }))
      .filter((entry) => entry.published)
      .sort((a, b) => Number(b.published?.races?.round_number || 0) - Number(a.published?.races?.round_number || 0));
  }

  async function fetchData() {
    const [importsResponse, driversResponse] = await Promise.all([
      window.supabaseClient
        .from('race_result_imports')
        .select(`
          id,
          race_id,
          status,
          source_filename,
          imported_at,
          published_at,
          updated_at,
          races:race_id ( grand_prix_name, round_number, season_id ),
          race_result_import_rows (
            id,
            driver_id,
            driver_name_raw,
            finish_position,
            grid_position,
            pit_stops,
            fastest_lap_time,
            race_time,
            participation_status,
            raw_payload
          )
        `)
        .in('status', ['draft', 'under_review', 'published'])
        .order('updated_at', { ascending: false })
        .limit(160),
      window.supabaseClient
        .from('drivers')
        .select('id, display_name, gamertag, ai_driver_reference, league_team, car_name, is_active')
        .order('display_name', { ascending: true })
    ]);
    if (importsResponse.error) throw importsResponse.error;
    if (driversResponse.error) throw driversResponse.error;
    state.imports = importsResponse.data || [];
    state.drivers = driversResponse.data || [];
  }

  function driverLabel(driver, status) {
    if (!driver) return 'Unbekannter Fahrer';
    if (status === 'BOT') return `${driver.ai_driver_reference || driver.display_name || 'KI'} · KI${driver.is_active === false ? ' · inaktiv' : ''}`;
    return `${driver.display_name || driver.gamertag || 'Fahrer'}${driver.gamertag && driver.gamertag !== driver.display_name ? ` · ${driver.gamertag}` : ''}${driver.is_active === false ? ' · inaktiv' : ''}`;
  }

  function identityOptions(selectedDriverId = '', selectedStatus = 'PLAYER') {
    const selected = `${selectedDriverId}::${selectedStatus}`;
    const options = ['<option value="">Fahrer wählen</option>'];
    state.drivers.forEach((driver) => {
      const playerValue = `${driver.id}::PLAYER`;
      if (driver.is_active !== false || String(driver.id) === String(selectedDriverId)) {
        options.push(`<option value="${escape(playerValue)}" ${playerValue === selected ? 'selected' : ''}>${escape(driverLabel(driver, 'PLAYER'))}</option>`);
      }
      if (driver.ai_driver_reference) {
        const botValue = `${driver.id}::BOT`;
        if (driver.is_active !== false || String(driver.id) === String(selectedDriverId)) {
          options.push(`<option value="${escape(botValue)}" ${botValue === selected ? 'selected' : ''}>${escape(driverLabel(driver, 'BOT'))}</option>`);
        }
      }
    });
    return options.join('');
  }

  function rowMarkup(row = {}, index = 0) {
    const status = String(row.participation_status || 'PLAYER').toUpperCase() === 'BOT' ? 'BOT' : 'PLAYER';
    return `
      <tr data-correction-row>
        <td><input data-field="finish_position" inputmode="numeric" min="1" value="${escape(row.finish_position ?? index + 1)}"></td>
        <td><select data-field="driver_identity">${identityOptions(row.driver_id || '', status)}</select></td>
        <td><input data-field="grid_position" inputmode="numeric" min="1" value="${escape(row.grid_position ?? '')}"></td>
        <td><input data-field="pit_stops" inputmode="numeric" min="0" value="${escape(row.pit_stops ?? 0)}"></td>
        <td><input data-field="fastest_lap_time" value="${escape(row.fastest_lap_time || '')}" placeholder="01:23,456"></td>
        <td><input data-field="race_time" value="${escape(row.race_time || '')}" placeholder="42:15,827 / DNF"></td>
      </tr>`;
  }

  function renderList() {
    const root = ensureRoot();
    if (!root) return false;
    const items = byRace();
    root.innerHTML = `
      <div class="rcc-result-correction__head">
        <div>
          <h4>Veröffentlichtes Ergebnis korrigieren</h4>
          <p class="muted">Eine Korrektur arbeitet immer auf einer neuen Entwurfsversion. Das aktuell öffentliche Ergebnis bleibt unverändert, bis der Korrektur-Entwurf erneut final freigegeben wird.</p>
        </div>
      </div>
      <div class="rcc-result-correction__list">
        ${items.length ? items.map(({ published, open }) => {
          const race = published.races || {};
          const openIsCorrection = open ? sourceIsCorrection(open) : false;
          const disabled = Boolean(open && !openIsCorrection);
          const label = openIsCorrection ? 'Korrektur weiterbearbeiten' : disabled ? 'Anderer Entwurf offen' : 'Korrektur starten';
          return `
            <div class="rcc-result-correction__item" data-correction-race="${escape(published.race_id)}">
              <div class="rcc-result-correction__item-main">
                <strong>R${escape(race.round_number ?? '—')} · ${escape(race.grand_prix_name || 'Rennen')}</strong>
                <span>Live veröffentlicht${published.published_at ? ` · ${escape(new Date(published.published_at).toLocaleString('de-DE'))}` : ''}</span>
                ${open ? `<span class="rcc-result-correction__badge">${openIsCorrection ? 'Korrektur-Entwurf offen' : 'Entwurf aus anderem Importweg offen'}</span>` : ''}
              </div>
              <button type="button" class="button-secondary" data-start-correction="${escape(published.race_id)}" ${disabled ? 'disabled' : ''}>${escape(label)}</button>
            </div>`;
        }).join('') : '<div class="notice">Noch keine veröffentlichten Rennergebnisse vorhanden.</div>'}
      </div>
      <div id="rcc-result-correction-editor" class="rcc-result-correction__editor" hidden></div>`;
    return true;
  }

  function selectedSourceForRace(raceId) {
    const entry = byRace().find((item) => String(item.raceId) === String(raceId));
    if (!entry) return null;
    if (entry.open && sourceIsCorrection(entry.open)) return { item: entry.open, published: entry.published, continuing: true };
    return { item: entry.published, published: entry.published, continuing: false };
  }

  function renderEditor(raceId) {
    const selected = selectedSourceForRace(raceId);
    const editor = document.getElementById('rcc-result-correction-editor');
    if (!selected || !editor) return;
    const { item, published, continuing } = selected;
    const rows = (item.race_result_import_rows || []).slice().sort((a, b) => Number(a.finish_position || 999) - Number(b.finish_position || 999));
    const race = published.races || {};
    state.editingRaceId = String(raceId);
    state.editingPublishedImportId = String(published.id || '');
    state.editingOpenImportId = continuing ? String(item.id || '') : '';

    editor.hidden = false;
    editor.innerHTML = `
      <div class="rcc-result-correction__editor-head">
        <div>
          <h4>${continuing ? 'Korrektur weiterbearbeiten' : 'Korrektur vorbereiten'} · R${escape(race.round_number ?? '—')} ${escape(race.grand_prix_name || '')}</h4>
          <p class="muted">${continuing ? 'Du bearbeitest den bereits offenen Korrektur-Entwurf.' : 'Ausgangspunkt ist die letzte veröffentlichte Importversion.'} Der Live-Stand ändert sich erst mit „Ergebnis veröffentlichen“ im Freigabe-Workflow.</p>
        </div>
      </div>
      <div class="rcc-result-correction__table-wrap">
        <table class="rcc-result-correction__table">
          <thead><tr><th>Pos.</th><th>Fahrer</th><th>Start</th><th>Stopps</th><th>Schnellste Runde</th><th>Renndauer</th></tr></thead>
          <tbody>${rows.map(rowMarkup).join('')}</tbody>
        </table>
      </div>
      <div class="rcc-result-correction__actions">
        <button type="button" class="button-primary" id="rcc-save-correction">Korrektur als Entwurf speichern</button>
        <button type="button" class="button-secondary" id="rcc-cancel-correction">Abbrechen</button>
      </div>
      <div class="notice rcc-result-correction__feedback" id="rcc-correction-feedback" hidden></div>`;
    editor.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }

  function decodeIdentity(raw) {
    const [driverId = '', status = 'PLAYER'] = String(raw || '').split('::');
    return { driverId, status: String(status).toUpperCase() === 'BOT' ? 'BOT' : 'PLAYER' };
  }

  function readRows() {
    return [...document.querySelectorAll('#rcc-result-correction-editor [data-correction-row]')].map((tr) => {
      const field = (name) => String(tr.querySelector(`[data-field="${name}"]`)?.value || '').trim();
      const identity = decodeIdentity(field('driver_identity'));
      const driver = state.drivers.find((item) => String(item.id) === String(identity.driverId));
      return {
        driver_id: identity.driverId,
        driver_name_raw: identity.status === 'BOT'
          ? String(driver?.ai_driver_reference || driver?.display_name || '').trim() || null
          : String(driver?.gamertag || driver?.display_name || '').trim() || null,
        finish_position: Number(field('finish_position') || 0),
        grid_position: field('grid_position') ? Number(field('grid_position')) : null,
        pit_stops: field('pit_stops') ? Number(field('pit_stops')) : 0,
        fastest_lap_time: field('fastest_lap_time') || null,
        race_time: field('race_time') || null,
        participation_status: identity.status,
        raw_payload: {
          source: 'correction',
          correction_of_import_id: state.editingPublishedImportId,
          original_open_import_id: state.editingOpenImportId || null
        }
      };
    }).filter((row) => row.driver_id);
  }

  function validate(rows) {
    if (!rows.length) return 'Bitte mindestens einen Fahrer eintragen.';
    const driverIds = rows.map((row) => row.driver_id);
    if (new Set(driverIds).size !== driverIds.length) return 'Ein Fahrer darf pro Rennen nur einmal vorkommen.';
    const positions = rows.map((row) => row.finish_position);
    if (positions.some((value) => !Number.isInteger(value) || value < 1)) return 'Bitte gültige Zielpositionen eintragen.';
    if (new Set(positions).size !== positions.length) return 'Eine Zielposition ist mehrfach vergeben.';
    return '';
  }

  function feedback(message = '', isError = false) {
    const el = document.getElementById('rcc-correction-feedback');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message;
    el.classList.toggle('notice-error', Boolean(isError));
  }

  async function saveCorrection() {
    if (state.saving) return;
    const rows = readRows();
    const errorText = validate(rows);
    if (errorText) return feedback(errorText, true);
    if (!window.RCCResultDraft?.save) return feedback('Entwurfsdienst ist noch nicht geladen.', true);
    const selected = selectedSourceForRace(state.editingRaceId);
    const raceLabel = selected?.published?.races?.grand_prix_name || 'Rennen';
    state.saving = true;
    const button = document.getElementById('rcc-save-correction');
    if (button) { button.disabled = true; button.textContent = 'Speichert …'; }
    feedback('Korrektur wird als neue Entwurfsversion gespeichert. Der öffentliche Stand bleibt unverändert.');
    try {
      await window.RCCResultDraft.save({
        raceId: state.editingRaceId,
        rows,
        sourceFilename: `Korrektur · ${raceLabel}`
      });
      feedback('Korrektur-Entwurf gespeichert. Prüfe ihn jetzt unter „Entwürfe & Freigabe“ und veröffentliche ihn erst nach der finalen Kontrolle.');
      await refresh();
    } catch (error) {
      console.error(error);
      feedback(`Korrektur konnte nicht gespeichert werden: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      state.saving = false;
      if (button) { button.disabled = false; button.textContent = 'Korrektur als Entwurf speichern'; }
    }
  }

  async function refresh() {
    if (state.loading) return false;
    state.loading = true;
    try {
      await fetchData();
      renderList();
      return true;
    } catch (error) {
      console.warn('Veröffentlichte Ergebnisse konnten für die Korrektur nicht geladen werden.', error);
      const root = ensureRoot();
      if (root) root.innerHTML = `<div class="notice notice-error">Korrekturübersicht konnte nicht geladen werden: ${escape(error.message || 'Unbekannter Fehler')}</div>`;
      return false;
    } finally {
      state.loading = false;
    }
  }

  function bind() {
    document.addEventListener('click', (event) => {
      const start = event.target?.closest?.('[data-start-correction]');
      if (start) renderEditor(start.dataset.startCorrection || '');
      if (event.target?.closest?.('#rcc-save-correction')) saveCorrection();
      if (event.target?.closest?.('#rcc-cancel-correction')) {
        const editor = document.getElementById('rcc-result-correction-editor');
        if (editor) { editor.hidden = true; editor.replaceChildren(); }
        state.editingRaceId = '';
        state.editingPublishedImportId = '';
        state.editingOpenImportId = '';
      }
    });
    window.addEventListener('rcc:result-draft-saved', () => window.setTimeout(refresh, 50));
  }

  function init() {
    if (state.initialized) return refresh();
    ensureStylesheet();
    if (!ensureRoot()) {
      window.setTimeout(init, 120);
      return false;
    }
    bind();
    state.initialized = true;
    refresh();
    return true;
  }

  window.RCCResultCorrection = { init, refresh, readRows, validate, sourceIsCorrection };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();