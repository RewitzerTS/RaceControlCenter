(() => {
  let importing = false;
  let publishing = false;
  let recalculating = false;

  function scoringConfig() {
    const settings = window.RCCLeagueContext?.snapshot?.()?.league?.settings || {};
    const scoring = settings.scoring || {};
    const points = Array.isArray(scoring.points)
      ? scoring.points.map(Number).filter((value) => Number.isFinite(value) && value >= 0)
      : [];
    return {
      points: points.length ? points : [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      fastestLapBonus: Math.max(0, Number(scoring.fastest_lap_bonus ?? 1) || 0),
      fastestLapTopN: Math.max(0, Number(scoring.fastest_lap_top_n ?? 10) || 0)
    };
  }

  function basePointsForPosition(position) {
    const pos = Number(position);
    if (!Number.isFinite(pos) || pos < 1) return 0;
    return scoringConfig().points[Math.floor(pos) - 1] || 0;
  }

  function lapMs(value) {
    return window.RCCData?.parseLapTimeToMs?.(value) ?? null;
  }

  function fastestLapWinnerId(rows = []) {
    const config = scoringConfig();
    let winnerId = null;
    let bestMs = Infinity;
    rows.forEach((row) => {
      const position = Number(row.finish_position || 0);
      const eligible = config.fastestLapTopN === 0 || (position >= 1 && position <= config.fastestLapTopN);
      if (!eligible) return;
      const value = lapMs(row.fastest_lap_time);
      if (!Number.isFinite(value) || value <= 0 || value >= bestMs) return;
      bestMs = value;
      winnerId = row.driver_id || null;
    });
    return winnerId;
  }

  function clearLeagueCaches() {
    const slug = window.RCCLeagueContext?.getSlug?.() || new URLSearchParams(window.location.search).get('league') || '';
    try {
      Object.keys(window.localStorage || {}).forEach((key) => {
        if (key.startsWith('rcc_query_cache_v2') && (!slug || key.includes(`:${slug}:`))) window.localStorage.removeItem(key);
      });
      Object.keys(window.sessionStorage || {}).forEach((key) => {
        if (key.startsWith('rcc.standings.view.v1')) window.sessionStorage.removeItem(key);
      });
    } catch (_error) {}
  }

  function revealFeedback(id, message, isError = false) {
    if (typeof window.showFeedback === 'function') window.showFeedback(id, message, isError);
    const el = document.getElementById(id);
    if (el && !isError) window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  }

  async function activeScope() {
    const context = await window.RCCData.getLeagueContext({ forceRefresh: true });
    const season = await window.RCCData.fetchCurrentSeason({ forceRefresh: true, backgroundRefresh: false });
    if (!context?.leagueId) throw new Error('Keine aktive Liga gefunden.');
    if (!season?.id) throw new Error('Keine aktive Saison in dieser Liga gefunden.');
    if (season.league_id && season.league_id !== context.leagueId) throw new Error('Sicherheitsstopp: Saison gehört nicht zur aktiven Liga.');
    return { context, season };
  }

  async function driverTeamMaps(leagueId) {
    const [{ data: drivers, error: driversError }, { data: teams, error: teamsError }] = await Promise.all([
      window.supabaseClient.from('drivers').select('id, league_id, display_name, league_team, car_name').eq('league_id', leagueId),
      window.supabaseClient.from('teams').select('id, league_id, display_name').eq('league_id', leagueId)
    ]);
    if (driversError) throw driversError;
    if (teamsError) throw teamsError;
    const teamsByName = new Map((teams || []).map((team) => [String(team.display_name || '').trim().toLowerCase(), team]));
    return {
      driversById: new Map((drivers || []).map((driver) => [driver.id, driver])),
      teamsByName
    };
  }

  function enrichOfficialRows(rows, maps) {
    const winnerId = fastestLapWinnerId(rows);
    const config = scoringConfig();
    return rows.filter((row) => row.driver_id).map((row) => {
      const driver = maps.driversById.get(row.driver_id);
      if (!driver) throw new Error('Sicherheitsstopp: Ein Ergebnisfahrer gehört nicht zur aktiven Liga.');
      const position = Number(row.finish_position || 0);
      const basePoints = basePointsForPosition(position);
      const bonus = winnerId && row.driver_id === winnerId ? config.fastestLapBonus : 0;
      const team = maps.teamsByName.get(String(driver.league_team || '').trim().toLowerCase()) || null;
      const fastestMs = lapMs(row.fastest_lap_time);
      const raceMs = lapMs(row.race_time);
      return {
        race_id: row.race_id,
        driver_id: row.driver_id,
        team_id: team?.id || null,
        finish_position: position || null,
        grid_position: row.grid_position == null ? null : Number(row.grid_position),
        pit_stops: row.pit_stops == null ? null : Number(row.pit_stops),
        fastest_lap_time: row.fastest_lap_time || null,
        fastest_lap_time_ms: Number.isFinite(fastestMs) ? fastestMs : null,
        fastest_lap_ms: Number.isFinite(fastestMs) ? fastestMs : null,
        race_time: row.race_time || null,
        race_time_ms: Number.isFinite(raceMs) ? raceMs : null,
        participation_status: row.participation_status || 'PLAYER',
        base_points: basePoints,
        points: basePoints,
        awarded_points: basePoints + bonus,
        car_name_snapshot: driver.car_name || null,
        points_team_name: driver.league_team || null,
        points_car_name: driver.car_name || null
      };
    });
  }

  async function recalculateOfficialRaceResultsGuarded(raceId, options = {}) {
    if (!raceId || recalculating) return;
    recalculating = true;
    try {
      const { context, season } = await activeScope();
      const { data: race, error: raceError } = await window.supabaseClient
        .from('races').select('id, season_id').eq('id', raceId).eq('season_id', season.id).maybeSingle();
      if (raceError || !race) throw new Error('Sicherheitsstopp: Rennen gehört nicht zur aktiven Liga/Saison.');

      const [{ data: results, error: resultError }, { data: penalties, error: penaltyError }, { data: importItem, error: importError }, maps] = await Promise.all([
        window.supabaseClient.from('race_results').select('*').eq('race_id', raceId),
        window.supabaseClient.from('race_penalties').select('driver_id, time_delta_ms').eq('race_id', raceId),
        window.supabaseClient.from('race_result_imports').select('id,race_result_import_rows(*)').eq('race_id', raceId).order('imported_at', { ascending: false }).limit(1).maybeSingle(),
        driverTeamMaps(context.leagueId)
      ]);
      if (resultError) throw resultError;
      if (penaltyError) throw penaltyError;
      if (importError && importError.code !== 'PGRST116') throw importError;
      if (!results?.length) return;

      const officialByDriver = new Map(results.map((row) => [row.driver_id, row]));
      const source = (importItem?.race_result_import_rows || []).length ? importItem.race_result_import_rows : results;
      const baseRows = source.filter((row) => officialByDriver.has(row.driver_id)).map((row) => ({ ...officialByDriver.get(row.driver_id), ...row, race_id: raceId }));
      const adjusted = typeof window.applyPenaltiesToRows === 'function' ? window.applyPenaltiesToRows(baseRows, penalties || []) : baseRows;
      const enriched = enrichOfficialRows(adjusted, maps);

      const responses = await Promise.all(enriched.map((row) => {
        const payload = { ...row };
        delete payload.race_id;
        if (options.preserveManualPoints) {
          const existing = officialByDriver.get(row.driver_id);
          payload.points = Number(existing?.points ?? row.points ?? 0);
          payload.base_points = Number(existing?.base_points ?? payload.points ?? 0);
          payload.awarded_points = Number(existing?.awarded_points ?? row.awarded_points ?? 0);
        }
        return window.supabaseClient.from('race_results').update(payload).eq('race_id', raceId).eq('driver_id', row.driver_id);
      }));
      const failed = responses.find((response) => response.error);
      if (failed?.error) throw failed.error;
      clearLeagueCaches();
    } finally {
      recalculating = false;
    }
  }

  async function importRaceResultsGuarded(options = {}) {
    if (importing) return;
    importing = true;
    if (typeof window.clearFeedback === 'function') window.clearFeedback('csv-feedback');
    try {
      await window.requireAdminSession?.();
      const { context, season } = await activeScope();
      const previewFieldId = options.previewFieldId || 'csv-preview';
      const overwritePublished = Boolean(options.overwritePublished);
      const csvText = String(document.getElementById(previewFieldId)?.value || '').trim();
      if (!csvText) return revealFeedback('csv-feedback', 'Bitte zuerst eine CSV-Datei laden.', true);

      const analysis = await window.analyzeCsvImport(csvText);
      if (!analysis?.ok) return revealFeedback('csv-feedback', 'Import blockiert: Bitte zuerst die Konflikte in der Vorschau beheben.', true);
      const grandPrixName = analysis.grandPrixName;
      if (!grandPrixName) return revealFeedback('csv-feedback', 'Spalte „Grand Prix“ fehlt oder ist leer.', true);

      let { data: raceData, error: raceError } = await window.supabaseClient
        .from('races').select('id, grand_prix_name, season_id, weather, status').eq('season_id', season.id).eq('grand_prix_name', grandPrixName).maybeSingle();
      if (!raceData) {
        const matchedTrack = window.findTrackByGrandPrixName?.(grandPrixName, window.getActiveSeasonGameKey?.());
        if (matchedTrack?.grandPrixName) {
          const response = await window.supabaseClient.from('races').select('id, grand_prix_name, season_id, weather, status').eq('season_id', season.id).eq('grand_prix_name', matchedTrack.grandPrixName).maybeSingle();
          raceData = response.data;
          raceError = response.error || raceError;
        }
      }
      if (raceError || !raceData) return revealFeedback('csv-feedback', `Rennen „${grandPrixName}“ wurde in der aktiven Liga/Saison nicht gefunden.`, true);

      const maps = await driverTeamMaps(context.leagueId);
      const foreignDriver = (analysis.preparedRows || []).find((row) => row.driver_id && !maps.driversById.has(row.driver_id));
      if (foreignDriver) return revealFeedback('csv-feedback', 'Sicherheitsstopp: Mindestens ein gemappter Fahrer gehört nicht zur aktiven Liga.', true);

      const [{ count: officialCount, error: officialError }, { count: penaltyCount, error: penaltyError }] = await Promise.all([
        window.supabaseClient.from('race_results').select('id', { count: 'exact', head: true }).eq('race_id', raceData.id),
        window.supabaseClient.from('race_penalties').select('id', { count: 'exact', head: true }).eq('race_id', raceData.id)
      ]);
      if (officialError || penaltyError) throw officialError || penaltyError;
      if ((officialCount || 0) > 0 && !overwritePublished) return revealFeedback('csv-feedback', `Für „${grandPrixName}“ sind bereits veröffentlichte Ergebnisse vorhanden. Aktiviere „Korrektur Upload“, um sie zu ersetzen.`, true);

      const { data: existingImport, error: existingImportError } = await window.supabaseClient.from('race_result_imports').select('id').eq('race_id', raceData.id).maybeSingle();
      if (existingImportError && existingImportError.code !== 'PGRST116') throw existingImportError;
      let importId = existingImport?.id || null;
      if (importId) {
        const responses = await Promise.all([
          window.supabaseClient.from('race_result_import_rows').delete().eq('import_id', importId),
          window.supabaseClient.from('race_result_imports').update({ status: 'under_review', imported_at: new Date().toISOString(), published_at: null }).eq('id', importId)
        ]);
        const failed = responses.find((response) => response.error);
        if (failed?.error) throw failed.error;
      } else {
        const { data: created, error: createError } = await window.supabaseClient.from('race_result_imports').insert([{ race_id: raceData.id, status: 'under_review', imported_at: new Date().toISOString() }]).select('id').single();
        if (createError) throw createError;
        importId = created.id;
      }

      const previewRows = (analysis.preparedRows || []).map((row) => ({ ...row, race_id: raceData.id }));
      const winnerId = fastestLapWinnerId(previewRows);
      const config = scoringConfig();
      const rowsPayload = previewRows.map((row) => {
        const position = Number(row.finish_position || 0);
        const basePoints = basePointsForPosition(position);
        const awarded = basePoints + (winnerId && row.driver_id === winnerId ? config.fastestLapBonus : 0);
        return { import_id: importId, ...row, awarded_points: awarded };
      });
      rowsPayload.forEach((row) => delete row.race_id);
      const { error: rowsError } = await window.supabaseClient.from('race_result_import_rows').insert(rowsPayload);
      if (rowsError) throw rowsError;

      await window.renderPublishWorkflow?.();
      await window.updateAdminOverview?.();
      const correction = (officialCount || 0) > 0 ? ' Korrekturimport aktiv.' : '';
      const penalties = (penaltyCount || 0) > 0 ? ` ${penaltyCount} Steward-Entscheidung${penaltyCount === 1 ? '' : 'en'} wird/werden bei der Freigabe berücksichtigt.` : '';
      revealFeedback('csv-feedback', `✓ Ergebnisse für „${raceData.grand_prix_name}“ wurden sicher in ${context.league?.name || 'der aktiven Liga'} gespeichert. Noch nicht WM-wirksam: Bitte jetzt im Freigabe-Workflow „Jetzt veröffentlichen“ wählen.${correction}${penalties}`);
    } catch (error) {
      console.error('Gesicherter Ergebnisimport fehlgeschlagen.', error);
      revealFeedback('csv-feedback', `Fehler beim Import: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      importing = false;
    }
  }

  async function publishPendingResultsGuarded(importId, raceId) {
    if (publishing) return;
    publishing = true;
    if (typeof window.clearFeedback === 'function') window.clearFeedback('publish-feedback');
    try {
      await window.requireAdminSession?.();
      const { context, season } = await activeScope();
      const [{ data: importItem, error: importError }, { data: race, error: raceError }, { data: penalties, error: penaltyError }, maps] = await Promise.all([
        window.supabaseClient.from('race_result_imports').select('id,race_id,status,race_result_import_rows(*)').eq('id', importId).eq('race_id', raceId).maybeSingle(),
        window.supabaseClient.from('races').select('id,season_id,grand_prix_name,status').eq('id', raceId).eq('season_id', season.id).maybeSingle(),
        window.supabaseClient.from('race_penalties').select('driver_id,time_delta_ms').eq('race_id', raceId),
        driverTeamMaps(context.leagueId)
      ]);
      if (importError || !importItem) throw new Error('Kein Ergebnisentwurf gefunden.');
      if (raceError || !race) throw new Error('Sicherheitsstopp: Entwurf gehört nicht zur aktiven Liga/Saison.');
      if (penaltyError) throw penaltyError;

      const confirmed = await window.confirmDangerousAction?.({ title: `${race.grand_prix_name} veröffentlichen?`, details: 'Danach zählt das Rennen für Fahrer-WM, Team-WM und Saisonwertung und wird als abgeschlossen markiert.', keyword: 'VEROEFFENTLICHEN' });
      if (confirmed === false) return;

      const rawRows = (importItem.race_result_import_rows || []).map((row) => ({ ...row, race_id: raceId }));
      const foreignDriver = rawRows.find((row) => row.driver_id && !maps.driversById.has(row.driver_id));
      if (foreignDriver) throw new Error('Sicherheitsstopp: Ergebnis enthält Fahrer aus einer anderen Liga.');
      const adjusted = typeof window.applyPenaltiesToRows === 'function' ? window.applyPenaltiesToRows(rawRows, penalties || []) : rawRows;
      const officialRows = enrichOfficialRows(adjusted, maps);

      const { error: deleteError } = await window.supabaseClient.from('race_results').delete().eq('race_id', raceId);
      if (deleteError) throw deleteError;
      const { error: insertError } = await window.supabaseClient.from('race_results').upsert(officialRows, { onConflict: 'race_id,driver_id' });
      if (insertError) throw insertError;

      const responses = await Promise.all([
        window.supabaseClient.from('races').update({ status: 'completed' }).eq('id', raceId).eq('season_id', season.id),
        window.supabaseClient.from('race_result_imports').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', importId).eq('race_id', raceId)
      ]);
      const failed = responses.find((response) => response.error);
      if (failed?.error) throw failed.error;

      clearLeagueCaches();
      await Promise.allSettled([window.renderPublishWorkflow?.(), window.loadSeasonSummary?.(), window.populateManualRaceSelect?.(), window.updateAdminOverview?.()]);
      revealFeedback('publish-feedback', `✓ ${race.grand_prix_name} wurde veröffentlicht. Rennstatus: abgeschlossen. Fahrer-WM, Team-WM und Saisonwertung verwenden jetzt ${officialRows.length} offizielle Ergebnisse inklusive Schnellste-Runde-Bonus.`);
    } catch (error) {
      console.error('Gesicherte Ergebnisfreigabe fehlgeschlagen.', error);
      revealFeedback('publish-feedback', `Fehler beim Veröffentlichen: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      publishing = false;
    }
  }

  function install() {
    window.importRaceResults = importRaceResultsGuarded;
    window.publishPendingResults = publishPendingResultsGuarded;
    window.recalculateOfficialRaceResults = recalculateOfficialRaceResultsGuarded;
  }

  async function init() {
    install();
  }

  window.RCCResultsConsistency = { init, install, scoringConfig };
})();
