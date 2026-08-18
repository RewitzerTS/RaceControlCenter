(() => {
  if (window.RCCResultReviewOverview) return;

  const state = {
    initialized: false,
    refreshing: false,
    refreshQueued: false,
    observer: null,
    timer: null
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
    if (document.querySelector('link[data-rcc-result-review-overview="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-result-review-overview.css';
    link.dataset.rccResultReviewOverview = 'true';
    document.head.appendChild(link);
  }

  function panel() {
    return document.getElementById('publish-workflow-list')?.closest('details') || null;
  }

  function ensureRoot() {
    const list = document.getElementById('publish-workflow-list');
    if (!list?.parentNode) return null;
    let root = document.getElementById('rcc-result-review-overview');
    if (!root) {
      root = document.createElement('section');
      root.id = 'rcc-result-review-overview';
      root.className = 'rcc-result-review-overview';
      root.innerHTML = '<div class="notice">Entwürfe werden geprüft …</div>';
      list.parentNode.insertBefore(root, list);
    }
    return root;
  }

  function normalizeSource(value) {
    return String(value || '').trim().toLowerCase();
  }

  function sourceMeta(item) {
    const rows = item?.race_result_import_rows || [];
    const rowSources = rows
      .map((row) => normalizeSource(row?.raw_payload?.source))
      .filter(Boolean);
    const filename = String(item?.source_filename || '').trim();
    const lowerFilename = filename.toLowerCase();

    if (rowSources.some((value) => value.includes('manual')) || lowerFilename.includes('manuelle eingabe')) {
      return { key: 'manual', label: 'Manuell', icon: '✎' };
    }
    if (
      rowSources.some((value) => value.includes('ai') || value.includes('ki')) ||
      /\.(png|jpe?g|webp|heic)$/i.test(filename) ||
      lowerFilename.includes('ki') || lowerFilename.includes('ai')
    ) {
      return { key: 'ai', label: 'KI-Bild', icon: '▣' };
    }
    if (/\.csv$/i.test(filename) || rowSources.some((value) => value.includes('csv'))) {
      return { key: 'csv', label: 'CSV', icon: 'CSV' };
    }
    return { key: 'import', label: 'Import', icon: '⇧' };
  }

  function importStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'under_review') return { label: 'In Prüfung', className: 'is-review' };
    if (normalized === 'draft') return { label: 'Entwurf', className: 'is-draft' };
    return { label: normalized || 'Offen', className: 'is-draft' };
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function sameValue(a, b) {
    const left = a === null || a === undefined || a === '' ? null : String(a).trim();
    const right = b === null || b === undefined || b === '' ? null : String(b).trim();
    return left === right;
  }

  function officialDiff(rows, officialRows) {
    const officialByDriver = new Map((officialRows || []).map((row) => [String(row.driver_id || ''), row]));
    const draftByDriver = new Map((rows || []).filter((row) => row.driver_id).map((row) => [String(row.driver_id), row]));
    if (!officialByDriver.size) {
      return { kind: 'new', label: 'Neues Ergebnis', changed: draftByDriver.size, added: draftByDriver.size, removed: 0 };
    }

    let changed = 0;
    let added = 0;
    draftByDriver.forEach((row, driverId) => {
      const official = officialByDriver.get(driverId);
      if (!official) {
        added += 1;
        changed += 1;
        return;
      }
      const differs = [
        ['finish_position', 'finish_position'],
        ['grid_position', 'grid_position'],
        ['pit_stops', 'pit_stops'],
        ['fastest_lap_time', 'fastest_lap_time'],
        ['race_time', 'race_time'],
        ['participation_status', 'participation_status']
      ].some(([draftKey, officialKey]) => !sameValue(row[draftKey], official[officialKey]));
      if (differs) changed += 1;
    });
    let removed = 0;
    officialByDriver.forEach((_row, driverId) => {
      if (!draftByDriver.has(driverId)) {
        removed += 1;
        changed += 1;
      }
    });
    return {
      kind: changed ? 'changed' : 'same',
      label: changed ? `${changed} Fahrer geändert` : 'Keine Änderungen zum veröffentlichten Stand',
      changed,
      added,
      removed
    };
  }

  function validateDraft(item) {
    const rows = item?.race_result_import_rows || [];
    const blockers = [];
    const warnings = [];
    const driverIds = rows.map((row) => String(row.driver_id || '').trim()).filter(Boolean);
    const positions = rows.map((row) => Number(row.finish_position));

    const missingDrivers = rows.length - driverIds.length;
    if (!rows.length) blockers.push('Keine Ergebniszeilen vorhanden.');
    if (missingDrivers) blockers.push(`${missingDrivers} Zeile${missingDrivers === 1 ? '' : 'n'} ohne Fahrerzuordnung.`);
    if (new Set(driverIds).size !== driverIds.length) blockers.push('Ein Fahrer ist mehrfach im Entwurf enthalten.');
    if (positions.some((position) => !Number.isInteger(position) || position < 1)) blockers.push('Ungültige oder fehlende Zielpositionen vorhanden.');
    if (positions.length && new Set(positions).size !== positions.length) blockers.push('Eine Zielposition ist mehrfach vergeben.');

    const missingGrid = rows.filter((row) => row.grid_position === null || row.grid_position === undefined || row.grid_position === '').length;
    const missingRaceTime = rows.filter((row) => !String(row.race_time || '').trim()).length;
    const missingFastest = rows.filter((row) => !String(row.fastest_lap_time || '').trim()).length;
    if (rows.length < 2 && rows.length) warnings.push('Der Entwurf enthält nur einen Fahrer.');
    if (missingGrid) warnings.push(`${missingGrid} Fahrer ohne Startposition.`);
    if (missingRaceTime) warnings.push(`${missingRaceTime} Fahrer ohne Renndauer/Status.`);
    if (missingFastest) warnings.push(`${missingFastest} Fahrer ohne schnellste Runde.`);

    return { blockers, warnings, ready: blockers.length === 0 };
  }

  function driverName(row, driversById) {
    const driver = driversById.get(String(row?.driver_id || ''));
    return String(driver?.display_name || driver?.gamertag || row?.driver_name_raw || 'Nicht zugeordnet').trim();
  }

  function renderPreviewRows(rows, driversById) {
    const ordered = [...(rows || [])].sort((a, b) => Number(a.finish_position || 999) - Number(b.finish_position || 999));
    if (!ordered.length) return '<div class="notice">Keine Ergebniszeilen vorhanden.</div>';
    return `
      <div class="rcc-result-review__table-wrap">
        <table class="rcc-result-review__table">
          <thead><tr><th>Pos.</th><th>Fahrer</th><th>Grid</th><th>Stopps</th><th>Beste Runde</th><th>Renndauer</th></tr></thead>
          <tbody>${ordered.map((row) => `
            <tr>
              <td><strong>${escape(row.finish_position ?? '—')}</strong></td>
              <td>${escape(driverName(row, driversById))}${String(row.participation_status || '').toUpperCase() === 'BOT' ? ' <span class="rcc-result-review__mini-badge">BOT</span>' : ''}</td>
              <td>${escape(row.grid_position ?? '—')}</td>
              <td>${escape(row.pit_stops ?? 0)}</td>
              <td>${escape(row.fastest_lap_time || '—')}</td>
              <td>${escape(row.race_time || '—')}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  function renderItem(item, officialRows, driversById) {
    const rows = item.race_result_import_rows || [];
    const source = sourceMeta(item);
    const status = importStatus(item.status);
    const validation = validateDraft(item);
    const diff = officialDiff(rows, officialRows);
    const race = item.races || {};
    const title = race.grand_prix_name || 'Rennen';
    const round = race.round_number ? `R${race.round_number} · ` : '';
    const botCount = rows.filter((row) => String(row.participation_status || '').toUpperCase() === 'BOT').length;
    const issueCount = validation.blockers.length + validation.warnings.length;

    return `
      <article class="rcc-result-review__card ${validation.ready ? 'is-ready' : 'has-blockers'}" data-result-review-import="${escape(item.id)}">
        <div class="rcc-result-review__head">
          <div class="rcc-result-review__title-wrap">
            <span class="rcc-result-review__source rcc-result-review__source--${escape(source.key)}"><b>${escape(source.icon)}</b>${escape(source.label)}</span>
            <div>
              <h4>${escape(round + title)}</h4>
              <p>${escape(item.source_filename || 'Ergebnisentwurf')} · gespeichert ${escape(formatDate(item.imported_at))}</p>
            </div>
          </div>
          <div class="rcc-result-review__badges">
            <span class="rcc-result-review__status ${status.className}">${escape(status.label)}</span>
            <span class="rcc-result-review__status ${validation.ready ? 'is-ready' : 'has-blockers'}">${validation.ready ? 'Bereit zur Prüfung' : 'Konflikte prüfen'}</span>
          </div>
        </div>

        <div class="rcc-result-review__metrics">
          <div><span>Fahrer</span><strong>${rows.length}</strong></div>
          <div><span>Änderungen</span><strong>${diff.changed}</strong></div>
          <div><span>Hinweise</span><strong>${issueCount}</strong></div>
          <div><span>KI/BOT</span><strong>${botCount}</strong></div>
        </div>

        <div class="rcc-result-review__change ${diff.kind === 'same' ? 'is-same' : ''}">
          <strong>Änderungsstatus:</strong> ${escape(diff.label)}${diff.added ? ` · ${diff.added} neu` : ''}${diff.removed ? ` · ${diff.removed} entfernt` : ''}
        </div>

        ${validation.blockers.length ? `<div class="rcc-result-review__issues has-blockers"><strong>Vor Veröffentlichung klären:</strong><ul>${validation.blockers.map((message) => `<li>${escape(message)}</li>`).join('')}</ul></div>` : ''}
        ${validation.warnings.length ? `<div class="rcc-result-review__issues"><strong>Hinweise:</strong><ul>${validation.warnings.map((message) => `<li>${escape(message)}</li>`).join('')}</ul></div>` : ''}

        <details class="rcc-result-review__preview">
          <summary>Ergebnisvorschau anzeigen</summary>
          ${renderPreviewRows(rows, driversById)}
        </details>
      </article>`;
  }

  async function fetchData() {
    const { data: imports, error: importError } = await window.supabaseClient
      .from('race_result_imports')
      .select(`
        id,
        race_id,
        status,
        source_filename,
        imported_at,
        races:race_id ( id, grand_prix_name, round_number ),
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
      .in('status', ['draft', 'under_review'])
      .order('imported_at', { ascending: false });
    if (importError) throw importError;

    const items = imports || [];
    const raceIds = [...new Set(items.map((item) => String(item.race_id || '')).filter(Boolean))];
    const driverIds = [...new Set(items.flatMap((item) => (item.race_result_import_rows || []).map((row) => String(row.driver_id || '')).filter(Boolean)))];

    const officialPromise = raceIds.length
      ? window.supabaseClient
          .from('race_results')
          .select('race_id, driver_id, finish_position, grid_position, pit_stops, fastest_lap_time, race_time, participation_status')
          .in('race_id', raceIds)
      : Promise.resolve({ data: [], error: null });
    const driversPromise = driverIds.length
      ? window.supabaseClient
          .from('drivers')
          .select('id, display_name, gamertag')
          .in('id', driverIds)
      : Promise.resolve({ data: [], error: null });

    const [officialResponse, driverResponse] = await Promise.all([officialPromise, driversPromise]);
    if (officialResponse.error) throw officialResponse.error;
    if (driverResponse.error) throw driverResponse.error;

    const officialByRace = new Map();
    (officialResponse.data || []).forEach((row) => {
      const key = String(row.race_id || '');
      if (!officialByRace.has(key)) officialByRace.set(key, []);
      officialByRace.get(key).push(row);
    });
    const driversById = new Map((driverResponse.data || []).map((driver) => [String(driver.id), driver]));
    return { items, officialByRace, driversById };
  }

  async function refresh() {
    const root = ensureRoot();
    if (!root || !window.supabaseClient) return false;
    if (state.refreshing) {
      state.refreshQueued = true;
      return false;
    }
    state.refreshing = true;
    root.setAttribute('aria-busy', 'true');
    try {
      const { items, officialByRace, driversById } = await fetchData();
      if (!items.length) {
        root.innerHTML = `
          <div class="rcc-result-review__intro">
            <div><span class="eyebrow">Review Center</span><h4>Keine offenen Ergebnisentwürfe</h4><p>Neue KI-, CSV- oder manuelle Entwürfe erscheinen hier automatisch.</p></div>
          </div>`;
        return true;
      }
      const readyCount = items.filter((item) => validateDraft(item).ready).length;
      root.innerHTML = `
        <div class="rcc-result-review__intro">
          <div>
            <span class="eyebrow">Review Center</span>
            <h4>Entwürfe vor der Veröffentlichung prüfen</h4>
            <p>Quelle, Änderungen und Datenkonflikte werden vor dem bestehenden finalen Freigabeschritt zusammengefasst.</p>
          </div>
          <div class="rcc-result-review__summary"><strong>${readyCount}/${items.length}</strong><span>ohne Blocker</span></div>
        </div>
        <div class="rcc-result-review__list">${items.map((item) => renderItem(item, officialByRace.get(String(item.race_id)) || [], driversById)).join('')}</div>`;
      return true;
    } catch (error) {
      console.error('Review Center konnte nicht geladen werden.', error);
      root.innerHTML = `<div class="notice notice-error">Review Center konnte nicht geladen werden: ${escape(error.message || 'Unbekannter Fehler')}</div>`;
      return false;
    } finally {
      root.removeAttribute('aria-busy');
      state.refreshing = false;
      if (state.refreshQueued) {
        state.refreshQueued = false;
        window.setTimeout(refresh, 0);
      }
    }
  }

  function scheduleRefresh() {
    if (state.timer) window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
      state.timer = null;
      refresh();
    }, 250);
  }

  function init() {
    ensureStylesheet();
    const root = ensureRoot();
    if (!root) return false;
    if (!state.initialized) {
      state.initialized = true;
      window.addEventListener('rcc:result-draft-saved', scheduleRefresh);
      const list = document.getElementById('publish-workflow-list');
      if (list && typeof MutationObserver === 'function') {
        state.observer = new MutationObserver(scheduleRefresh);
        state.observer.observe(list, { childList: true, subtree: false });
      }
      panel()?.addEventListener('toggle', (event) => {
        if (event.currentTarget?.open) scheduleRefresh();
      });
    }
    refresh();
    return true;
  }

  window.RCCResultReviewOverview = { init, refresh, validateDraft, sourceMeta, officialDiff };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
