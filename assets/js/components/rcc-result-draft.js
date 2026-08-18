(() => {
  if (window.RCCResultDraft) return;

  const WORKFLOW_REFRESH_TIMEOUT_MS = 8000;
  const DRAFT_QUERY_TIMEOUT_MS = Math.max(
    1000,
    Number(window.__RCC_RESULT_DRAFT_QUERY_TIMEOUT_MS) || 20000
  );
  const SESSION_TIMEOUT_MS = 12000;

  function timeoutError(label, ms) {
    return new Error(`${label} hat nach ${Math.round(ms / 1000)} Sekunden nicht geantwortet. Bitte die Verbindung prüfen und erneut versuchen.`);
  }

  function withTimeout(promise, ms, label) {
    let timeoutId = null;
    const timeout = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(timeoutError(label, ms)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timeoutId) window.clearTimeout(timeoutId);
    });
  }

  async function runQuery(query, label) {
    if (!query) throw new Error(`${label} konnte nicht gestartet werden.`);
    if (typeof AbortController !== 'function' || typeof query.abortSignal !== 'function') {
      return withTimeout(Promise.resolve(query), DRAFT_QUERY_TIMEOUT_MS, label);
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), DRAFT_QUERY_TIMEOUT_MS);
    try {
      const response = await query.abortSignal(controller.signal);
      if (controller.signal.aborted) throw timeoutError(label, DRAFT_QUERY_TIMEOUT_MS);
      return response;
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') {
        throw timeoutError(label, DRAFT_QUERY_TIMEOUT_MS);
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function requireAdmin() {
    if (typeof window.requireAdminSession === 'function') {
      return withTimeout(
        Promise.resolve().then(() => window.requireAdminSession()),
        SESSION_TIMEOUT_MS,
        'Die Admin-Sitzung'
      );
    }
    const { data, error } = await withTimeout(
      window.supabaseClient.auth.getSession(),
      SESSION_TIMEOUT_MS,
      'Die Admin-Sitzung'
    );
    if (error) throw error;
    if (!data?.session) throw new Error('Bitte zuerst als Ligaleitung einloggen.');
    return data.session;
  }

  function cleanRow(row = {}) {
    return {
      driver_id: String(row.driver_id || '').trim(),
      driver_name_raw: row.driver_name_raw ? String(row.driver_name_raw).trim() : null,
      finish_position: Number(row.finish_position || 0),
      grid_position: row.grid_position === null || row.grid_position === undefined || row.grid_position === ''
        ? null
        : Number(row.grid_position),
      pit_stops: row.pit_stops === null || row.pit_stops === undefined || row.pit_stops === ''
        ? 0
        : Number(row.pit_stops),
      fastest_lap_time: row.fastest_lap_time ? String(row.fastest_lap_time).trim() : null,
      race_time: row.race_time ? String(row.race_time).trim() : null,
      awarded_points: 0,
      participation_status: String(row.participation_status || 'PLAYER').toUpperCase() === 'BOT' ? 'BOT' : 'PLAYER',
      raw_payload: row.raw_payload || null
    };
  }

  function refreshWorkflowInBackground() {
    if (typeof window.renderPublishWorkflow !== 'function') return;

    let timeoutId = null;
    const timeout = new Promise((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error('Entwurfsübersicht-Refresh hat das Zeitlimit überschritten.')),
        WORKFLOW_REFRESH_TIMEOUT_MS
      );
    });

    Promise.race([
      Promise.resolve().then(() => window.renderPublishWorkflow()),
      timeout
    ])
      .catch((error) => {
        console.warn('Entwurfsübersicht konnte nach dem Speichern nicht sofort aktualisiert werden.', error);
      })
      .finally(() => {
        if (timeoutId) window.clearTimeout(timeoutId);
      });
  }

  function schedulePostSaveUi({ raceId, importId, sourceFilename }) {
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('rcc:result-draft-saved', {
        detail: { raceId, importId, sourceFilename }
      }));
      refreshWorkflowInBackground();
    }, 0);
  }

  function ensureScript(globalName, selector, src, errorMessage) {
    if (window[globalName] || document.querySelector(selector)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    const marker = selector.match(/data-([a-z0-9-]+)=/i)?.[1];
    if (marker) script.setAttribute(`data-${marker}`, 'true');
    script.onerror = () => console.warn(errorMessage);
    document.head.appendChild(script);
  }

  function ensureCorrectionModules() {
    ensureScript(
      'RCCResultCorrection',
      'script[data-rcc-result-correction="true"]',
      'assets/js/components/rcc-result-correction.js',
      'Ergebnis-Korrekturmodul konnte nicht geladen werden.'
    );
    if (document.body?.dataset?.page === 'admin') {
      ensureScript(
        'RCCResultVersionHistory',
        'script[data-rcc-result-version-history="true"]',
        'assets/js/components/rcc-result-version-history.js',
        'Ergebnis-Versionhistorie konnte nicht geladen werden.'
      );
      ensureScript(
        '__RCC_ADMIN_PUBLISHED_RECALC_GUARD',
        'script[data-rcc-admin-published-recalc-guard="true"]',
        'assets/js/components/rcc-admin-published-recalc-guard.js',
        'Admin-Recalculate-Guard konnte nicht geladen werden.'
      );
    }
  }

  async function save({ raceId, rows = [], sourceFilename = 'Ergebnisentwurf' } = {}) {
    const normalizedRaceId = String(raceId || '').trim();
    if (!normalizedRaceId) throw new Error('Kein Rennen für den Entwurf ausgewählt.');
    if (!Array.isArray(rows) || !rows.length) throw new Error('Der Ergebnisentwurf enthält keine Fahrer.');

    const session = await requireAdmin();
    const payloadRows = rows.map(cleanRow);
    const now = new Date().toISOString();

    const { data: existingImports, error: existingError } = await runQuery(
      window.supabaseClient
        .from('race_result_imports')
        .select('id, status')
        .eq('race_id', normalizedRaceId)
        .in('status', ['draft', 'under_review'])
        .order('imported_at', { ascending: false })
        .limit(1),
      'Vorhandener Ergebnisentwurf'
    );
    if (existingError) throw existingError;

    let importId = existingImports?.[0]?.id || null;
    if (importId) {
      const { error: deleteError } = await runQuery(
        window.supabaseClient
          .from('race_result_import_rows')
          .delete()
          .eq('import_id', importId),
        'Alte Entwurfszeilen'
      );
      if (deleteError) throw deleteError;

      const { error: updateError } = await runQuery(
        window.supabaseClient
          .from('race_result_imports')
          .update({
            status: 'under_review',
            source_filename: String(sourceFilename || 'Ergebnisentwurf'),
            imported_by: session?.user?.id || null,
            imported_at: now
          })
          .eq('id', importId)
          .in('status', ['draft', 'under_review']),
        'Ergebnisentwurf'
      );
      if (updateError) throw updateError;
    } else {
      const { data: created, error: createError } = await runQuery(
        window.supabaseClient
          .from('race_result_imports')
          .insert([{
            race_id: normalizedRaceId,
            status: 'under_review',
            source_filename: String(sourceFilename || 'Ergebnisentwurf'),
            imported_by: session?.user?.id || null,
            imported_at: now
          }])
          .select('id')
          .single(),
        'Neuer Ergebnisentwurf'
      );
      if (createError) throw createError;
      importId = created.id;
    }

    const insertPayload = payloadRows.map((row) => ({ import_id: importId, ...row }));
    const { error: insertError } = await runQuery(
      window.supabaseClient
        .from('race_result_import_rows')
        .insert(insertPayload),
      'Entwurfszeilen'
    );
    if (insertError) throw insertError;

    schedulePostSaveUi({
      raceId: normalizedRaceId,
      importId,
      sourceFilename: String(sourceFilename || '')
    });

    return { importId, rows: payloadRows };
  }

  window.RCCResultDraft = { save };
  ensureCorrectionModules();
})();