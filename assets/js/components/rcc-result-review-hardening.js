(() => {
  if (window.RCCResultReviewHardening) return;

  const CSV_CONTEXT_TTL_MS = 120000;
  const state = {
    initialized: false,
    refreshing: false,
    refreshQueued: false,
    summaryByImport: new Map(),
    pendingPublishSummary: null,
    observer: null,
    csvContext: null,
    confirmWrapped: false,
    supabaseWrapped: false,
    releaseWrapped: false
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
    if (document.querySelector('link[data-rcc-result-review-hardening="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-result-review-hardening.css';
    link.dataset.rccResultReviewHardening = 'true';
    document.head.appendChild(link);
  }

  function normalized(value) {
    return String(value || '').trim().toLowerCase();
  }

  function explicitSource(item = {}) {
    const filename = String(item.source_filename || '').trim();
    const rowSources = (item.race_result_import_rows || [])
      .map((row) => normalized(row?.raw_payload?.source))
      .filter(Boolean);

    const has = (pattern) => rowSources.some((value) => pattern.test(value));
    if (/\.csv$/i.test(filename) || has(/^(csv|csv-import|csv_import)$/i)) {
      return { key: 'csv', label: 'CSV', icon: 'CSV', display: filename || 'CSV-Import' };
    }
    if (has(/^(manual|manuell|manual-entry|manual_entry)$/i)) {
      return { key: 'manual', label: 'Manuell', icon: '✎', display: 'Manuelle Eingabe' };
    }
    if (
      has(/^(ai|ki|ai-image|ai_image|ki-bild|ki_bild|image)$/i) ||
      /\.(png|jpe?g|webp|heic)$/i.test(filename) ||
      /^(?:ki|ai)\s*[·:_-]/i.test(filename)
    ) {
      return { key: 'ai', label: 'KI-Bild', icon: '▣', display: filename || 'KI-Bildimport' };
    }
    return { key: 'import', label: 'Import', icon: '⇧', display: 'Importquelle nicht eindeutig' };
  }

  function validateRows(rows = []) {
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

  function activeCsvContext() {
    if (!state.csvContext) return null;
    if (Date.now() - state.csvContext.startedAt > CSV_CONTEXT_TTL_MS) {
      state.csvContext = null;
      return null;
    }
    return state.csvContext;
  }

  function mapPayload(payload, mapper) {
    if (Array.isArray(payload)) return payload.map((entry) => mapper(entry));
    return mapper(payload);
  }

  function installCsvProvenance() {
    if (state.supabaseWrapped || !window.supabaseClient?.from) return;
    const client = window.supabaseClient;
    const originalFrom = client.from.bind(client);

    client.from = (table) => {
      const builder = originalFrom(table);
      const context = activeCsvContext();
      if (!context || !builder) return builder;

      if (table === 'race_result_imports') {
        if (typeof builder.insert === 'function') {
          const originalInsert = builder.insert.bind(builder);
          builder.insert = (payload, options) => originalInsert(mapPayload(payload, (entry) => ({
            ...(entry || {}),
            source_filename: context.filename
          })), options);
        }
        if (typeof builder.update === 'function') {
          const originalUpdate = builder.update.bind(builder);
          builder.update = (payload) => originalUpdate({
            ...(payload || {}),
            source_filename: context.filename
          });
        }
      }

      if (table === 'race_result_import_rows' && typeof builder.insert === 'function') {
        const originalInsert = builder.insert.bind(builder);
        builder.insert = (payload, options) => {
          const nextPayload = mapPayload(payload, (entry) => ({
            ...(entry || {}),
            raw_payload: {
              ...((entry && entry.raw_payload && typeof entry.raw_payload === 'object') ? entry.raw_payload : {}),
              source: 'csv',
              source_filename: context.filename
            }
          }));
          state.csvContext = null;
          return originalInsert(nextPayload, options);
        };
      }
      return builder;
    };

    state.supabaseWrapped = true;
  }

  function beginCsvContext() {
    const file = document.getElementById('csv-file')?.files?.[0] || null;
    const filename = String(file?.name || '').trim() || `RaceVora CSV Import ${new Date().toISOString().slice(0, 10)}.csv`;
    state.csvContext = { filename, startedAt: Date.now() };
  }

  function formatPenaltyMs(ms) {
    const value = Number(ms || 0);
    if (!value) return '0 s';
    const seconds = Math.round(Math.abs(value) / 100) / 10;
    return `${value > 0 ? '+' : '-'}${seconds.toLocaleString('de-DE')} s`;
  }

  async function fetchData() {
    if (!window.supabaseClient) return { imports: [], penalties: [] };
    const { data: imports, error } = await window.supabaseClient
      .from('race_result_imports')
      .select(`
        id,
        race_id,
        status,
        source_filename,
        imported_at,
        races:race_id ( grand_prix_name, round_number ),
        race_result_import_rows (
          id,
          driver_id,
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
    if (error) throw error;
    const items = imports || [];
    const raceIds = [...new Set(items.map((item) => String(item.race_id || '')).filter(Boolean))];
    if (!raceIds.length) return { imports: items, penalties: [] };
    const { data: penalties, error: penaltyError } = await window.supabaseClient
      .from('race_penalties')
      .select('race_id, driver_id, time_delta_ms, points_delta, reason')
      .in('race_id', raceIds);
    if (penaltyError) throw penaltyError;
    return { imports: items, penalties: penalties || [] };
  }

  function updateSourceBadge(card, source) {
    const badge = card?.querySelector('.rcc-result-review__source');
    if (badge) {
      [...badge.classList].filter((name) => name.startsWith('rcc-result-review__source--')).forEach((name) => badge.classList.remove(name));
      badge.classList.add(`rcc-result-review__source--${source.key}`);
      badge.innerHTML = `<b>${escape(source.icon)}</b>${escape(source.label)}`;
    }
    const meta = card?.querySelector('.rcc-result-review__title-wrap p');
    if (meta) {
      const text = String(meta.textContent || '');
      const saved = text.includes(' · gespeichert ') ? text.split(' · gespeichert ').slice(1).join(' · gespeichert ') : '';
      meta.textContent = `${source.display}${saved ? ` · gespeichert ${saved}` : ''}`;
    }
  }

  function stewardImpactMarkup(penalties = []) {
    if (!penalties.length) {
      return '<strong>Steward-Auswirkung:</strong> Keine Zeit- oder Punktekorrekturen hinterlegt.';
    }
    const totalMs = penalties.reduce((sum, row) => sum + Number(row.time_delta_ms || 0), 0);
    const pointAdjustments = penalties.filter((row) => Number(row.points_delta || 0) !== 0).length;
    const reasons = penalties.map((row) => String(row.reason || '').trim()).filter(Boolean).slice(0, 3);
    return `<strong>Steward-Auswirkung:</strong> ${penalties.length} Korrektur${penalties.length === 1 ? '' : 'en'} · Netto ${escape(formatPenaltyMs(totalMs))}${pointAdjustments ? ` · ${pointAdjustments} Punkteanpassung${pointAdjustments === 1 ? '' : 'en'}` : ''}${reasons.length ? `<ul>${reasons.map((reason) => `<li>${escape(reason)}</li>`).join('')}</ul>` : ''}`;
  }

  function ensureStewardImpact(card, penalties) {
    if (!card) return;
    let box = card.querySelector('.rcc-result-review__steward-impact');
    if (!box) {
      box = document.createElement('div');
      box.className = 'rcc-result-review__steward-impact';
      const preview = card.querySelector('.rcc-result-review__preview');
      if (preview) card.insertBefore(box, preview);
      else card.appendChild(box);
    }
    box.classList.toggle('has-steward-impact', penalties.length > 0);
    box.innerHTML = stewardImpactMarkup(penalties);
  }

  function publishButtonsFor(item) {
    return [...document.querySelectorAll('.publish-results-btn')].filter((button) => {
      const importId = String(button.dataset.importId || '');
      const raceId = String(button.dataset.raceId || '');
      return importId === String(item.id) || (!importId && raceId === String(item.race_id));
    });
  }

  function applyButtonGuard(item, summary) {
    publishButtonsFor(item).forEach((button) => {
      if (summary.blockers.length) {
        button.disabled = true;
        button.dataset.rccReviewDisabled = 'true';
        button.textContent = 'Blocker beheben';
        button.title = summary.blockers.join(' ');
        button.setAttribute('aria-disabled', 'true');
      } else {
        if (button.dataset.rccReviewDisabled === 'true') button.disabled = false;
        delete button.dataset.rccReviewDisabled;
        button.textContent = 'Ergebnis veröffentlichen';
        button.removeAttribute('aria-disabled');
        button.title = 'Finale Veröffentlichung mit Sicherheitsabfrage';
      }
    });
  }

  function buildSummary(item, penalties = []) {
    const rows = item.race_result_import_rows || [];
    const source = explicitSource(item);
    const validation = validateRows(rows);
    const botCount = rows.filter((row) => String(row.participation_status || '').toUpperCase() === 'BOT').length;
    const totalPenaltyMs = penalties.reduce((sum, row) => sum + Number(row.time_delta_ms || 0), 0);
    return {
      importId: String(item.id || ''),
      raceId: String(item.race_id || ''),
      raceLabel: String(item.races?.grand_prix_name || 'Rennen'),
      source,
      rowCount: rows.length,
      botCount,
      blockers: validation.blockers,
      warnings: validation.warnings,
      penaltyCount: penalties.length,
      totalPenaltyMs
    };
  }

  function finalSummaryText(summary) {
    const parts = [
      'Was wird jetzt veröffentlicht?',
      `Quelle: ${summary.source.label}`,
      `Fahrer: ${summary.rowCount}${summary.botCount ? ` · davon ${summary.botCount} KI/BOT` : ''}`,
      `Steward-Korrekturen: ${summary.penaltyCount}${summary.penaltyCount ? ` · Netto ${formatPenaltyMs(summary.totalPenaltyMs)}` : ''}`,
      `Hinweise: ${summary.warnings.length}`,
      'Der offizielle Rennstand sowie Fahrer- und Konstrukteurswertung werden anschließend neu berechnet.'
    ];
    return parts.join('\n');
  }

  function wrapConfirmDangerousAction() {
    if (state.confirmWrapped || typeof window.confirmDangerousAction !== 'function') return;
    const original = window.confirmDangerousAction;
    window.confirmDangerousAction = async (options = {}) => {
      const summary = state.pendingPublishSummary;
      if (String(options.keyword || '').toUpperCase() !== 'VEROEFFENTLICHEN' || !summary) {
        return original(options);
      }
      if (summary.blockers.length) {
        window.alert?.(`Veröffentlichung blockiert:\n\n${summary.blockers.join('\n')}`);
        state.pendingPublishSummary = null;
        return false;
      }
      try {
        return await original({
          ...options,
          details: `${finalSummaryText(summary)}\n\n${String(options.details || '').trim()}`.trim()
        });
      } finally {
        state.pendingPublishSummary = null;
      }
    };
    state.confirmWrapped = true;
  }

  function wrapExportedRelease() {
    if (state.releaseWrapped || !window.RCCResultRelease?.finalPublish) return;
    const original = window.RCCResultRelease.finalPublish.bind(window.RCCResultRelease);
    window.RCCResultRelease.finalPublish = async (importId, raceId) => {
      const summary = state.summaryByImport.get(String(importId || ''));
      if (summary?.blockers?.length) {
        window.alert?.(`Veröffentlichung blockiert:\n\n${summary.blockers.join('\n')}`);
        return false;
      }
      if (summary) state.pendingPublishSummary = summary;
      return original(importId, raceId);
    };
    state.releaseWrapped = true;
  }

  function installPublishCapture() {
    window.addEventListener('click', (event) => {
      const csvButton = event.target?.closest?.('#import-results-btn');
      if (csvButton) beginCsvContext();

      const publishButton = event.target?.closest?.('.publish-results-btn');
      if (!publishButton) return;
      const summary = state.summaryByImport.get(String(publishButton.dataset.importId || ''));
      if (!summary) return;
      if (summary.blockers.length) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        window.showFeedback?.('publish-feedback', `Veröffentlichung blockiert: ${summary.blockers.join(' ')}`, true);
        return;
      }
      state.pendingPublishSummary = summary;
    }, true);
  }

  function applyData(imports, penalties) {
    const penaltiesByRace = new Map();
    penalties.forEach((penalty) => {
      const key = String(penalty.race_id || '');
      if (!penaltiesByRace.has(key)) penaltiesByRace.set(key, []);
      penaltiesByRace.get(key).push(penalty);
    });

    state.summaryByImport.clear();
    imports.forEach((item) => {
      const racePenalties = penaltiesByRace.get(String(item.race_id || '')) || [];
      const summary = buildSummary(item, racePenalties);
      state.summaryByImport.set(summary.importId, summary);
      const card = document.querySelector(`[data-result-review-import="${CSS.escape(summary.importId)}"]`);
      updateSourceBadge(card, summary.source);
      ensureStewardImpact(card, racePenalties);
      applyButtonGuard(item, summary);
    });
  }

  async function refresh() {
    if (state.refreshing) {
      state.refreshQueued = true;
      return false;
    }
    state.refreshing = true;
    try {
      const { imports, penalties } = await fetchData();
      applyData(imports, penalties);
      wrapConfirmDangerousAction();
      wrapExportedRelease();
      return true;
    } catch (error) {
      console.warn('Review-Hardening konnte nicht aktualisiert werden.', error);
      return false;
    } finally {
      state.refreshing = false;
      if (state.refreshQueued) {
        state.refreshQueued = false;
        window.setTimeout(() => refresh(), 0);
      }
    }
  }

  function observe() {
    if (state.observer) return;
    const target = document.getElementById('publish-workflow-list')?.parentNode || document.body;
    if (!target || typeof MutationObserver !== 'function') return;
    let timer = null;
    state.observer = new MutationObserver(() => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => refresh(), 80);
    });
    state.observer.observe(target, { childList: true, subtree: true });
  }

  function init() {
    if (state.initialized) {
      refresh();
      return true;
    }
    ensureStylesheet();
    installCsvProvenance();
    installPublishCapture();
    wrapConfirmDangerousAction();
    wrapExportedRelease();
    observe();
    window.addEventListener('rcc:result-draft-saved', () => refresh());
    state.initialized = true;
    refresh();
    return true;
  }

  window.RCCResultReviewHardening = {
    init,
    refresh,
    validateRows,
    explicitSource,
    finalSummaryText
  };
})();