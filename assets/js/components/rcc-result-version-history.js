(() => {
  if (window.RCCResultVersionHistory) return;
  if (document.body?.dataset?.page !== 'admin') return;

  const state = {
    initialized: false,
    loading: false,
    imports: [],
    observer: null,
    refreshTimer: null
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
    if (document.querySelector('link[data-rcc-result-version-history="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-result-version-history.css';
    link.dataset.rccResultVersionHistory = 'true';
    document.head.appendChild(link);
  }

  function ensureRoot() {
    const list = document.getElementById('publish-workflow-list');
    if (!list?.parentNode) return null;
    let root = document.getElementById('rcc-result-version-history');
    if (root) return root;
    root = document.createElement('section');
    root.id = 'rcc-result-version-history';
    root.className = 'rcc-result-version-history';
    list.parentNode.insertBefore(root, list);
    return root;
  }

  function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function rowKey(row = {}) {
    const driverId = String(row.driver_id || '').trim();
    if (driverId) return `id:${driverId}`;
    return `name:${normalize(row.participation_status || 'PLAYER')}:${normalize(row.driver_name_raw)}`;
  }

  function driverName(row = {}) {
    return String(row.driver_name_raw || row.driver_id || 'Unbekannter Fahrer').trim();
  }

  function rowsByDriver(item = {}) {
    return new Map((item.race_result_import_rows || []).map((row) => [rowKey(row), row]));
  }

  const COMPARE_FIELDS = [
    ['finish_position', 'Position'],
    ['grid_position', 'Start'],
    ['pit_stops', 'Stopps'],
    ['fastest_lap_time', 'Schnellste Runde'],
    ['race_time', 'Renndauer'],
    ['participation_status', 'Typ']
  ];

  function comparable(value) {
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }

  function compareVersions(current = {}, previous = null) {
    const currentRows = rowsByDriver(current);
    if (!previous) {
      return {
        initial: true,
        added: currentRows.size,
        removed: 0,
        changed: 0,
        details: []
      };
    }

    const previousRows = rowsByDriver(previous);
    const details = [];
    let added = 0;
    let removed = 0;
    let changed = 0;

    currentRows.forEach((row, key) => {
      const oldRow = previousRows.get(key);
      if (!oldRow) {
        added += 1;
        details.push(`${driverName(row)} · hinzugefügt`);
        return;
      }
      const fieldChanges = COMPARE_FIELDS
        .filter(([field]) => comparable(row[field]) !== comparable(oldRow[field]))
        .map(([field, label]) => `${label}: ${comparable(oldRow[field])} → ${comparable(row[field])}`);
      if (fieldChanges.length) {
        changed += 1;
        details.push(`${driverName(row)} · ${fieldChanges.join(' · ')}`);
      }
    });

    previousRows.forEach((row, key) => {
      if (currentRows.has(key)) return;
      removed += 1;
      details.push(`${driverName(row)} · entfernt`);
    });

    return { initial: false, added, removed, changed, details };
  }

  function sourceLabel(item = {}) {
    const sources = new Set((item.race_result_import_rows || [])
      .map((row) => normalize(row?.raw_payload?.source))
      .filter(Boolean));
    if (sources.has('correction')) return 'Korrektur';
    if (sources.has('csv')) return 'CSV';
    if (sources.has('manual')) return 'Manuell';
    if (sources.has('ai') || sources.has('image') || sources.has('ki')) return 'KI-Bild';
    return String(item.source_filename || 'Import').trim() || 'Import';
  }

  function formatDate(value) {
    if (!value) return 'Zeitpunkt unbekannt';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Zeitpunkt unbekannt';
    return date.toLocaleString('de-DE');
  }

  function groupedRaces() {
    const map = new Map();
    state.imports.forEach((item) => {
      const raceId = String(item.race_id || '').trim();
      if (!raceId) return;
      if (!map.has(raceId)) map.set(raceId, []);
      map.get(raceId).push(item);
    });

    return [...map.entries()].map(([raceId, versions]) => {
      const sorted = versions.slice().sort((a, b) =>
        new Date(b.published_at || b.updated_at || 0) - new Date(a.published_at || a.updated_at || 0)
      );
      return { raceId, versions: sorted, race: sorted[0]?.races || {} };
    }).sort((a, b) => Number(b.race.round_number || 0) - Number(a.race.round_number || 0));
  }

  function versionMarkup(version, olderVersion, index, total) {
    const diff = compareVersions(version, olderVersion);
    const versionNumber = total - index;
    const summary = diff.initial
      ? `Erstveröffentlichung · ${(version.race_result_import_rows || []).length} Fahrer`
      : `${diff.changed} geändert · ${diff.added} hinzugefügt · ${diff.removed} entfernt`;
    const detailItems = diff.details.slice(0, 8);
    const moreCount = Math.max(0, diff.details.length - detailItems.length);

    return `
      <article class="rcc-result-version-history__version" data-version-id="${escape(version.id)}">
        <div class="rcc-result-version-history__version-head">
          <div>
            <strong>Version ${versionNumber}${index === 0 ? ' · Live' : ''}</strong>
            <span>${escape(formatDate(version.published_at || version.updated_at))} · ${escape(sourceLabel(version))}</span>
          </div>
          ${index === 0 ? '<span class="rcc-result-version-history__live">Live</span>' : ''}
        </div>
        <p class="rcc-result-version-history__summary">${escape(summary)}</p>
        ${detailItems.length ? `<ul>${detailItems.map((detail) => `<li>${escape(detail)}</li>`).join('')}${moreCount ? `<li>+ ${moreCount} weitere Änderung${moreCount === 1 ? '' : 'en'}</li>` : ''}</ul>` : ''}
      </article>`;
  }

  function render() {
    const root = ensureRoot();
    if (!root) return false;
    const races = groupedRaces();
    root.innerHTML = `
      <div class="rcc-result-version-history__head">
        <div>
          <h4>Ergebnis-Versionen</h4>
          <p class="muted">Read-only Historie aller veröffentlichten Ergebnisstände. Die neueste veröffentlichte Version entspricht dem Live-Stand.</p>
        </div>
      </div>
      <div class="rcc-result-version-history__list">
        ${races.length ? races.map(({ raceId, race, versions }) => `
          <details class="rcc-result-version-history__race" data-history-race="${escape(raceId)}">
            <summary>
              <span><strong>R${escape(race.round_number ?? '—')} · ${escape(race.grand_prix_name || 'Rennen')}</strong><small>${versions.length} Version${versions.length === 1 ? '' : 'en'} · Live ${escape(formatDate(versions[0]?.published_at || versions[0]?.updated_at))}</small></span>
              <span class="rcc-result-version-history__count">${versions.length}</span>
            </summary>
            <div class="rcc-result-version-history__versions">
              ${versions.map((version, index) => versionMarkup(version, versions[index + 1] || null, index, versions.length)).join('')}
            </div>
          </details>`).join('') : '<div class="notice">Noch keine veröffentlichten Ergebnisversionen vorhanden.</div>'}
      </div>`;
    return true;
  }

  async function fetchData() {
    const response = await window.supabaseClient
      .from('race_result_imports')
      .select(`
        id,
        race_id,
        source_filename,
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
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(240);
    if (response.error) throw response.error;
    state.imports = response.data || [];
  }

  async function refresh() {
    if (state.loading) return false;
    state.loading = true;
    try {
      await fetchData();
      return render();
    } catch (error) {
      console.warn('Ergebnis-Versionen konnten nicht geladen werden.', error);
      const root = ensureRoot();
      if (root) root.innerHTML = `<div class="notice notice-error">Versionshistorie konnte nicht geladen werden: ${escape(error.message || 'Unbekannter Fehler')}</div>`;
      return false;
    } finally {
      state.loading = false;
    }
  }

  function scheduleRefresh() {
    if (state.refreshTimer) window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(() => {
      state.refreshTimer = null;
      refresh();
    }, 250);
  }

  function observePublishWorkflow() {
    const list = document.getElementById('publish-workflow-list');
    if (!list || typeof MutationObserver !== 'function' || state.observer) return;
    state.observer = new MutationObserver(scheduleRefresh);
    state.observer.observe(list, { childList: true, subtree: true });
  }

  function init() {
    if (state.initialized) return refresh();
    ensureStylesheet();
    if (!ensureRoot()) {
      window.setTimeout(init, 120);
      return false;
    }
    state.initialized = true;
    observePublishWorkflow();
    window.addEventListener('rcc:result-draft-saved', scheduleRefresh);
    refresh();
    return true;
  }

  window.RCCResultVersionHistory = { init, refresh, compareVersions, groupedRaces };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();