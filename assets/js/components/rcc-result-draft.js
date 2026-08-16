(() => {
  if (window.RCCResultDraft) return;

  const WORKFLOW_REFRESH_TIMEOUT_MS = 8000;

  async function requireAdmin() {
    if (typeof window.requireAdminSession === 'function') return window.requireAdminSession();
    const { data, error } = await window.supabaseClient.auth.getSession();
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

  async function save({ raceId, rows = [], sourceFilename = 'Ergebnisentwurf' } = {}) {
    const normalizedRaceId = String(raceId || '').trim();
    if (!normalizedRaceId) throw new Error('Kein Rennen für den Entwurf ausgewählt.');
    if (!Array.isArray(rows) || !rows.length) throw new Error('Der Ergebnisentwurf enthält keine Fahrer.');

    const session = await requireAdmin();
    const payloadRows = rows.map(cleanRow);
    const now = new Date().toISOString();

    const { data: existingImport, error: existingError } = await window.supabaseClient
      .from('race_result_imports')
      .select('id')
      .eq('race_id', normalizedRaceId)
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
        .update({
          status: 'under_review',
          source_filename: String(sourceFilename || 'Ergebnisentwurf'),
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
          race_id: normalizedRaceId,
          status: 'under_review',
          source_filename: String(sourceFilename || 'Ergebnisentwurf'),
          imported_by: session?.user?.id || null,
          imported_at: now
        }])
        .select('id')
        .single();
      if (createError) throw createError;
      importId = created.id;
    }

    const insertPayload = payloadRows.map((row) => ({ import_id: importId, ...row }));
    const { error: insertError } = await window.supabaseClient
      .from('race_result_import_rows')
      .insert(insertPayload);
    if (insertError) throw insertError;

    const { error: raceError } = await window.supabaseClient
      .from('races')
      .update({ status: 'upcoming' })
      .eq('id', normalizedRaceId);
    if (raceError) throw raceError;

    window.dispatchEvent(new CustomEvent('rcc:result-draft-saved', {
      detail: { raceId: normalizedRaceId, importId, sourceFilename: String(sourceFilename || '') }
    }));

    refreshWorkflowInBackground();

    return { importId, rows: payloadRows };
  }

  window.RCCResultDraft = { save };
})();
