(() => {
  if (window.RCCResultRelease) return;

  const DEFAULT_SCORING = {
    points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    fastest_lap_bonus: 1,
    fastest_lap_top_n: 10,
    ai_replacement_points: 'full'
  };

  let savingSteward = false;
  let deletingSteward = false;
  let publishing = false;
  let workflowObserver = null;

  function escape(value) {
    return window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '');
  }

  function value(id, fallback = '') {
    return document.getElementById(id)?.value ?? fallback;
  }

  function trimmed(id) {
    return String(value(id, '') || '').trim();
  }

  function feedback(id, message = '', isError = false) {
    if (typeof window.showFeedback === 'function') {
      window.showFeedback(id, message, isError);
      return;
    }
    const element = document.getElementById(id);
    if (!element) return;
    element.hidden = !message;
    element.textContent = message;
    element.classList.toggle('notice-error', Boolean(isError));
  }

  function clearFeedback(id) {
    if (typeof window.clearFeedback === 'function') {
      window.clearFeedback(id);
      return;
    }
    const element = document.getElementById(id);
    if (!element) return;
    element.hidden = true;
    element.textContent = '';
    element.classList.remove('notice-error');
  }

  async function requireAdmin() {
    if (typeof window.requireAdminSession === 'function') return window.requireAdminSession();
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data?.session) throw new Error('Bitte zuerst als Ligaleitung einloggen.');
    return data.session;
  }

  function leagueId() {
    return window.RCCLeagueContext?.getLeagueId?.() || null;
  }

  function normalizeMode(value) {
    return ['full', 'half', 'none'].includes(String(value || '').trim()) ? String(value).trim() : 'full';
  }

  function normalizeScoring(settings = {}) {
    const scoring = settings?.scoring && typeof settings.scoring === 'object' ? settings.scoring : {};
    const points = Array.isArray(scoring.points) && scoring.points.length
      ? scoring.points.map(Number).filter(Number.isFinite)
      : DEFAULT_SCORING.points;
    return {
      points: points.length ? points : DEFAULT_SCORING.points,
      fastest_lap_bonus: Number.isFinite(Number(scoring.fastest_lap_bonus)) ? Number(scoring.fastest_lap_bonus) : 1,
      fastest_lap_top_n: Math.max(0, Number(scoring.fastest_lap_top_n ?? 10) || 10),
      ai_replacement_points: normalizeMode(scoring.ai_replacement_points)
    };
  }

  async function fetchLeagueSettings() {
    const id = leagueId();
    if (!id) return { settings: {}, scoring: { ...DEFAULT_SCORING } };
    const { data, error } = await window.supabaseClient
      .from('leagues')
      .select('id, settings')
      .eq('id', id)
      .single();
    if (error) throw error;
    return { settings: data?.settings || {}, scoring: normalizeScoring(data?.settings || {}) };
  }

  function parseDurationMs(input) {
    const raw = String(input ?? '').trim();
    if (!raw) return null;
    const status = window.RCCResultTimeFormat?.normalizeRaceStatus?.(raw);
    if (status) return null;

    const sign = raw.startsWith('-') ? -1 : 1;
    let body = raw.replace(/^[+-]/, '').trim().replace(/\s+/g, '');
    body = body.replace(/,(?=\d{1,3}$)/, '.');
    const parts = body.split(':');
    if (parts.length < 1 || parts.length > 3) return null;
    if (parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) return null;

    let seconds;
    if (parts.length === 3) {
      seconds = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
    } else if (parts.length === 2) {
      seconds = Number(parts[0]) * 60 + Number(parts[1]);
    } else {
      seconds = Number(parts[0]);
    }
    if (!Number.isFinite(seconds)) return null;
    return Math.round(seconds * 1000) * sign;
  }

  function formatDurationMs(ms, prefix = '') {
    if (!Number.isFinite(Number(ms))) return '';
    const absolute = Math.max(0, Math.round(Math.abs(Number(ms))));
    const totalSeconds = Math.floor(absolute / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = absolute % 1000;
    return `${prefix}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  }

  function normalizeRaceStatus(value) {
    return window.RCCResultTimeFormat?.normalizeRaceStatus?.(value) || null;
  }

  function penaltyMaps(penalties = []) {
    const timeByDriver = new Map();
    const pointsByDriver = new Map();
    penalties.forEach((penalty) => {
      const driverId = String(penalty.driver_id || '').trim();
      if (!driverId) return;
      timeByDriver.set(driverId, (timeByDriver.get(driverId) || 0) + Number(penalty.time_delta_ms || 0));
      pointsByDriver.set(driverId, (pointsByDriver.get(driverId) || 0) + Number(penalty.points_delta || 0));
    });
    return { timeByDriver, pointsByDriver };
  }

  function applyStewardPenalties(rows = [], penalties = []) {
    const original = rows.map((row) => ({ ...row, original_position: Number(row.finish_position || 999) }));
    const leader = [...original].sort((a, b) => a.original_position - b.original_position)[0] || null;
    const leaderMs = leader ? parseDurationMs(leader.race_time) : null;
    const { timeByDriver, pointsByDriver } = penaltyMaps(penalties);

    const adjusted = original.map((row) => {
      const parsed = parseDurationMs(row.race_time);
      const raw = String(row.race_time || '').trim();
      const isGap = /^\+/.test(raw) || (Number.isFinite(leaderMs) && row.original_position > 1 && Number.isFinite(parsed) && Math.abs(parsed) < leaderMs);
      const absoluteMs = Number.isFinite(parsed)
        ? (isGap && Number.isFinite(leaderMs) ? leaderMs + Math.abs(parsed) : Math.abs(parsed))
        : null;
      const penaltyMs = timeByDriver.get(String(row.driver_id)) || 0;
      return {
        ...row,
        absolute_ms: Number.isFinite(absoluteMs) ? absoluteMs + penaltyMs : null,
        penalty_time_delta_ms: penaltyMs,
        points_delta: pointsByDriver.get(String(row.driver_id)) || 0,
        normalized_status: normalizeRaceStatus(row.race_time)
      };
    });

    adjusted.sort((a, b) => {
      const aMs = Number.isFinite(a.absolute_ms) ? a.absolute_ms : Number.MAX_SAFE_INTEGER;
      const bMs = Number.isFinite(b.absolute_ms) ? b.absolute_ms : Number.MAX_SAFE_INTEGER;
      if (aMs !== bMs) return aMs - bMs;
      return a.original_position - b.original_position;
    });

    const numericLeader = adjusted.find((row) => Number.isFinite(row.absolute_ms));
    const finalLeaderMs = numericLeader?.absolute_ms ?? null;
    adjusted.forEach((row, index) => {
      row.finish_position = index + 1;
      if (Number.isFinite(row.absolute_ms)) {
        row.race_time = row === numericLeader
          ? formatDurationMs(row.absolute_ms)
          : formatDurationMs(Math.max(0, row.absolute_ms - finalLeaderMs), '+');
      } else if (row.normalized_status) {
        row.race_time = row.normalized_status;
      }
    });
    return adjusted;
  }

  function fastestLapWinner(rows = []) {
    let winner = null;
    let best = null;
    rows.forEach((row) => {
      const ms = parseDurationMs(row.fastest_lap_time);
      if (!Number.isFinite(ms) || ms < 0) return;
      if (best === null || ms < best) {
        best = ms;
        winner = String(row.driver_id || '');
      }
    });
    return winner;
  }

  function aiFactor(row, driver, scoring) {
    if (String(row.participation_status || 'PLAYER').toUpperCase() !== 'BOT') return 1;
    if (!String(driver?.gamertag || '').trim()) return 1;
    if (scoring.ai_replacement_points === 'none') return 0;
    if (scoring.ai_replacement_points === 'half') return 0.5;
    return 1;
  }

  function roundPoints(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function scoreRows(rows, driversById, scoring) {
    const fastestId = fastestLapWinner(rows);
    return rows.map((row) => {
      const position = Number(row.finish_position || 0);
      const base = Number(scoring.points[position - 1] || 0);
      const bonus = fastestId && fastestId === String(row.driver_id) && position <= scoring.fastest_lap_top_n
        ? Number(scoring.fastest_lap_bonus || 0)
        : 0;
      const driver = driversById.get(String(row.driver_id));
      const factor = aiFactor(row, driver, scoring);
      const scaledBase = roundPoints(base * factor);
      const awarded = roundPoints(Math.max(0, (base + bonus) * factor + Number(row.points_delta || 0)));
      const fastestMs = parseDurationMs(row.fastest_lap_time);
      return {
        driver_id: row.driver_id,
        grid_position: row.grid_position ?? null,
        finish_position: position,
        race_time_ms: Number.isFinite(row.absolute_ms) ? Math.round(row.absolute_ms) : null,
        fastest_lap_time_ms: Number.isFinite(fastestMs) ? Math.round(fastestMs) : null,
        fastest_lap_ms: Number.isFinite(fastestMs) ? Math.round(fastestMs) : null,
        pit_stops: Number(row.pit_stops || 0),
        participation_status: String(row.participation_status || 'PLAYER').toUpperCase() === 'BOT' ? 'BOT' : 'PLAYER',
        base_points: scaledBase,
        points: scaledBase,
        awarded_points: awarded,
        penalty_time_delta_ms: Number(row.penalty_time_delta_ms || 0),
        fastest_lap_time: row.fastest_lap_time || null,
        race_time: row.race_time || null
      };
    });
  }

  async function buildOfficialRows(importItem) {
    const rows = (importItem?.race_result_import_rows || []).filter((row) => row.driver_id).map((row) => ({ ...row }));
    if (!rows.length) throw new Error('Der Ergebnisentwurf enthält keine Fahrer.');
    const driverIds = [...new Set(rows.map((row) => row.driver_id))];
    const [penaltyResponse, driverResponse, settingsResult] = await Promise.all([
      window.supabaseClient
        .from('race_penalties')
        .select('driver_id, time_delta_ms, points_delta')
        .eq('race_id', importItem.race_id),
      window.supabaseClient
        .from('drivers')
        .select('id, display_name, gamertag, ai_driver_reference, league_team, car_name')
        .in('id', driverIds),
      fetchLeagueSettings()
    ]);
    if (penaltyResponse.error) throw penaltyResponse.error;
    if (driverResponse.error) throw driverResponse.error;
    const driversById = new Map((driverResponse.data || []).map((driver) => [String(driver.id), driver]));
    const adjusted = applyStewardPenalties(rows, penaltyResponse.data || []);
    return {
      rows: scoreRows(adjusted, driversById, settingsResult.scoring),
      scoring: settingsResult.scoring,
      driversById
    };
  }

  async function fetchImport(importId, raceId = '') {
    let query = window.supabaseClient
      .from('race_result_imports')
      .select(`
        id,
        race_id,
        status,
        source_filename,
        imported_at,
        published_at,
        races:race_id ( grand_prix_name ),
        race_result_import_rows (
          id,
          driver_id,
          finish_position,
          grid_position,
          pit_stops,
          fastest_lap_time,
          race_time,
          awarded_points,
          participation_status,
          raw_payload
        )
      `)
      .eq('id', importId);
    if (raceId) query = query.eq('race_id', raceId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function pendingDraftForRace(raceId) {
    const { data, error } = await window.supabaseClient
      .from('race_result_imports')
      .select('id, status')
      .eq('race_id', raceId)
      .in('status', ['draft', 'under_review'])
      .order('imported_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0] || null;
  }

  async function publishedImportForRace(raceId) {
    const { data, error } = await window.supabaseClient
      .from('race_result_imports')
      .select('id')
      .eq('race_id', raceId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0] || null;
  }

  async function writeOfficial(importItem) {
    const built = await buildOfficialRows(importItem);
    const { error } = await window.supabaseClient.rpc('publish_race_result_draft', {
      p_import_id: importItem.id,
      p_race_id: importItem.race_id,
      p_rows: built.rows
    });
    if (error) throw error;
    return built;
  }

  async function rebuildPublishedRace(raceId) {
    if (await pendingDraftForRace(raceId)) return false;
    const published = await publishedImportForRace(raceId);
    if (!published?.id) return false;
    const item = await fetchImport(published.id, raceId);
    if (!item) return false;
    await writeOfficial(item);
    return true;
  }

  async function finalPublish(importId, raceId) {
    if (publishing) return;
    publishing = true;
    clearFeedback('publish-feedback');
    try {
      await requireAdmin();
      const item = await fetchImport(importId, raceId);
      if (!item) throw new Error('Kein Ergebnisentwurf für dieses Rennen gefunden.');
      if (!['draft', 'under_review'].includes(String(item.status || ''))) throw new Error('Dieser Entwurf ist nicht mehr zur Freigabe offen.');
      const grandPrix = item.races?.grand_prix_name || 'Rennen';
      const confirmed = typeof window.confirmDangerousAction === 'function'
        ? await window.confirmDangerousAction({
            title: `${grandPrix} final veröffentlichen?`,
            details: 'Jetzt werden Steward-Korrekturen, Punkte sowie Fahrer- und Konstrukteurswertung gemeinsam in den offiziellen Stand übernommen.',
            keyword: 'VEROEFFENTLICHEN'
          })
        : window.confirm(`${grandPrix} final veröffentlichen?`);
      if (!confirmed) return;

      const built = await writeOfficial(item);
      await refreshAdminResultSurfaces();
      const modeLabel = built.scoring.ai_replacement_points === 'half'
        ? 'halbe Punkte für zugeordnete KI-Ersatzfahrer'
        : built.scoring.ai_replacement_points === 'none'
          ? 'keine Punkte für zugeordnete KI-Ersatzfahrer'
          : 'volle Punkte für zugeordnete KI-Ersatzfahrer';
      feedback('publish-feedback', `Ergebnis für ${grandPrix} wurde final veröffentlicht. Wertung: ${modeLabel}.`);
    } catch (error) {
      console.error(error);
      feedback('publish-feedback', `Veröffentlichung fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      publishing = false;
    }
  }

  function parsePenaltySeconds(consequence = '') {
    const normalized = String(consequence || '').trim();
    if (!normalized || /^keine$/i.test(normalized)) return 0;
    const match = normalized.replace(',', '.').match(/([+-]?\d+(?:\.\d+)?)\s*(sek|sekunden|s)?/i);
    return match ? Number(match[1]) : 0;
  }

  async function upsertPenalty(caseId, raceId, driverId, title, decision, consequence) {
    const seconds = parsePenaltySeconds(consequence);
    const { data: existing, error: lookupError } = await window.supabaseClient
      .from('race_penalties')
      .select('id')
      .eq('steward_case_id', caseId)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (!driverId || !seconds) {
      if (existing?.id) {
        const { error } = await window.supabaseClient.from('race_penalties').delete().eq('id', existing.id);
        if (error) throw error;
      }
      return;
    }

    const payload = {
      race_id: raceId,
      driver_id: driverId,
      steward_case_id: caseId,
      penalty_type: seconds > 0 ? 'time_penalty' : 'time_credit',
      time_delta_ms: Math.round(seconds * 1000),
      points_delta: 0,
      reason: [title, consequence, decision].filter(Boolean).join(' · ')
    };
    const response = existing?.id
      ? await window.supabaseClient.from('race_penalties').update(payload).eq('id', existing.id)
      : await window.supabaseClient.from('race_penalties').insert([payload]);
    if (response.error) throw response.error;
  }

  async function saveSteward() {
    if (savingSteward) return;
    savingSteward = true;
    clearFeedback('incident-feedback');
    try {
      await requireAdmin();
      const incidentId = trimmed('incident-edit-id');
      const raceId = trimmed('incident-race');
      const driver1 = trimmed('incident-driver-1') || null;
      const driver2 = trimmed('incident-driver-2') || null;
      const title = trimmed('incident-title');
      const description = trimmed('incident-description');
      const decision = trimmed('incident-decision');
      const consequence = String(value('incident-consequence', 'Keine') || 'Keine');
      if (!raceId || !title) throw new Error('Bitte Rennen und Vorfall ausfüllen.');

      const payload = {
        race_id: raceId,
        title,
        description,
        driver_1_id: driver1,
        driver_2_id: driver2,
        decision_text: decision,
        consequence,
        status: 'closed'
      };

      let caseId = incidentId;
      if (incidentId) {
        const { error } = await window.supabaseClient.from('steward_cases').update(payload).eq('id', incidentId);
        if (error) throw error;
      } else {
        const { data, error } = await window.supabaseClient.from('steward_cases').insert([payload]).select('id').single();
        if (error) throw error;
        caseId = data.id;
      }
      await upsertPenalty(caseId, raceId, driver2, title, decision, consequence);

      const pending = await pendingDraftForRace(raceId);
      if (!pending) await rebuildPublishedRace(raceId);
      window.resetStewardIncidentForm?.();
      await refreshAdminResultSurfaces();
      feedback(
        'incident-feedback',
        pending
          ? 'Steward-Fall gespeichert. Die Entscheidung wirkt jetzt auf die Ergebnisvorschau; öffentlich wird sie erst mit „Ergebnis veröffentlichen“. '
          : 'Steward-Fall gespeichert. Das bereits veröffentlichte Rennergebnis wurde mit der Entscheidung neu berechnet.'
      );
    } catch (error) {
      console.error(error);
      feedback('incident-feedback', `Fehler beim Speichern: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      savingSteward = false;
    }
  }

  async function deleteSteward(caseId) {
    if (deletingSteward) return;
    deletingSteward = true;
    clearFeedback('incident-feedback');
    try {
      await requireAdmin();
      const { data: entry, error: entryError } = await window.supabaseClient
        .from('steward_cases')
        .select('id, race_id, title')
        .eq('id', caseId)
        .maybeSingle();
      if (entryError) throw entryError;
      if (!entry) throw new Error('Steward-Fall nicht gefunden.');
      const confirmed = typeof window.confirmDangerousAction === 'function'
        ? await window.confirmDangerousAction({ title: 'Steward-Fall löschen?', details: entry.title || 'Ausgewählter Fall', keyword: 'LOESCHEN' })
        : window.confirm('Steward-Fall löschen?');
      if (!confirmed) return;

      const { error: penaltyError } = await window.supabaseClient.from('race_penalties').delete().eq('steward_case_id', caseId);
      if (penaltyError) throw penaltyError;
      const { error: caseError } = await window.supabaseClient.from('steward_cases').delete().eq('id', caseId);
      if (caseError) throw caseError;

      const pending = entry.race_id ? await pendingDraftForRace(entry.race_id) : null;
      if (entry.race_id && !pending) await rebuildPublishedRace(entry.race_id);
      window.resetStewardIncidentForm?.();
      await refreshAdminResultSurfaces();
      feedback('incident-feedback', pending
        ? 'Steward-Fall gelöscht. Die Entwurfsvorschau wurde aktualisiert; das öffentliche Ergebnis blieb unverändert.'
        : 'Steward-Fall gelöscht und das veröffentlichte Ergebnis neu berechnet.');
    } catch (error) {
      console.error(error);
      feedback('incident-feedback', `Löschen fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      deletingSteward = false;
    }
  }

  async function refreshAdminResultSurfaces() {
    await Promise.allSettled([
      Promise.resolve(window.renderPublishWorkflow?.()),
      Promise.resolve(window.loadStewardCasesForAdmin?.()),
      Promise.resolve(window.loadSeasonSummary?.()),
      Promise.resolve(window.loadRaceOptions?.())
    ]);
    normalizeWorkflowUi();
    updateStewardDraftNotice().catch(() => undefined);
  }

  async function updateStewardDraftNotice() {
    const select = document.getElementById('incident-race');
    if (!select) return;
    let notice = document.getElementById('rcc-steward-draft-context');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'rcc-steward-draft-context';
      notice.className = 'notice section-spacer-top';
      notice.hidden = true;
      const feedbackElement = document.getElementById('incident-feedback');
      feedbackElement?.parentNode?.insertBefore(notice, feedbackElement);
    }
    const raceId = String(select.value || '').trim();
    if (!raceId) {
      notice.hidden = true;
      return;
    }
    const pending = await pendingDraftForRace(raceId);
    notice.hidden = !pending;
    if (pending) notice.textContent = 'Für dieses Rennen liegt ein Ergebnisentwurf vor. Steward-Entscheidungen verändern zunächst nur die Freigabe-Vorschau – nicht das öffentliche Ergebnis.';
  }

  function normalizeWorkflowUi() {
    document.querySelectorAll('.publish-results-btn').forEach((button) => {
      button.textContent = 'Ergebnis veröffentlichen';
    });
    const incidentList = document.getElementById('admin-incident-list');
    const panel = incidentList?.closest('details');
    const notice = panel?.querySelector('.notice');
    if (notice) {
      notice.textContent = 'Bestehende Fälle können hier bearbeitet oder gelöscht werden. Bei offenem Ergebnisentwurf wirken Änderungen zuerst auf die Freigabe-Vorschau; öffentliche Ergebnisse ändern sich erst mit der finalen Veröffentlichung.';
    }
  }

  function ensureRulesField() {
    if (document.getElementById('rule-ai-replacement-points')) return true;
    const rulesPanel = document.getElementById('rule-ai-strength')?.closest('section.panel');
    const grid = rulesPanel?.querySelector('.form-grid');
    if (!grid) return false;
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = `
      <label for="rule-ai-replacement-points">KI-Ersatzfahrer-Wertung</label>
      <select id="rule-ai-replacement-points">
        <option value="full">Volle Punkte</option>
        <option value="half">Halbe Punkte</option>
        <option value="none">Keine Punkte</option>
      </select>
      <span class="muted">Gilt nur, wenn die einem Spieler zugeordnete KI fährt. Reine KI-Fahrer ohne Gamertag erhalten immer 100 %.</span>`;
    grid.appendChild(field);
    const actions = document.getElementById('save-rules-btn')?.closest('.card-actions');
    if (actions && !document.getElementById('rule-ai-replacement-feedback')) {
      const notice = document.createElement('div');
      notice.id = 'rule-ai-replacement-feedback';
      notice.className = 'notice';
      notice.hidden = true;
      actions.insertAdjacentElement('afterend', notice);
    }
    return true;
  }

  async function loadRulesSetting() {
    if (!ensureRulesField()) return;
    try {
      const { scoring } = await fetchLeagueSettings();
      const select = document.getElementById('rule-ai-replacement-points');
      if (select) select.value = scoring.ai_replacement_points;
    } catch (error) {
      console.warn('KI-Ersatzfahrer-Wertung konnte nicht geladen werden.', error);
    }
  }

  async function saveRulesSetting() {
    const select = document.getElementById('rule-ai-replacement-points');
    if (!select) return;
    try {
      await requireAdmin();
      const id = leagueId();
      if (!id) throw new Error('Keine aktive Liga gefunden.');
      const { settings } = await fetchLeagueSettings();
      const nextSettings = {
        ...settings,
        scoring: {
          ...(settings.scoring || {}),
          ai_replacement_points: normalizeMode(select.value)
        }
      };
      const { error } = await window.supabaseClient.from('leagues').update({ settings: nextSettings }).eq('id', id);
      if (error) throw error;
      feedback('rule-ai-replacement-feedback', 'KI-Ersatzfahrer-Wertung gespeichert.');
    } catch (error) {
      feedback('rule-ai-replacement-feedback', `KI-Ersatzfahrer-Wertung konnte nicht gespeichert werden: ${error.message}`, true);
    }
  }

  function interceptActions() {
    if (document.documentElement.dataset.rccResultReleaseBound === 'true') return;
    document.addEventListener('click', (event) => {
      const saveStewardButton = event.target.closest('#save-incident-btn');
      const publishButton = event.target.closest('.publish-results-btn');
      const deleteStewardButton = event.target.closest('.delete-incident-btn');
      if (!saveStewardButton && !publishButton && !deleteStewardButton) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (saveStewardButton) saveSteward();
      else if (publishButton) finalPublish(publishButton.dataset.importId || '', publishButton.dataset.raceId || '');
      else if (deleteStewardButton) deleteSteward(deleteStewardButton.dataset.id || '');
    }, true);

    document.getElementById('incident-race')?.addEventListener('change', () => updateStewardDraftNotice().catch(() => undefined));
    document.getElementById('save-rules-btn')?.addEventListener('click', () => saveRulesSetting());
    window.addEventListener('rcc:result-draft-saved', () => {
      normalizeWorkflowUi();
      updateStewardDraftNotice().catch(() => undefined);
    });
    document.documentElement.dataset.rccResultReleaseBound = 'true';
  }

  function observeWorkflow() {
    const list = document.getElementById('publish-workflow-list');
    if (!list || workflowObserver) return;
    workflowObserver = new MutationObserver(normalizeWorkflowUi);
    workflowObserver.observe(list, { childList: true, subtree: true });
  }

  function init() {
    ensureRulesField();
    interceptActions();
    observeWorkflow();
    normalizeWorkflowUi();
    loadRulesSetting();
    updateStewardDraftNotice().catch(() => undefined);
    return true;
  }

  window.RCCResultRelease = {
    init,
    finalPublish,
    rebuildPublishedRace,
    applyStewardPenalties,
    scoreRows
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
