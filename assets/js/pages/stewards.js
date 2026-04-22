let stewardSessionActive = false;
let cachedCases = [];
let cachedDrivers = [];

function setStewardFeedback(message, isError = false) {
  const el = document.getElementById('steward-edit-feedback');
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle('notice-error', isError);
}

function resetStewardForm() {
  document.getElementById('steward-edit-id').value = '';
  document.getElementById('steward-edit-title').value = '';
  document.getElementById('steward-edit-race').value = '';
  document.getElementById('steward-edit-description').value = '';
  document.getElementById('steward-edit-decision').value = '';
  document.getElementById('steward-edit-consequence').value = 'Keine';
  document.getElementById('steward-edit-driver-1').value = '';
  document.getElementById('steward-edit-driver-2').value = '';
  const el = document.getElementById('steward-edit-feedback');
  if (el) el.hidden = true;
}

function parsePenaltySeconds(value = '') {
  const normalized = String(value || '').trim();
  if (!normalized || /^keine$/i.test(normalized)) return 0;
  const match = normalized.replace(',', '.').match(/([+-]?\d+(?:\.\d+)?)\s*(sek|sekunden|s)?/i);
  return match ? Number(match[1]) : 0;
}


function toAbsoluteRaceMs(row, leaderMs = null) {
  const parsedMs = parseRaceTimeToMs(row?.race_time);
  if (!Number.isFinite(parsedMs)) return null;

  const finishPosition = Number(row?.finish_position || 0);
  if (Number.isFinite(leaderMs) && finishPosition > 1 && parsedMs < leaderMs) {
    return leaderMs + parsedMs;
  }

  return parsedMs;
}


function parseRaceTimeToMs(value) {
  if (window.RCCData?.parseLapTimeToMs) return window.RCCData.parseLapTimeToMs(value);
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const text = raw.replace(',', '.');
  const parts = text.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000);
  if (parts.length === 2) return Math.round((parts[0] * 60 + parts[1]) * 1000);
  if (parts.length === 1) return Math.round(parts[0] * 1000);
  return null;
}

function formatRaceTimeFromMs(ms) {
  if (!Number.isFinite(ms)) return '';
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = (totalSeconds % 60).toFixed(3).padStart(6, '0');
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

function getPointsForPosition(position) {
  const table = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  return table[position - 1] || 0;
}

function getFastestLapWinnerId(rows) {
  let winnerId = null;
  let bestMs = null;

  rows.forEach((row) => {
    const lapMs = parseRaceTimeToMs(row.fastest_lap_time);
    if (!Number.isFinite(lapMs)) return;
    if (bestMs === null || lapMs < bestMs) {
      bestMs = lapMs;
      winnerId = row.driver_id;
    }
  });

  return winnerId;
}

async function recalculateOfficialRaceResults(raceId) {
  if (!raceId) return;

  const [{ data: resultRows, error: resultsError }, { data: penaltyRows, error: penaltiesError }, { data: importItem, error: importError }] = await Promise.all([
    window.supabaseClient
      .from('race_results')
      .select('id, race_id, driver_id, finish_position, grid_position, fastest_lap_time, race_time, participation_status, awarded_points')
      .eq('race_id', raceId),
    window.supabaseClient
      .from('race_penalties')
      .select('driver_id, time_delta_ms')
      .eq('race_id', raceId),
    window.supabaseClient
      .from('race_result_imports')
      .select(`
        id,
        race_result_import_rows (
          driver_id,
          finish_position,
          grid_position,
          pit_stops,
          fastest_lap_time,
          race_time,
          awarded_points,
          participation_status
        )
      `)
      .eq('race_id', raceId)
      .order('imported_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (resultsError) throw resultsError;
  if (penaltiesError) throw penaltiesError;
  if (importError && importError.code !== 'PGRST116') throw importError;
  if (!resultRows?.length) return;

  const officialRowsByDriver = new Map((resultRows || []).map((row) => [row.driver_id, row]));
  const importRows = (importItem?.race_result_import_rows || []).filter((row) => row.driver_id);
  const baseSourceRows = importRows.length ? importRows : resultRows;

  const baseRows = baseSourceRows
    .filter((row) => officialRowsByDriver.has(row.driver_id))
    .map((row) => {
      const official = officialRowsByDriver.get(row.driver_id);
      return {
        ...official,
        driver_id: row.driver_id,
        finish_position: row.finish_position ?? official.finish_position,
        grid_position: row.grid_position ?? official.grid_position,
        fastest_lap_time: row.fastest_lap_time ?? official.fastest_lap_time,
        race_time: row.race_time ?? official.race_time,
        participation_status: row.participation_status ?? official.participation_status,
        awarded_points: row.awarded_points ?? official.awarded_points
      };
    });

  const penaltiesByDriver = new Map();
  (penaltyRows || []).forEach((penalty) => {
    const driverId = penalty.driver_id || '';
    const deltaMs = Number(penalty.time_delta_ms || 0);
    if (!driverId || !deltaMs) return;
    penaltiesByDriver.set(driverId, (penaltiesByDriver.get(driverId) || 0) + deltaMs);
  });

  const leaderRow = [...baseRows].sort((a, b) => Number(a.finish_position || 999) - Number(b.finish_position || 999))[0] || null;
  const leaderMs = leaderRow ? parseRaceTimeToMs(leaderRow.race_time) : null;

  const adjustedRows = baseRows.map((row) => {
    const originalMs = toAbsoluteRaceMs(row, leaderMs);
    const deltaMs = penaltiesByDriver.get(row.driver_id) || 0;
    const adjustedMs = Number.isFinite(originalMs) ? originalMs + deltaMs : null;
    return {
      ...row,
      originalMs,
      adjustedMs,
      penaltyMs: deltaMs,
      originalPosition: Number(row.finish_position || 999)
    };
  });

  adjustedRows.sort((a, b) => {
    const aHasTime = Number.isFinite(a.adjustedMs);
    const bHasTime = Number.isFinite(b.adjustedMs);
    if (aHasTime && bHasTime && a.adjustedMs !== b.adjustedMs) return a.adjustedMs - b.adjustedMs;
    if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
    return (a.originalPosition || 999) - (b.originalPosition || 999);
  });

  adjustedRows.forEach((row, index) => {
    row.finish_position = index + 1;
    row.race_time = Number.isFinite(row.adjustedMs) ? formatRaceTimeFromMs(row.adjustedMs) : row.race_time;
  });

  const fastestLapWinnerId = getFastestLapWinnerId(adjustedRows);

  const updates = adjustedRows.map((row) => {
    const finishPosition = Number(row.finish_position || 0);
    const basePoints = getPointsForPosition(finishPosition);
    const hasFastestLapBonus = fastestLapWinnerId && row.driver_id === fastestLapWinnerId && finishPosition <= 10;
    return window.supabaseClient
      .from('race_results')
      .update({
        finish_position: finishPosition,
        race_time: row.race_time,
        awarded_points: basePoints + (hasFastestLapBonus ? 1 : 0)
      })
      .eq('id', row.id);
  });

  const responses = await Promise.all(updates);
  const failed = responses.find((response) => response.error);
  if (failed?.error) throw failed.error;
}


async function loadStewardDrivers() {
  const { data, error } = await window.supabaseClient.from('drivers').select('id, display_name').order('display_name', { ascending: true });
  if (error) return;
  cachedDrivers = data || [];
  ['steward-edit-driver-1', 'steward-edit-driver-2'].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">Bitte wählen</option>' + cachedDrivers.map((driver) => `<option value="${driver.id}">${window.escapeHtml(driver.display_name)}</option>`).join('');
  });
}

async function refreshStewardSession() {
  const statusEl = document.getElementById('steward-admin-status');
  const { data, error } = await window.supabaseClient.auth.getSession();
  if (error) {
    stewardSessionActive = false;
    statusEl.textContent = `Sessionfehler: ${error.message}`;
    return;
  }
  stewardSessionActive = Boolean(data.session);
  statusEl.textContent = stewardSessionActive ? `Admin aktiv: ${data.session.user.email}` : 'Nur mit aktivem Admin-Login verfügbar.';
}

function fillStewardForm(entry) {
  document.getElementById('steward-edit-id').value = entry.id;
  document.getElementById('steward-edit-title').value = entry.title || '';
  document.getElementById('steward-edit-race').value = entry.races?.grand_prix_name || '';
  document.getElementById('steward-edit-description').value = entry.description || '';
  document.getElementById('steward-edit-decision').value = entry.decision_text || '';
  document.getElementById('steward-edit-consequence').value = entry.consequence || '';
  document.getElementById('steward-edit-driver-1').value = entry.driver_1_id || '';
  document.getElementById('steward-edit-driver-2').value = entry.driver_2_id || '';
}

function renderStewardCases(list) {
  if (!list) return;

  if (!cachedCases.length) {
    list.innerHTML = 'Noch kein Eintrag vorhanden';
    return;
  }

  list.innerHTML = cachedCases.map((entry) => {
    const involved = [entry.driver1?.display_name && `Fahrer 1: ${entry.driver1.display_name}`, entry.driver2?.display_name && `Fahrer 2: ${entry.driver2.display_name}`].filter(Boolean).join(' · ');
    return `
      <article class="incident-item steward-case-card">
        <strong class="steward-case-title">${entry.races?.grand_prix_name || 'Rennen'} · ${window.escapeHtml(entry.title || '')}</strong>
        <span class="muted steward-case-description">${window.escapeHtml(entry.description || '')}</span>
        <span class="muted steward-case-meta">${window.escapeHtml(involved || 'Keine Fahrer hinterlegt')}</span>
        <span class="muted steward-case-meta"><strong>Entscheidung:</strong> ${window.escapeHtml(entry.decision_text || '—')}</span>
        <span class="muted steward-case-meta"><strong>Konsequenz:</strong> ${window.escapeHtml(entry.consequence || 'Keine')}</span>
        ${stewardSessionActive ? `<div class="card-actions"><button class="btn edit-steward-btn" data-id="${entry.id}">Bearbeiten</button><button class="btn delete-steward-btn" data-id="${entry.id}">Löschen</button></div>` : ''}
      </article>
    `;
  }).join('');
}

async function loadStewardCases() {
  const list = document.getElementById('incident-list');
  list.innerHTML = 'Lade Stewards...';

  const { data, error } = await window.supabaseClient
    .from('steward_cases')
    .select(`
      id,
      race_id,
      title,
      description,
      decision_text,
      consequence,
      driver_1_id,
      driver_2_id,
      races:race_id ( grand_prix_name ),
      driver1:driver_1_id ( display_name ),
      driver2:driver_2_id ( display_name )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    const relationMissing = error.code === 'PGRST205' || error.code === '42P01';
    list.innerHTML = relationMissing ? 'Steward-Datenbank noch nicht eingerichtet' : 'Fehler beim Laden';
    return;
  }

  cachedCases = data || [];
  renderStewardCases(list);
}

async function upsertPenaltyForCase(entryId, raceId, driver2Id, title, decision, consequence) {
  const seconds = parsePenaltySeconds(consequence);
  const { data: existingPenalty } = await window.supabaseClient
    .from('race_penalties')
    .select('id')
    .eq('steward_case_id', entryId)
    .maybeSingle();

  if (!driver2Id || !seconds) {
    if (existingPenalty?.id) {
      await window.supabaseClient.from('race_penalties').delete().eq('id', existingPenalty.id);
    }
    return;
  }

  const payload = {
    race_id: raceId,
    driver_id: driver2Id,
    steward_case_id: entryId,
    penalty_type: seconds > 0 ? 'time_penalty' : 'time_credit',
    time_delta_ms: Math.round(seconds * 1000),
    reason: [title, consequence, decision].filter(Boolean).join(' · ')
  };

  if (existingPenalty?.id) {
    await window.supabaseClient.from('race_penalties').update(payload).eq('id', existingPenalty.id);
  } else {
    await window.supabaseClient.from('race_penalties').insert([payload]);
  }
}

async function saveStewardEdit() {
  if (!stewardSessionActive) return setStewardFeedback('Bitte zuerst als Admin einloggen.', true);
  const id = document.getElementById('steward-edit-id').value;
  if (!id) return setStewardFeedback('Bitte zuerst einen Eintrag auswählen.', true);

  const payload = {
    title: document.getElementById('steward-edit-title').value.trim(),
    description: document.getElementById('steward-edit-description').value.trim(),
    decision_text: document.getElementById('steward-edit-decision').value.trim(),
    consequence: document.getElementById('steward-edit-consequence').value.trim(),
    driver_1_id: document.getElementById('steward-edit-driver-1').value || null,
    driver_2_id: document.getElementById('steward-edit-driver-2').value || null
  };

  const entry = cachedCases.find((item) => item.id === id);
  if (!entry?.race_id) return setStewardFeedback('Der Steward-Fall ist keinem Rennen zugeordnet.', true);

  const saveButton = document.getElementById('save-steward-edit-btn');
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = 'Speichert...';
  }

  try {
    const { error } = await window.supabaseClient.from('steward_cases').update(payload).eq('id', id);
    if (error) throw error;

    await upsertPenaltyForCase(id, entry.race_id, payload.driver_2_id, payload.title, payload.decision_text, payload.consequence);
    await recalculateOfficialRaceResults(entry.race_id);
    setStewardFeedback('Steward-Entscheidung gespeichert und Rennergebnis neu berechnet.');
    await loadStewardCases();
  } catch (error) {
    console.error(error);
    setStewardFeedback(error.message || 'Speichern fehlgeschlagen.', true);
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = 'Änderungen speichern';
    }
  }
}

async function deleteStewardEntry(id) {
  if (!stewardSessionActive) return setStewardFeedback('Bitte zuerst als Admin einloggen.', true);
  if (!window.confirm('Diesen Steward-Eintrag wirklich löschen?')) return;
  const entry = cachedCases.find((item) => item.id === id);

  try {
    const { error: penaltyDeleteError } = await window.supabaseClient.from('race_penalties').delete().eq('steward_case_id', id);
    if (penaltyDeleteError) throw penaltyDeleteError;
    const { error } = await window.supabaseClient.from('steward_cases').delete().eq('id', id);
    if (error) throw error;
    if (entry?.race_id) await recalculateOfficialRaceResults(entry.race_id);
    resetStewardForm();
    setStewardFeedback('Steward-Entscheidung gelöscht und Rennergebnis neu berechnet.');
    await loadStewardCases();
  } catch (error) {
    console.error(error);
    setStewardFeedback(error.message || 'Löschen fehlgeschlagen.', true);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadStewardDrivers();
  await refreshStewardSession();
  await loadStewardCases();

  document.getElementById('save-steward-edit-btn')?.addEventListener('click', saveStewardEdit);
  document.getElementById('reset-steward-edit-btn')?.addEventListener('click', resetStewardForm);

  document.addEventListener('click', (event) => {
    const editBtn = event.target.closest('.edit-steward-btn');
    if (editBtn) {
      const entry = cachedCases.find((item) => item.id === editBtn.dataset.id);
      if (entry) fillStewardForm(entry);
    }
    const deleteBtn = event.target.closest('.delete-steward-btn');
    if (deleteBtn) deleteStewardEntry(deleteBtn.dataset.id);
  });

  window.supabaseClient.auth.onAuthStateChange(async () => {
    await refreshStewardSession();
    await loadStewardCases();
  });
});
