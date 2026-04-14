const AI_DRIVER_OPTIONS = [
  { team: 'Alpine', driver: 'Pierre Gasly' },
  { team: 'Alpine', driver: 'Franco Colapinto' },
  { team: 'Aston Martin', driver: 'Fernando Alonso' },
  { team: 'Aston Martin', driver: 'Lance Stroll' },
  { team: 'Ferrari', driver: 'Charles Leclerc' },
  { team: 'Ferrari', driver: 'Lewis Hamilton' },
  { team: 'Haas', driver: 'Esteban Ocon' },
  { team: 'Haas', driver: 'Oliver Bearman' },
  { team: 'McLaren', driver: 'Lando Norris' },
  { team: 'McLaren', driver: 'Oscar Piastri' },
  { team: 'Mercedes', driver: 'George Russell' },
  { team: 'Mercedes', driver: 'Andrea Kimi Antonelli' },
  { team: 'Red Bull', driver: 'Max Verstappen' },
  { team: 'Red Bull', driver: 'Yuki Tsunoda' },
  { team: 'Sauber', driver: 'Nico Hulkenberg' },
  { team: 'Sauber', driver: 'Gabriel Bortoleto' },
  { team: 'VCARB', driver: 'Isack Hadjar' },
  { team: 'VCARB', driver: 'Liam Lawson' },
  { team: 'Williams', driver: 'Alexander Albon' },
  { team: 'Williams', driver: 'Carlos Sainz' }
];

const CAR_OPTIONS = ['Alpine', 'Aston Martin', 'Ferrari', 'Haas', 'McLaren', 'Mercedes', 'Red Bull', 'Sauber', 'VCARB', 'Williams'];
const RACE_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  const minutes = index % 2 === 0 ? '00' : '30';
  return `${hours}:${minutes}`;
});

const DEFAULT_RACE_TIME = '20:00';
const DEFAULT_RACE_STATUS = 'upcoming';
const DEFAULT_RACE_WEATHER = 'dynamisch';
const DEFAULT_RACE_DAYS = 'Sonntag';
const RULE_CONFIG_FIELDS = {
  ai_strength: 'rule-ai-strength',
  race_distance: 'rule-race-distance',
  vehicle_performance: 'rule-vehicle-performance',
  fastest_lap_point: 'rule-fastest-lap-point',
  damage: 'rule-damage',
  safety_car: 'rule-safety-car',
  red_flag: 'rule-red-flag',
  ghosting: 'rule-ghosting',
  assists: 'rule-assists',
  qualifying: 'rule-qualifying'
};

const state = {
  isSavingDriver: false,
  isDeletingDriver: false,
  isSavingManualResults: false,
  isPublishing: false,
  isDiscarding: false,
  isImportingResults: false,
  isSavingRace: false,
  isShiftingRaceDates: false,
  isSavingIncident: false,
  isSavingRulesContent: false,
  isStartingSeason: false,
  isGeneratingSeason: false,
  seasonFinalizePreview: null,
  eventsBound: false,
  authListenerBound: false,
  initialized: false
};

function sortByLabel(items, getLabel) {
  return [...items].sort((a, b) => String(getLabel(a) || '').localeCompare(String(getLabel(b) || ''), 'de', { sensitivity: 'base' }));
}

function renderOptions(select, items, mapOption, placeholder = 'Bitte wählen') {
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>` + items.map(mapOption).join('');
}

function showFeedback(id, message, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = false;
  el.style.display = 'block';
  el.textContent = message;
  el.classList.toggle('notice-error', isError);
}

function clearFeedback(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = true;
  el.style.display = 'none';
  el.textContent = '';
  el.classList.remove('notice-error');
}

function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeDriverLookup(value) {
  return String(value ?? '')
    .trim()
    .replace(/Ã¼/g, 'ü')
    .replace(/Ãœ/g, 'Ü')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã„/g, 'Ä')
    .replace(/ÃŸ/g, 'ß')
    .replace(/Ã©/g, 'é')
    .replace(/Ã‰/g, 'É')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildDriverLookupKeys(driver) {
  const keys = new Set();
  const gamertag = String(driver.gamertag || '').trim();
  const aiRef = String(driver.ai_driver_reference || '').trim();
  if (gamertag) keys.add(normalizeDriverLookup(gamertag));
  if (aiRef) keys.add(normalizeDriverLookup(aiRef));
  return [...keys];
}


function getImportPreviewElements() {
  return {
    banner: document.getElementById('csv-conflict-banner'),
    preview: document.getElementById('csv-import-preview')
  };
}

function setImportPreviewBanner(message = '', isError = false, isWarning = false) {
  const { banner } = getImportPreviewElements();
  if (!banner) return;
  if (!message) {
    banner.hidden = true;
    banner.textContent = '';
    banner.classList.remove('notice-error', 'notice-warning');
    return;
  }
  banner.hidden = false;
  banner.textContent = message;
  banner.classList.toggle('notice-error', Boolean(isError));
  banner.classList.toggle('notice-warning', Boolean(isWarning));
}

function renderImportPreviewTable(rows, summary = {}) {
  const { preview } = getImportPreviewElements();
  if (!preview) return;
  if (!rows?.length) {
    preview.innerHTML = '<div class="notice">Lade eine CSV-Datei, um Mapping und Konflikte vor dem Import zu prüfen.</div>';
    return;
  }

  const stats = `Gesamt: ${summary.total || 0} · Gemappt: ${summary.matched || 0} · Konflikte: ${summary.conflicts || 0}`;
  preview.innerHTML = `
    <div class="notice">${window.escapeHtml(stats)}</div>
    <table class="admin-preview-table">
      <thead>
        <tr>
          <th>CSV-Fahrer</th>
          <th>Grand Prix</th>
          <th>Match</th>
          <th>Quelle</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${window.escapeHtml(row.rawDriverName || '—')}</td>
            <td>${window.escapeHtml(row.grandPrixName || '—')}</td>
            <td>${window.escapeHtml(row.matchedLabel || '—')}</td>
            <td>${window.escapeHtml(row.matchSource || '—')}</td>
            <td><span class="preview-badge ${row.statusClass || ''}">${window.escapeHtml(row.statusLabel || 'Unbekannt')}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function buildDriverLookupMap(drivers = []) {
  const map = new Map();
  drivers.forEach((driver) => {
    const gamertagKey = normalizeDriverLookup(driver.gamertag);
    const aiKey = normalizeDriverLookup(driver.ai_driver_reference);
    if (gamertagKey) map.set(gamertagKey, { driver_id: driver.id, participation_status: 'PLAYER', source: 'Gamertag', label: driver.gamertag || driver.display_name || 'Spieler' });
    if (aiKey) map.set(aiKey, { driver_id: driver.id, participation_status: 'BOT', source: 'AI-Fahrer', label: driver.ai_driver_reference || driver.display_name || 'BOT' });
  });
  return map;
}

async function analyzeCsvImport(csvText) {
  const parsedRows = parseCsv(csvText);
  if (!parsedRows.length) {
    renderImportPreviewTable([]);
    setImportPreviewBanner('CSV konnte nicht gelesen werden.', true, false);
    return { ok: false, parsedRows: [], preparedRows: [], grandPrixName: '', missingDrivers: ['CSV konnte nicht gelesen werden.'] };
  }

  const grandPrixName = String(parsedRows[0]['grand prix'] || '').trim();
  const { data: drivers, error: driverError } = await window.supabaseClient.from('drivers').select('id, display_name, ai_driver_reference, gamertag');
  if (driverError) throw driverError;

  const driverMap = buildDriverLookupMap(drivers || []);
  const preparedRows = [];
  const missingDrivers = [];
  const duplicates = new Set();
  const seenNormalized = new Set();
  const previewRows = [];

  for (const row of parsedRows) {
    const rawDriverName = String(row['fahrer'] || '').trim();
    const normalized = normalizeDriverLookup(rawDriverName);
    if (normalized && seenNormalized.has(`${grandPrixName}::${normalized}`)) duplicates.add(rawDriverName);
    seenNormalized.add(`${grandPrixName}::${normalized}`);

    const mapped = driverMap.get(normalized);
    if (!mapped) {
      missingDrivers.push(rawDriverName || '');
      previewRows.push({
        rawDriverName,
        grandPrixName,
        matchedLabel: '',
        matchSource: '',
        statusLabel: 'Kein Match',
        statusClass: 'preview-badge--error'
      });
      continue;
    }

    preparedRows.push({
      driver_id: mapped.driver_id,
      finish_position: Number(row['pos'] || 0) || null,
      grid_position: Number(row['startposition'] || 0) || null,
      pit_stops: Number(row['boxenstopps'] || 0) || 0,
      fastest_lap_time: String(row['schnellste runde'] || '').trim(),
      race_time: String(row['renndauer'] || '').trim(),
      awarded_points: Number(row['punkte'] || 0) || 0,
      participation_status: mapped.participation_status
    });
    previewRows.push({
      rawDriverName,
      grandPrixName,
      matchedLabel: mapped.label,
      matchSource: mapped.source,
      statusLabel: 'Gemappt',
      statusClass: mapped.participation_status === 'BOT' ? 'preview-badge--warning' : 'preview-badge--success'
    });
  }

  const summary = { total: parsedRows.length, matched: preparedRows.length, conflicts: missingDrivers.length + duplicates.size };
  renderImportPreviewTable(previewRows, summary);
  if (missingDrivers.length || duplicates.size) {
    const parts = [];
    if (missingDrivers.length) parts.push(`Nicht gefunden: ${[...new Set(missingDrivers)].join(', ')}`);
    if (duplicates.size) parts.push(`Doppelte CSV-Einträge: ${[...duplicates].join(', ')}`);
    setImportPreviewBanner(parts.join(' · '), false, true);
  } else {
    setImportPreviewBanner('Import-Vorschau erfolgreich. Alle Fahrer wurden sauber gemappt.', false, false);
  }

  return { ok: !missingDrivers.length && !duplicates.size, parsedRows, preparedRows, grandPrixName, missingDrivers, duplicates: [...duplicates] };
}

async function previewCsvFromField(fieldId) {
  clearFeedback('csv-feedback');
  const csvText = getTrimmedValue(fieldId);
  if (!csvText) {
    renderImportPreviewTable([]);
    setImportPreviewBanner('Keine CSV geladen.', false, false);
    return;
  }
  try {
    await analyzeCsvImport(csvText);
  } catch (error) {
    console.error(error);
    setImportPreviewBanner(`Vorschau fehlgeschlagen: ${error.message}`, true, false);
  }
}

async function computeSeasonFinalizePreview() {
  const currentSeason = await window.RCCData.fetchCurrentSeason();
  if (!currentSeason) throw new Error('Keine aktive Saison gefunden.');
  const [drivers, races, raceResults] = await Promise.all([
    window.RCCData.fetchDrivers(),
    window.RCCData.fetchRaces({ seasonId: currentSeason.id }),
    window.RCCData.fetchRaceResults(),
  ]);
  const { driverStandings, teamStandings } = window.RCCData.buildStandings({ drivers, races, raceResults });
  return {
    currentSeason,
    driverChampion: driverStandings[0] || null,
    constructorChampion: teamStandings[0] || null,
    racesCount: races.length
  };
}

function renderSeasonFinalizePreview(preview) {
  const el = document.getElementById('season-finalize-preview');
  if (!el) return;
  if (!preview) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.innerHTML = `
    <strong>Saisonabschluss-Vorschau</strong><br>
    Saison: ${window.escapeHtml(preview.currentSeason.name || 'Aktive Saison')} · Rennen: ${preview.racesCount}<br>
    Fahrer-Weltmeister: ${window.escapeHtml(preview.driverChampion?.driverName || '—')} (${window.escapeHtml(preview.driverChampion?.points ?? 0)} Punkte)<br>
    Konstrukteurs-Weltmeister: ${window.escapeHtml(preview.constructorChampion?.teamName || '—')} (${window.escapeHtml(preview.constructorChampion?.points ?? 0)} Punkte)<br>
    <span class="muted">Mit „Saison final abschließen“ wird diese Saison archiviert und eine neue leere Saison erzeugt.</span>`;
}

function parseGermanWeekdays(input) {
  const mapping = new Map([
    ['mo', 1], ['montag', 1],
    ['di', 2], ['dienstag', 2],
    ['mi', 3], ['mittwoch', 3],
    ['do', 4], ['donnerstag', 4],
    ['fr', 5], ['freitag', 5],
    ['sa', 6], ['samstag', 6],
    ['so', 0], ['sonntag', 0]
  ]);

  const values = String(input || '')
    .split(/[;,/|]+|\bund\b/gi)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => mapping.get(item));

  return [...new Set(values.filter((value) => Number.isInteger(value)))].sort((a, b) => a - b);
}

function getUpcomingDatesForWeekdays(startDate, weekdays, count, raceTime) {
  const [hours, minutes] = String(raceTime || DEFAULT_RACE_TIME).split(':').map((value) => Number(value) || 0);
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const dates = [];
  while (dates.length < count) {
    if (weekdays.includes(cursor.getDay())) {
      const eventDate = new Date(cursor);
      eventDate.setHours(hours, minutes, 0, 0);
      dates.push(eventDate);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function detectDelimiter(headerLine) {
  return (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length ? ';' : ',';
}

function parseCsvLine(line, delimiter) {
  const result = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((header) => String(header || '').replace(/^\uFEFF/, '').trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] ?? '' }), {});
  });
}

function parseTimeStringToMs(value) {
  return window.RCCData?.parseLapTimeToMs ? window.RCCData.parseLapTimeToMs(value) : null;
}

function formatMsToRaceTime(ms) {
  if (!Number.isFinite(ms)) return '';
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = (totalSeconds % 60).toFixed(3).padStart(6, '0');
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

function parsePenaltySeconds(value = '') {
  const normalized = String(value || '').trim();
  if (!normalized || /^keine$/i.test(normalized)) return 0;
  const match = normalized.replace(',', '.').match(/([+-]?\d+(?:\.\d+)?)\s*(sek|sekunden|s)?/i);
  return match ? Number(match[1]) : 0;
}


function toAbsoluteRaceMs(row, leaderMs = null) {
  const parsedMs = parseTimeStringToMs(row?.race_time);
  if (!Number.isFinite(parsedMs)) return null;

  const finishPosition = Number(row?.finish_position || 0);
  if (Number.isFinite(leaderMs) && finishPosition > 1 && parsedMs < leaderMs) {
    return leaderMs + parsedMs;
  }

  return parsedMs;
}

function applyPenaltiesToRows(rows, penalties) {
  const leaderRow = [...rows].sort((a, b) => Number(a.finish_position || 999) - Number(b.finish_position || 999))[0] || null;
  const leaderMs = leaderRow ? parseTimeStringToMs(leaderRow.race_time) : null;

  const adjusted = rows.map((row) => ({
    ...row,
    original_race_time: row.race_time,
    original_position: Number(row.finish_position || 999),
    adjusted_ms: toAbsoluteRaceMs(row, leaderMs),
    penalty_ms: 0
  }));

  const penaltiesByDriver = new Map();
  (penalties || []).forEach((penalty) => {
    const driverId = penalty.driver_id || '';
    const deltaMs = Number(penalty.time_delta_ms || 0);
    if (!driverId || !deltaMs) return;
    penaltiesByDriver.set(driverId, (penaltiesByDriver.get(driverId) || 0) + deltaMs);
  });

  adjusted.forEach((row) => {
    const penaltyMs = penaltiesByDriver.get(row.driver_id) || 0;
    row.penalty_ms = penaltyMs;
    if (Number.isFinite(row.adjusted_ms)) row.adjusted_ms += penaltyMs;
    row.race_time = Number.isFinite(row.adjusted_ms) ? formatMsToRaceTime(row.adjusted_ms) : row.race_time;
  });

  adjusted.sort((a, b) => {
    const aTime = Number.isFinite(a.adjusted_ms) ? a.adjusted_ms : Number.MAX_SAFE_INTEGER;
    const bTime = Number.isFinite(b.adjusted_ms) ? b.adjusted_ms : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return (a.original_position || 999) - (b.original_position || 999);
  });

  adjusted.forEach((row, index) => {
    row.finish_position = index + 1;
  });

  return adjusted;
}


function getPointsForPosition(position) {
  const table = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  return table[position - 1] || 0;
}

function getFastestLapWinnerId(rows) {
  let winnerId = null;
  let bestMs = null;

  rows.forEach((row) => {
    const finishPosition = Number(row.finish_position || 0);
    if (!finishPosition || finishPosition > 10) return;
    const lapMs = parseTimeStringToMs(row.fastest_lap_time);
    if (!Number.isFinite(lapMs)) return;
    if (bestMs === null || lapMs < bestMs) {
      bestMs = lapMs;
      winnerId = row.driver_id;
    }
  });

  return winnerId;
}

async function recalculateOfficialRaceResults(raceId, options = {}) {
  if (!raceId) return;
  const preserveManualPoints = Boolean(options.preserveManualPoints);

  const [{ data: resultRows, error: resultsError }, { data: penaltyRows, error: penaltiesError }, { data: importItem, error: importError }] = await Promise.all([
    window.supabaseClient
      .from('race_results')
      .select('id, race_id, driver_id, finish_position, grid_position, pit_stops, fastest_lap_time, race_time, participation_status, awarded_points')
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
        pit_stops: row.pit_stops ?? official.pit_stops,
        fastest_lap_time: row.fastest_lap_time ?? official.fastest_lap_time,
        race_time: row.race_time ?? official.race_time,
        participation_status: row.participation_status ?? official.participation_status,
        awarded_points: row.awarded_points ?? official.awarded_points
      };
    });

  const adjustedRows = applyPenaltiesToRows(baseRows.map((row) => ({ ...row })), penaltyRows || []);
  const fastestLapWinnerId = getFastestLapWinnerId(adjustedRows);

  const updates = adjustedRows.map((row) => {
    const finishPosition = Number(row.finish_position || 0);
    const basePoints = getPointsForPosition(finishPosition);
    const hasFastestLapBonus = fastestLapWinnerId && row.driver_id === fastestLapWinnerId && finishPosition <= 10;
    const updatePayload = {
      finish_position: finishPosition,
      race_time: row.race_time
    };

    if (!preserveManualPoints) {
      updatePayload.awarded_points = basePoints + (hasFastestLapBonus ? 1 : 0);
    }

    return window.supabaseClient
      .from('race_results')
      .update(updatePayload)
      .eq('id', row.id);
  });

  const responses = await Promise.all(updates);
  const failed = responses.find((response) => response.error);
  if (failed?.error) throw failed.error;
}


function getTrimmedValue(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function getValue(id, fallback = '') {
  return document.getElementById(id)?.value ?? fallback;
}

function emptyToNull(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '';
}

function parseIsoDateToUtcMs(dateString) {
  const normalized = String(dateString || '').trim();
  if (!normalized) return Number.NaN;
  const [year, month, day] = normalized.split('-').map((value) => Number(value));
  if (!year || !month || !day) return Number.NaN;
  return Date.UTC(year, month - 1, day);
}

function addDaysToIsoDate(dateString, dayDelta) {
  const baseMs = parseIsoDateToUtcMs(dateString);
  if (!Number.isFinite(baseMs)) return '';
  const nextDate = new Date(baseMs + (Number(dayDelta) || 0) * 86400000);
  return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDate.getUTCDate()).padStart(2, '0')}`;
}

async function requireAdminSession() {
  const { data, error } = await window.supabaseClient.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('Keine aktive Session. Bitte zuerst einloggen.');
  return data.session;
}

async function populateStewardDriverSelects() {
  const selects = ['incident-driver-1', 'incident-driver-2'];
  const { data, error } = await window.supabaseClient
    .from('drivers')
    .select('id, display_name')
    .order('display_name', { ascending: true });

  if (error) return;

  selects.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    renderOptions(select, data || [], (driver) => `<option value="${driver.id}">${window.escapeHtml(driver.display_name)}</option>`);
  });
}

function populateDriverDropdowns() {
  const aiSelect = document.getElementById('driver-ai-reference');
  const carSelect = document.getElementById('driver-car-name');
  const gpSelect = document.getElementById('race-grand-prix-name');
  const weatherSelect = document.getElementById('race-weather');
  const timeSelect = document.getElementById('race-time');

  renderOptions(
    aiSelect,
    sortByLabel(AI_DRIVER_OPTIONS, (item) => item.driver),
    (item) => `<option value="${item.driver}" data-team="${item.team}">${item.driver} (${item.team})</option>`
  );

  renderOptions(
    carSelect,
    sortByLabel(CAR_OPTIONS, (car) => car),
    (car) => `<option value="${car}">${car}</option>`
  );

  renderOptions(
    gpSelect,
    sortByLabel(window.RCC_TRACKS || [], (track) => track.grandPrixName),
    (track) => `<option value="${track.grandPrixName}" data-circuit="${track.circuitName}">${track.grandPrixName}</option>`
  );

  renderOptions(
    weatherSelect,
    sortByLabel(window.RCC_WEATHER_OPTIONS || [], (weather) => window.formatWeatherLabel(weather)),
    (weather) => `<option value="${weather}" ${weather === DEFAULT_RACE_WEATHER ? 'selected' : ''}>${window.formatWeatherLabel(weather)}</option>`
  );

  if (timeSelect) {
    timeSelect.innerHTML = RACE_TIME_OPTIONS.map((time) => `<option value="${time}" ${time === DEFAULT_RACE_TIME ? 'selected' : ''}>${time} Uhr</option>`).join('');
  }

  setValue('race-status', DEFAULT_RACE_STATUS);
  setValue('race-weather', DEFAULT_RACE_WEATHER);
}

function resetDriverForm() {
  setValue('driver-id', '');
  setValue('driver-display-name', '');
  setValue('driver-gamertag', '');
  setValue('driver-league-team', '');
  setValue('driver-ai-reference', '');
  setValue('driver-car-name', '');
  clearFeedback('driver-feedback');
}

function buildRulesConfigFromForm() {
  return Object.entries(RULE_CONFIG_FIELDS).reduce((config, [key, fieldId]) => {
    config[key] = getTrimmedValue(fieldId);
    return config;
  }, {});
}

function applyRulesConfigToForm(config = {}) {
  Object.entries(RULE_CONFIG_FIELDS).forEach(([key, fieldId]) => {
    setValue(fieldId, String(config[key] || '').trim());
  });
}

async function loadRulesContent() {
  try {
    const content = await window.RCCData.fetchLeagueContent();
    applyRulesConfigToForm(content.rules_config || {});
  } catch (error) {
    console.error(error);
    showFeedback('rules-feedback', `Fehler beim Laden der Regeln: ${error.message}`, true);
  }
}

async function saveRulesContent() {
  if (state.isSavingRulesContent) return;
  state.isSavingRulesContent = true;
  clearFeedback('rules-feedback');

  try {
    await requireAdminSession();

    const payload = {
      id: 'default',
      rules_config: buildRulesConfigFromForm()
    };

    const { error } = await window.supabaseClient
      .from('league_content')
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;

    showFeedback('rules-feedback', 'Regeln wurden gespeichert.');
  } catch (error) {
    console.error(error);
    showFeedback('rules-feedback', `Fehler beim Speichern: ${error.message}`, true);
  } finally {
    state.isSavingRulesContent = false;
  }
}

function editDriver(id, displayName, aiDriverReference, gamertag, leagueTeam, carName) {
  setValue('driver-id', id || '');
  setValue('driver-display-name', displayName || '');
  setValue('driver-ai-reference', aiDriverReference || '');
  setValue('driver-gamertag', gamertag || '');
  setValue('driver-league-team', leagueTeam || '');
  setValue('driver-car-name', carName || '');
  showFeedback('driver-feedback', `Bearbeitungsmodus: ${displayName}`);
}

async function refreshSessionStatus() {
  const statusEl = document.getElementById('admin-session-status');
  if (!statusEl) return;

  const { data, error } = await window.supabaseClient.auth.getSession();
  if (error) {
    statusEl.textContent = `Sessionfehler: ${error.message}`;
    return;
  }

  statusEl.textContent = data.session
    ? `Eingeloggt als ${data.session.user.email}`
    : 'Keine aktive Session';
  updateAdminOverview();
}

async function signInAdmin() {
  clearFeedback('admin-auth-feedback');
  const email = getTrimmedValue('admin-email');
  const password = getValue('admin-password');

  const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return showFeedback('admin-auth-feedback', `Login fehlgeschlagen: ${error.message}`, true);

  showFeedback('admin-auth-feedback', 'Erfolgreich eingeloggt. Session bleibt bestehen.');
  await Promise.all([
    refreshSessionStatus(),
    updateManualResultsVisibility()
  ]);
}

async function signOutAdmin() {
  clearFeedback('admin-auth-feedback');
  const { error } = await window.supabaseClient.auth.signOut();
  if (error) return showFeedback('admin-auth-feedback', `Fehler beim Ausloggen: ${error.message}`, true);

  showFeedback('admin-auth-feedback', 'Erfolgreich ausgeloggt.');
  await Promise.all([
    refreshSessionStatus(),
    updateManualResultsVisibility()
  ]);
}

async function loadDrivers() {
  const list = document.getElementById('driver-list');
  if (!list) return;
  list.innerHTML = '<div class="notice">Fahrer werden geladen...</div>';

  const { data, error } = await window.supabaseClient
    .from('drivers')
    .select('id, display_name, ai_driver_reference, gamertag, league_team, car_name');

  if (error) {
    console.error(error);
    list.innerHTML = '<div class="notice">Fehler beim Laden der Fahrer.</div>';
    return;
  }

  if (!data?.length) {
    list.innerHTML = '<div class="notice">Noch keine Fahrer angelegt.</div>';
    return;
  }

  const groupedByCar = new Map();
  data.forEach((driver) => {
    const teamName = String(driver.league_team || '').trim() || 'Ohne Liga-Team';
    if (!groupedByCar.has(teamName)) groupedByCar.set(teamName, []);
    groupedByCar.get(teamName).push(driver);
  });

  const teamCards = [...groupedByCar.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'de', { sensitivity: 'base' }))
    .map(([teamName, teamDrivers]) => {
      const sortedDrivers = [...teamDrivers].sort((a, b) =>
        String(a.display_name || '').localeCompare(String(b.display_name || ''), 'de', { sensitivity: 'base' }));

      return `
        <article class="list-card driver-team-card">
          <header class="driver-team-card-head">
            <h5>${window.escapeHtml(teamName)}</h5>
            <span class="driver-team-count">${sortedDrivers.length} Fahrer</span>
          </header>
          <div class="driver-team-members">
            ${sortedDrivers.map((driver) => `
              <div class="driver-team-member ${!String(driver.gamertag || '').trim() ? 'is-missing-gamertag' : ''}">
                <div class="driver-team-member-main">
                  <strong>${window.escapeHtml(driver.display_name)}</strong>
                  <span class="muted">AI Fahrer: ${window.escapeHtml(driver.ai_driver_reference || '—')}</span>
                  <span class="muted">Gamertag: ${window.escapeHtml(driver.gamertag || '—')}</span>
                  <span class="muted">Liga-Team: ${window.escapeHtml(driver.league_team || '—')}</span>
                  <span class="muted">Auto: ${window.escapeHtml(driver.car_name || '—')}</span>
                </div>
                <div class="card-actions compact-driver-actions">
                  <button type="button" class="button-secondary edit-driver-btn"
                    data-id="${driver.id}"
                    data-display-name="${escapeHtmlAttr(driver.display_name)}"
                    data-ai-driver-reference="${escapeHtmlAttr(driver.ai_driver_reference)}"
                    data-gamertag="${escapeHtmlAttr(driver.gamertag)}"
                    data-league-team="${escapeHtmlAttr(driver.league_team)}"
                    data-car-name="${escapeHtmlAttr(driver.car_name)}">Bearbeiten</button>
                  <button type="button" class="button-secondary delete-driver-btn"
                    data-id="${driver.id}"
                    data-display-name="${escapeHtmlAttr(driver.display_name)}">Löschen</button>
                </div>
              </div>
            `).join('')}
          </div>
        </article>`;
    });

  list.innerHTML = teamCards.join('');
}

async function saveDriver() {
  if (state.isSavingDriver) return;
  state.isSavingDriver = true;
  clearFeedback('driver-feedback');

  try {
    await requireAdminSession();

    const id = getTrimmedValue('driver-id');
    const displayName = getTrimmedValue('driver-display-name');
    const payload = {
      display_name: displayName,
      ai_driver_reference: emptyToNull(getTrimmedValue('driver-ai-reference')),
      gamertag: emptyToNull(getTrimmedValue('driver-gamertag')),
      league_team: emptyToNull(getTrimmedValue('driver-league-team')),
      car_name: emptyToNull(getTrimmedValue('driver-car-name'))
    };

    if (!displayName) {
      return showFeedback('driver-feedback', 'Bitte mindestens einen Fahrernamen eingeben.', true);
    }

    let response;
    if (id) {
      response = await window.supabaseClient
        .from('drivers')
        .update(payload)
        .eq('id', id)
        .select('id')
        .single();
    } else {
      response = await window.supabaseClient
        .from('drivers')
        .insert([payload])
        .select('id')
        .single();
    }

    if (response.error) {
      throw response.error;
    }

    resetDriverForm();
    showFeedback('driver-feedback', id ? 'Fahrer erfolgreich aktualisiert.' : 'Fahrer erfolgreich gespeichert.');
    await Promise.all([
      loadDrivers(),
      populateStewardDriverSelects()
    ]);
  } catch (error) {
    console.error(error);
    showFeedback('driver-feedback', `Fehler beim Speichern: ${error.message}`, true);
  } finally {
    state.isSavingDriver = false;
  }
}

async function deleteDriver(id, displayName) {
  if (state.isDeletingDriver) return;
  if (!window.confirm(`Möchtest du den Fahrer "${displayName}" wirklich löschen?`)) return;
  state.isDeletingDriver = true;
  clearFeedback('driver-feedback');

  try {
    await requireAdminSession();

    const cleanupSteps = [
      () => window.supabaseClient.from('race_penalties').delete().eq('driver_id', id),
      () => window.supabaseClient.from('race_result_import_rows').delete().eq('driver_id', id),
      () => window.supabaseClient.from('race_results').delete().eq('driver_id', id),
      () => window.supabaseClient.from('driver_season_assignments').delete().eq('driver_id', id),
      () => window.supabaseClient.from('steward_cases').update({ driver_1_id: null }).eq('driver_1_id', id),
      () => window.supabaseClient.from('steward_cases').update({ driver_2_id: null }).eq('driver_2_id', id)
    ];

    for (const runStep of cleanupSteps) {
      const { error } = await runStep();
      if (error && !/relation .* does not exist/i.test(error.message || '')) {
        throw error;
      }
    }

    const { error } = await window.supabaseClient.from('drivers').delete().eq('id', id);
    if (error) throw error;

    resetDriverForm();
    showFeedback('driver-feedback', `Fahrer "${displayName}" wurde gelöscht.`);
    await Promise.all([
      loadDrivers(),
      populateStewardDriverSelects()
    ]);
  } catch (error) {
    console.error(error);
    showFeedback('driver-feedback', `Fehler beim Löschen: ${error.message}`, true);
  } finally {
    state.isDeletingDriver = false;
  }
}

async function getCurrentSeasonSafe() {
  try {
    return await window.RCCData.fetchCurrentSeason();
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function loadSeasonSummary() {
  const el = document.getElementById('season-summary');
  if (!el) return;

  try {
    const season = await getCurrentSeasonSafe();
    if (!season) {
      el.innerHTML = 'Keine aktive Saison gefunden. Bitte SQL-Migration ausführen.';
      return;
    }

    const races = await window.RCCData.fetchRaces({ seasonId: season.id });
    el.innerHTML = `<strong>Aktive Saison:</strong> ${window.escapeHtml(season.name || `Saison ${season.id}`)}<br><strong>Rennen:</strong> ${races.length}<br><strong>Status:</strong> ${window.escapeHtml(season.status || 'active')}`;
    updateAdminOverview();
  } catch (error) {
    console.error(error);
    el.textContent = 'Saisonübersicht konnte nicht geladen werden.';
  }
}

async function loadRaceOptions() {
  const select = document.getElementById('incident-race');
  if (!select) return;

  const season = await getCurrentSeasonSafe();
  let query = window.supabaseClient
    .from('races')
    .select('id, round_number, grand_prix_name, race_date, status')
    .order('round_number', { ascending: true });

  if (season?.id) query = query.eq('season_id', season.id);
  const { data, error } = await query;

  if (error) {
    console.error(error);
    select.innerHTML = '<option value="">Rennen konnten nicht geladen werden</option>';
    return;
  }

  const sortedRaces = sortByLabel(data || [], (race) => race.grand_prix_name);
  select.innerHTML = sortedRaces.length
    ? '<option value="">Bitte Rennen wählen</option>' + sortedRaces.map((race) => `<option value="${race.id}">${race.grand_prix_name} · R${race.round_number} · ${race.status}</option>`).join('')
    : '<option value="">Noch keine Rennen vorhanden</option>';

  const manualSelect = document.getElementById('manual-race-select');
  if (manualSelect) {
    manualSelect.innerHTML = '<option value="">Rennen wählen</option>' + sortedRaces.map((race) => `<option value="${race.id}">${race.grand_prix_name} · R${race.round_number}</option>`).join('');
  }

  const raceShiftSelect = document.getElementById('race-shift-source');
  if (raceShiftSelect) {
    const roundSortedRaces = [...(data || [])].sort((a, b) => Number(a.round_number || 0) - Number(b.round_number || 0));
    raceShiftSelect.innerHTML = roundSortedRaces.length
      ? '<option value="">Bitte Rennen wählen</option>' + roundSortedRaces.map((race) => `<option value="${race.id}" data-race-date="${race.race_date || ''}" data-round="${race.round_number || ''}">R${race.round_number} · ${race.grand_prix_name} · ${race.race_date || 'kein Datum'}</option>`).join('')
      : '<option value="">Noch keine Rennen vorhanden</option>';
  }

  await renderPublishWorkflow();
}

async function saveRace() {
  if (state.isSavingRace) return;
  state.isSavingRace = true;
  clearFeedback('race-feedback');

  try {
    await requireAdminSession();
    const season = await getCurrentSeasonSafe();
    const grandPrixName = getTrimmedValue('race-grand-prix-name');
    const circuitName = getTrimmedValue('race-circuit-name');
    const raceDate = getValue('race-date');
    const raceTime = getValue('race-time', DEFAULT_RACE_TIME) || DEFAULT_RACE_TIME;
    const status = getValue('race-status', DEFAULT_RACE_STATUS) || DEFAULT_RACE_STATUS;
    const weather = getTrimmedValue('race-weather') || DEFAULT_RACE_WEATHER;
    const notes = getTrimmedValue('race-notes');

    if (!grandPrixName || !raceDate) {
      return showFeedback('race-feedback', 'Bitte Grand Prix und Renndatum ausfüllen.', true);
    }

    let roundQuery = window.supabaseClient.from('races').select('round_number').order('round_number', { ascending: false }).limit(1);
    if (season?.id) roundQuery = roundQuery.eq('season_id', season.id);

    const { data: existingRaces, error: roundError } = await roundQuery;
    if (roundError) {
      return showFeedback('race-feedback', `Fehler beim Ermitteln der Rundennummer: ${roundError.message}`, true);
    }

    const nextRoundNumber = existingRaces?.length ? Number(existingRaces[0].round_number || 0) + 1 : 1;
    const payload = {
      season_id: season?.id || null,
      round_number: nextRoundNumber,
      grand_prix_name: grandPrixName,
      circuit_name: circuitName,
      race_date: raceDate,
      race_time: raceTime,
      status,
      weather,
      notes
    };

    const { error } = await window.supabaseClient.from('races').insert([payload]);
    if (error) {
      return showFeedback('race-feedback', `Fehler beim Speichern: ${error.message}`, true);
    }

    ['race-grand-prix-name', 'race-circuit-name', 'race-date', 'race-notes'].forEach((id) => setValue(id, ''));
    setValue('race-time', DEFAULT_RACE_TIME);
    setValue('race-status', DEFAULT_RACE_STATUS);
    setValue('race-weather', DEFAULT_RACE_WEATHER);

    showFeedback('race-feedback', `Rennen gespeichert (Runde ${nextRoundNumber}).`);
    await Promise.all([
      loadRaceOptions(),
      loadSeasonSummary()
    ]);
  } catch (error) {
    console.error(error);
    showFeedback('race-feedback', `Fehler beim Speichern: ${error.message}`, true);
  } finally {
    state.isSavingRace = false;
  }
}

async function shiftRaceDates() {
  if (state.isShiftingRaceDates) return;
  state.isShiftingRaceDates = true;
  clearFeedback('race-shift-feedback');

  try {
    await requireAdminSession();
    const sourceRaceId = getValue('race-shift-source');
    const newRaceDate = getValue('race-shift-date');
    if (!sourceRaceId || !newRaceDate) {
      return showFeedback('race-shift-feedback', 'Bitte ein Rennen und das neue Renndatum auswählen.', true);
    }

    const season = await getCurrentSeasonSafe();
    let query = window.supabaseClient
      .from('races')
      .select('id, round_number, grand_prix_name, race_date')
      .order('round_number', { ascending: true });
    if (season?.id) query = query.eq('season_id', season.id);

    const { data: races, error } = await query;
    if (error) {
      return showFeedback('race-shift-feedback', `Rennen konnten nicht geladen werden: ${error.message}`, true);
    }

    const selectedRace = (races || []).find((race) => String(race.id) === String(sourceRaceId));
    if (!selectedRace?.race_date) {
      return showFeedback('race-shift-feedback', 'Das gewählte Rennen hat kein gültiges Renndatum.', true);
    }

    const oldDateMs = parseIsoDateToUtcMs(selectedRace.race_date);
    const newDateMs = parseIsoDateToUtcMs(newRaceDate);
    if (!Number.isFinite(oldDateMs) || !Number.isFinite(newDateMs)) {
      return showFeedback('race-shift-feedback', 'Ungültiges Datum. Bitte erneut versuchen.', true);
    }

    const dayDelta = Math.round((newDateMs - oldDateMs) / 86400000);
    if (!dayDelta) {
      return showFeedback('race-shift-feedback', 'Neues Datum entspricht dem bestehenden Renndatum. Keine Änderung nötig.');
    }

    const affectedRaces = (races || []).filter((race) => Number(race.round_number || 0) >= Number(selectedRace.round_number || 0));
    if (!affectedRaces.length) {
      return showFeedback('race-shift-feedback', 'Es wurden keine Folge-Rennen zum Verschieben gefunden.', true);
    }

    const updateResults = await Promise.all(
      affectedRaces.map((race) => window.supabaseClient
        .from('races')
        .update({ race_date: addDaysToIsoDate(race.race_date, dayDelta) })
        .eq('id', race.id))
    );

    const failedUpdate = updateResults.find((result) => result.error);
    if (failedUpdate?.error) {
      return showFeedback('race-shift-feedback', `Fehler beim Verschieben: ${failedUpdate.error.message}`, true);
    }

    showFeedback(
      'race-shift-feedback',
      `${selectedRace.grand_prix_name} und ${Math.max(affectedRaces.length - 1, 0)} Folge-Rennen wurden um ${dayDelta} ${Math.abs(dayDelta) === 1 ? 'Tag' : 'Tage'} verschoben.`
    );
    setValue('race-shift-date', '');
    await Promise.all([
      loadRaceOptions(),
      loadSeasonSummary()
    ]);
  } catch (error) {
    console.error(error);
    showFeedback('race-shift-feedback', `Fehler beim Verschieben: ${error.message}`, true);
  } finally {
    state.isShiftingRaceDates = false;
  }
}

async function saveStewardIncident() {
  if (state.isSavingIncident) return;
  state.isSavingIncident = true;
  clearFeedback('incident-feedback');

  try {
    await requireAdminSession();
    const raceId = getValue('incident-race');
    const driver1Id = getValue('incident-driver-1') || null;
    const driver2Id = getValue('incident-driver-2') || null;
    const decision = getTrimmedValue('incident-decision');
    const consequence = getValue('incident-consequence', 'Keine') || 'Keine';
    const title = getTrimmedValue('incident-title');
    const description = getTrimmedValue('incident-description');

    if (!raceId || !title) {
      return showFeedback('incident-feedback', 'Bitte Rennen und Vorfall ausfüllen.', true);
    }

    const casePayload = {
      race_id: raceId,
      title,
      description,
      driver_1_id: driver1Id,
      driver_2_id: driver2Id,
      decision_text: decision,
      consequence,
      status: 'closed'
    };

    const { data: createdCase, error: caseError } = await window.supabaseClient
      .from('steward_cases')
      .insert([casePayload])
      .select('id')
      .single();

    if (caseError) {
      return showFeedback('incident-feedback', `Fehler beim Speichern: ${caseError.message}`, true);
    }

    const seconds = parsePenaltySeconds(consequence);
    if (driver2Id && seconds) {
      const { error: penaltyError } = await window.supabaseClient.from('race_penalties').insert([{
        race_id: raceId,
        driver_id: driver2Id,
        steward_case_id: createdCase.id,
        penalty_type: seconds > 0 ? 'time_penalty' : 'time_credit',
        time_delta_ms: Math.round(seconds * 1000),
        reason: [title, consequence, decision].filter(Boolean).join(' · ')
      }]);

      if (penaltyError) {
        return showFeedback('incident-feedback', `Fall gespeichert, Strafe aber nicht: ${penaltyError.message}`, true);
      }
    }

    await recalculateOfficialRaceResults(raceId);

    ['incident-race', 'incident-title', 'incident-description', 'incident-decision', 'incident-driver-1', 'incident-driver-2'].forEach((id) => setValue(id, ''));
    setValue('incident-consequence', 'Keine');
    showFeedback('incident-feedback', driver2Id && seconds
      ? 'Steward-Eintrag erfolgreich gespeichert. Die Zeitkorrektur wurde direkt auf das offizielle Rennergebnis angewendet.'
      : 'Steward-Eintrag erfolgreich gespeichert. Ergebnisse und Wertungen wurden aktualisiert.');
    await Promise.all([
      renderPublishWorkflow(),
      loadSeasonSummary(),
      loadRaceOptions()
    ]);
  } catch (error) {
    console.error(error);
    showFeedback('incident-feedback', `Fehler beim Speichern: ${error.message}`, true);
  } finally {
    state.isSavingIncident = false;
  }
}

async function fetchPendingImportsFromDb() {
  const { data: imports, error } = await window.supabaseClient
    .from('race_result_imports')
    .select(`
      id,
      race_id,
      status,
      imported_at,
      published_at,
      races:race_id ( grand_prix_name, weather ),
      race_result_import_rows (
        id,
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
    .in('status', ['draft', 'under_review'])
    .order('imported_at', { ascending: false });

  if (error) throw error;
  return imports || [];
}

async function renderPublishWorkflow() {
  const list = document.getElementById('publish-workflow-list');
  if (!list) return;
  list.innerHTML = '<div class="notice">Import-Entwürfe werden geladen...</div>';

  try {
    const [pending, driversResponse, penaltiesResponse] = await Promise.all([
      fetchPendingImportsFromDb(),
      window.supabaseClient.from('drivers').select('id, display_name'),
      window.supabaseClient.from('race_penalties').select('race_id, driver_id, time_delta_ms')
    ]);

    if (penaltiesResponse.error) throw penaltiesResponse.error;

    const driversById = new Map((driversResponse.data || []).map((driver) => [driver.id, driver.display_name]));
    const penaltiesByRace = (penaltiesResponse.data || []).reduce((map, penalty) => {
      if (!map.has(penalty.race_id)) map.set(penalty.race_id, []);
      map.get(penalty.race_id).push(penalty);
      return map;
    }, new Map());

    if (!pending.length) {
      list.innerHTML = '<div class="notice">Keine ausstehenden Ergebnisimporte vorhanden.</div>';
      updateAdminOverview();
      return;
    }

    list.innerHTML = pending.map((item) => {
      const rawRows = (item.race_result_import_rows || []).map((row) => ({ ...row }));
      const adjustedRows = applyPenaltiesToRows(rawRows, penaltiesByRace.get(item.race_id) || []);
      const previewRows = adjustedRows.slice(0, 8).map((row) => {
        const penaltySeconds = Number(row.penalty_ms || 0) / 1000;
        const penaltyLabel = penaltySeconds
          ? ` <span class="muted">(${penaltySeconds > 0 ? '+' : ''}${penaltySeconds}s)</span>`
          : '';
        return `<li>${row.finish_position}. ${window.escapeHtml(driversById.get(row.driver_id) || 'Unbekannt')} · ${window.escapeHtml(row.race_time || '—')}${penaltyLabel}</li>`;
      }).join('');
      const grandPrix = item.races?.grand_prix_name || `Rennen ${item.race_id}`;
      const weather = item.races?.weather || DEFAULT_RACE_WEATHER;
      const racePenalties = penaltiesByRace.get(item.race_id) || [];
      return `
        <div class="workflow-card">
          <div class="card-title-row">
            <div>
              <div class="card-label">${item.status === 'under_review' ? 'In Prüfung' : 'Entwurf'}</div>
              <h4 style="margin:0;">${window.escapeHtml(grandPrix)}</h4>
            </div>
            <div class="card-actions">
              <button type="button" class="button-primary publish-results-btn" data-import-id="${item.id}" data-race-id="${item.race_id}">Jetzt veröffentlichen</button>
              <button type="button" class="button-secondary discard-results-btn" data-import-id="${item.id}" data-race-id="${item.race_id}">Entwurf löschen</button>
            </div>
          </div>
          <div class="workflow-grid">
            <div>
              <strong>Importiert:</strong> ${item.imported_at ? new Date(item.imported_at).toLocaleString('de-DE') : '—'}<br>
              <strong>Status:</strong> ${item.status === 'under_review' ? 'Steward-Prüfung läuft' : 'Wartet auf Steward-Prüfung'}<br>
              <strong>Wetter:</strong> ${window.escapeHtml(window.formatWeatherLabel(weather || ''))}<br>
              <strong>Zeitkorrekturen:</strong> ${racePenalties.length}
            </div>
            <div>
              <strong>Vorschau (bereits mit Steward-Korrekturen)</strong>
              <ol class="workflow-list">${previewRows || '<li>Noch keine Zeilen vorhanden.</li>'}</ol>
            </div>
          </div>
        </div>
      `;
    }).join('');
    updateAdminOverview();
  } catch (error) {
    console.error(error);
    list.innerHTML = `<div class="notice notice-error">Workflow konnte nicht geladen werden: ${window.escapeHtml(error.message || 'Unbekannter Fehler')}</div>`;
  }
}

async function publishPendingResults(importId, raceId) {
  if (state.isPublishing) return;
  state.isPublishing = true;
  clearFeedback('publish-feedback');

  try {
    await requireAdminSession();

    const [{ data: importItem, error: importError }, { data: penalties, error: penaltiesError }] = await Promise.all([
      window.supabaseClient
        .from('race_result_imports')
        .select(`
          id,
          race_id,
          status,
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
            participation_status
          )
        `)
        .eq('id', importId)
        .maybeSingle(),
      window.supabaseClient
        .from('race_penalties')
        .select('id, driver_id, time_delta_ms, reason, steward_case_id')
        .eq('race_id', raceId)
    ]);

    if (importError || !importItem) return showFeedback('publish-feedback', 'Kein Entwurf für dieses Rennen gefunden.', true);
    if (penaltiesError) return showFeedback('publish-feedback', 'Steward-Strafen konnten nicht geladen werden.', true);

    const rows = (importItem.race_result_import_rows || []).map((row) => ({ ...row }));
    const adjustedRows = applyPenaltiesToRows(rows, penalties || []);
    const cleanedRows = adjustedRows
      .filter((row) => row.driver_id)
      .map((row) => ({
        race_id: raceId,
        driver_id: row.driver_id,
        finish_position: row.finish_position,
        grid_position: row.grid_position,
        pit_stops: row.pit_stops,
        fastest_lap_time: row.fastest_lap_time,
        race_time: row.race_time,
        awarded_points: row.awarded_points,
        participation_status: row.participation_status
      }));

    const duplicateDriverIds = cleanedRows.reduce((map, row) => {
      map.set(row.driver_id, (map.get(row.driver_id) || 0) + 1);
      return map;
    }, new Map());

    const deduplicatedRows = [];
    const seenDriverIds = new Set();
    cleanedRows.forEach((row) => {
      if (seenDriverIds.has(row.driver_id)) return;
      seenDriverIds.add(row.driver_id);
      deduplicatedRows.push(row);
    });

    const duplicateCount = [...duplicateDriverIds.values()].filter((count) => count > 1).length;

    const { error: deleteError } = await window.supabaseClient.from('race_results').delete().eq('race_id', raceId);
    if (deleteError) return showFeedback('publish-feedback', `Vorhandene Ergebnisse konnten nicht gelöscht werden: ${deleteError.message}`, true);

    const { error: insertError } = await window.supabaseClient
      .from('race_results')
      .upsert(deduplicatedRows, { onConflict: 'race_id,driver_id' });
    if (insertError) return showFeedback('publish-feedback', `Finale Ergebnisse konnten nicht gespeichert werden: ${insertError.message}`, true);

    await recalculateOfficialRaceResults(raceId);

    const [{ error: statusUpdateError }, { error: importUpdateError }] = await Promise.all([
      window.supabaseClient.from('races').update({ status: 'completed' }).eq('id', raceId),
      window.supabaseClient.from('race_result_imports').update({
        status: 'published',
        published_at: new Date().toISOString()
      }).eq('id', importId)
    ]);

    if (statusUpdateError) return showFeedback('publish-feedback', `Ergebnisse veröffentlicht, aber Rennstatus nicht aktualisiert: ${statusUpdateError.message}`, true);
    if (importUpdateError) return showFeedback('publish-feedback', `Ergebnisse veröffentlicht, aber Importstatus nicht aktualisiert: ${importUpdateError.message}`, true);

    await renderPublishWorkflow();
    const duplicateInfo = duplicateCount
      ? ` ${duplicateCount} doppelte Fahrerzuordnung${duplicateCount === 1 ? ' wurde' : 'en wurden'} beim Veröffentlichen automatisch bereinigt.`
      : '';
    showFeedback('publish-feedback', `Ergebnisse für ${importItem.races?.grand_prix_name || 'das Rennen'} wurden veröffentlicht und Steward-Strafen berücksichtigt.${duplicateInfo}`);
  } catch (error) {
    console.error(error);
    showFeedback('publish-feedback', `Fehler beim Veröffentlichen: ${error.message}`, true);
  } finally {
    state.isPublishing = false;
  }
}

async function discardPendingResults(importId) {
  if (state.isDiscarding) return;
  state.isDiscarding = true;
  clearFeedback('publish-feedback');

  try {
    await requireAdminSession();

    const { data: item } = await window.supabaseClient
      .from('race_result_imports')
      .select('id, races:race_id ( grand_prix_name )')
      .eq('id', importId)
      .maybeSingle();

    if (!item) return;
    if (!window.confirm(`Entwurf für ${item.races?.grand_prix_name || 'dieses Rennen'} wirklich löschen?`)) return;

    const [{ error: rowsError }, { error: importError }] = await Promise.all([
      window.supabaseClient.from('race_result_import_rows').delete().eq('import_id', importId),
      window.supabaseClient.from('race_result_imports').delete().eq('id', importId)
    ]);

    if (rowsError || importError) {
      return showFeedback('publish-feedback', `Entwurf konnte nicht gelöscht werden: ${(rowsError || importError).message}`, true);
    }

    await renderPublishWorkflow();
    showFeedback('publish-feedback', 'Entwurf wurde gelöscht.');
  } catch (error) {
    console.error(error);
    showFeedback('publish-feedback', `Entwurf konnte nicht gelöscht werden: ${error.message}`, true);
  } finally {
    state.isDiscarding = false;
  }
}

async function createRandomSeason() {
  if (state.isGeneratingSeason) return;
  state.isGeneratingSeason = true;
  clearFeedback('race-feedback');

  try {
    await requireAdminSession();
    const season = await getCurrentSeasonSafe();
    const weatherChoice = window.prompt('Wetter für die komplette Saison wählen (z. B. dynamisch, klar, regen):', DEFAULT_RACE_WEATHER);
    if (weatherChoice === null) return;
    const chosenWeather = weatherChoice.trim().toLowerCase() || DEFAULT_RACE_WEATHER;

    const raceDaysInput = window.prompt('An welchen Tagen wird gefahren? Beispiele: Sonntag oder Mittwoch,Sonntag', DEFAULT_RACE_DAYS);
    if (raceDaysInput === null) return;
    const selectedWeekdays = parseGermanWeekdays(raceDaysInput);
    if (!selectedWeekdays.length) {
      return showFeedback('race-feedback', 'Die Fahrtage konnten nicht erkannt werden. Bitte z. B. "Sonntag" oder "Mittwoch,Sonntag" eingeben.', true);
    }

    const raceTimeInput = window.prompt('Wann ist Rennstart? Format HH:MM', getValue('race-time', DEFAULT_RACE_TIME) || DEFAULT_RACE_TIME);
    if (raceTimeInput === null) return;
    const normalizedRaceTime = /^\d{2}:\d{2}$/.test(raceTimeInput.trim()) ? raceTimeInput.trim() : DEFAULT_RACE_TIME;

    const seasonTracks = [...(window.RCC_TRACKS || [])].sort(() => Math.random() - 0.5);
    const selectedTracks = seasonTracks.slice(0, 24);
    if (!selectedTracks.length) return showFeedback('race-feedback', 'Keine Strecken verfügbar.', true);

    const inputDate = getValue('race-date');
    let baseDate = inputDate ? new Date(`${inputDate}T00:00:00`) : new Date();
    if (Number.isNaN(baseDate.getTime())) baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    const seasonDates = getUpcomingDatesForWeekdays(baseDate, selectedWeekdays, selectedTracks.length, normalizedRaceTime);
    const insertRows = selectedTracks.map((track, index) => ({
      season_id: season?.id || null,
      round_number: index + 1,
      grand_prix_name: track.grandPrixName,
      circuit_name: track.circuitName,
      race_date: seasonDates[index].toISOString().slice(0, 10),
      race_time: normalizedRaceTime,
      status: DEFAULT_RACE_STATUS,
      weather: chosenWeather,
      notes: `Zufällig erzeugter Saisonkalender · Fahrtage: ${raceDaysInput} · Rennstart: ${normalizedRaceTime}`
    }));

    const { error } = await window.supabaseClient.from('races').insert(insertRows);
    if (error) return showFeedback('race-feedback', `Saison konnte nicht erstellt werden: ${error.message}`, true);

    setValue('race-time', normalizedRaceTime);
    showFeedback('race-feedback', `Komplette Saison mit ${insertRows.length} Rennen wurde erstellt. Wetter: ${chosenWeather}. Fahrtage: ${raceDaysInput}. Rennstart: ${normalizedRaceTime}.`);

    await Promise.all([
      loadRaceOptions(),
      loadSeasonSummary()
    ]);
  } catch (error) {
    console.error(error);
    showFeedback('race-feedback', `Saison konnte nicht erstellt werden: ${error.message}`, true);
  } finally {
    state.isGeneratingSeason = false;
  }
}

async function importRaceResults(options = {}) {
  if (state.isImportingResults) return;
  state.isImportingResults = true;
  clearFeedback('csv-feedback');

  try {
    await requireAdminSession();

    const previewFieldId = options.previewFieldId || 'csv-preview';
    const csvText = getTrimmedValue(previewFieldId);
    if (!csvText) return showFeedback('csv-feedback', 'Bitte zuerst eine CSV-Datei laden.', true);

    const analysis = await analyzeCsvImport(csvText);
    if (!analysis.ok) {
      return showFeedback('csv-feedback', 'Import blockiert: Bitte zuerst die Konflikte in der Vorschau beheben.', true);
    }

    const parsedRows = analysis.parsedRows;
    const preparedRows = analysis.preparedRows;
    const grandPrixName = analysis.grandPrixName;
    if (!grandPrixName) return showFeedback('csv-feedback', 'Spalte "Grand Prix" fehlt oder ist leer.', true);

    const currentSeason = await getCurrentSeasonSafe();
    let raceQuery = window.supabaseClient.from('races').select('id, grand_prix_name, season_id, weather').eq('grand_prix_name', grandPrixName);
    if (currentSeason?.id) raceQuery = raceQuery.eq('season_id', currentSeason.id);

    const { data: raceData, error: raceError } = await raceQuery.maybeSingle();
    if (raceError || !raceData) return showFeedback('csv-feedback', `Rennen "${grandPrixName}" wurde in der aktiven Saison nicht gefunden.`, true);

    const { data: existingImport } = await window.supabaseClient
      .from('race_result_imports')
      .select('id')
      .eq('race_id', raceData.id)
      .maybeSingle();

    let importId = existingImport?.id || null;
    if (importId) {
      const [{ error: deleteRowsError }, { error: updateImportError }] = await Promise.all([
        window.supabaseClient.from('race_result_import_rows').delete().eq('import_id', importId),
        window.supabaseClient.from('race_result_imports').update({
          status: 'under_review',
          imported_at: new Date().toISOString(),
          published_at: null
        }).eq('id', importId)
      ]);

      if (deleteRowsError || updateImportError) {
        return showFeedback('csv-feedback', `Vorhandener Entwurf konnte nicht überschrieben werden: ${(deleteRowsError || updateImportError).message}`, true);
      }
    } else {
      const { data: createdImport, error: createImportError } = await window.supabaseClient
        .from('race_result_imports')
        .insert([{
          race_id: raceData.id,
          status: 'under_review',
          imported_at: new Date().toISOString()
        }])
        .select('id')
        .single();

      if (createImportError) return showFeedback('csv-feedback', `Import konnte nicht angelegt werden: ${createImportError.message}`, true);
      importId = createdImport.id;
    }

    const rowsPayload = preparedRows.map((row) => ({ import_id: importId, ...row }));
    const { error: insertRowsError } = await window.supabaseClient.from('race_result_import_rows').insert(rowsPayload);
    if (insertRowsError) return showFeedback('csv-feedback', `Importzeilen konnten nicht gespeichert werden: ${insertRowsError.message}`, true);

    await window.supabaseClient.from('races').update({ status: 'upcoming' }).eq('id', raceData.id);
    await renderPublishWorkflow();
    showFeedback('csv-feedback', `Ergebnisse für "${grandPrixName}" wurden als Prüfstand importiert. Steward-Fälle können jetzt direkt auf die Freigabe-Vorschau wirken.`);
  } catch (error) {
    console.error(error);
    showFeedback('csv-feedback', `Fehler beim Import: ${error.message}`, true);
  } finally {
    state.isImportingResults = false;
  }
}

async function prepareSeasonFinalize() {
  clearFeedback('season-feedback');
  try {
    await requireAdminSession();
    const preview = await computeSeasonFinalizePreview();
    state.seasonFinalizePreview = preview;
    renderSeasonFinalizePreview(preview);
    showFeedback('season-feedback', 'Saisonabschluss geprüft. Bitte Vorschau prüfen und danach final abschließen.');
  } catch (error) {
    console.error(error);
    renderSeasonFinalizePreview(null);
    showFeedback('season-feedback', error.message || 'Saisonabschluss konnte nicht vorbereitet werden.', true);
  }
}

async function startNewSeason() {
  if (state.isStartingSeason) return;
  state.isStartingSeason = true;
  clearFeedback('season-feedback');

  try {
    await requireAdminSession();
    const preview = state.seasonFinalizePreview || await computeSeasonFinalizePreview();
    const currentSeason = preview.currentSeason;
    if (!currentSeason) throw new Error('Keine aktive Saison gefunden. Bitte SQL-Migration zuerst ausführen.');

    const confirmed = window.confirm(`Saison ${currentSeason.name || ''} wirklich final abschließen?

Fahrer-Weltmeister: ${preview.driverChampion?.driverName || '—'}
Konstrukteurs-Weltmeister: ${preview.constructorChampion?.teamName || '—'}

Danach wird automatisch eine neue Saison angelegt.`);
    if (!confirmed) {
      return;
    }

    const driverChampion = preview.driverChampion?.driverName || null;
    const constructorChampion = preview.constructorChampion?.teamName || null;

    const historyPayload = {
      season_id: currentSeason.id,
      driver_champion: driverChampion,
      constructor_champion: constructorChampion
    };

    const historyResponse = await window.supabaseClient.from('championship_history').upsert([historyPayload], { onConflict: 'season_id' });
    if (historyResponse.error) throw historyResponse.error;

    const updateResponse = await window.supabaseClient.from('seasons').update({ is_active: false }).eq('id', currentSeason.id);
    if (updateResponse.error) throw updateResponse.error;

    const nextSeasonNumber = Number(String(currentSeason.name || '').match(/(\d+)/)?.[1] || currentSeason.id || 0) + 1;
    const createResponse = await window.supabaseClient
      .from('seasons')
      .insert([{ name: `Saison ${nextSeasonNumber}`, is_active: true }])
      .select()
      .single();

    if (createResponse.error) throw createResponse.error;

    setValue('csv-preview', '');
    setValue('csv-preview-2', '');
    setValue('csv-file', '');
    setValue('csv-file-2', '');
    ['race-grand-prix-name', 'race-circuit-name', 'race-date', 'race-notes'].forEach((id) => setValue(id, ''));
    setValue('race-time', DEFAULT_RACE_TIME);
    setValue('race-status', DEFAULT_RACE_STATUS);
    setValue('race-weather', DEFAULT_RACE_WEATHER);

    clearFeedback('race-feedback');
    clearFeedback('csv-feedback');
    clearFeedback('incident-feedback');

    state.seasonFinalizePreview = null;
    renderSeasonFinalizePreview(null);
    showFeedback('season-feedback', `Neue Saison gestartet. ${currentSeason.name} archiviert (${driverChampion || 'kein Fahrer'} / ${constructorChampion || 'kein Team'}). Der Rennkalender der neuen Saison ist jetzt leer.`);
    await Promise.all([
      loadSeasonSummary(),
      loadRaceOptions(),
      populateManualRaceSelect(),
      renderPublishWorkflow()
    ]);
  } catch (error) {
    console.error(error);
    showFeedback('season-feedback', error.message || 'Neue Saison konnte nicht gestartet werden.', true);
  } finally {
    state.isStartingSeason = false;
  }
}

async function updateManualResultsVisibility() {
  const statusEl = document.getElementById('manual-results-status');
  const panelEl = document.getElementById('manual-results-panel');
  const { data } = await window.supabaseClient.auth.getSession();
  const loggedIn = Boolean(data.session);
  if (panelEl) panelEl.classList.toggle('hidden', !loggedIn);
  if (statusEl) {
    statusEl.textContent = loggedIn
      ? `Manuelle Ergebnisbearbeitung aktiv für ${data.session.user.email}`
      : 'Nur nach erfolgreichem Login sichtbar und nutzbar.';
  }
}

async function populateManualRaceSelect() {
  const select = document.getElementById('manual-race-select');
  if (!select) return;

  const currentSeason = await getCurrentSeasonSafe();
  let query = window.supabaseClient
    .from('races')
    .select('id, grand_prix_name, round_number')
    .order('round_number', { ascending: true });

  if (currentSeason?.id) query = query.eq('season_id', currentSeason.id);
  const { data, error } = await query;
  if (error) return;

  const sortedRaces = sortByLabel(data || [], (race) => race.grand_prix_name);
  select.innerHTML = '<option value="">Rennen wählen</option>' + sortedRaces.map((race) => `<option value="${race.id}">${race.grand_prix_name} · R${race.round_number}</option>`).join('');
}

async function loadManualResultsEditor() {
  clearFeedback('manual-results-feedback');
  const raceId = document.getElementById('manual-race-select')?.value;
  const wrap = document.getElementById('manual-results-wrap');
  if (!raceId || !wrap) return;

  const [{ data: rows, error: rowsError }, { data: drivers, error: driversError }] = await Promise.all([
    window.supabaseClient
      .from('race_results')
      .select('id, driver_id, finish_position, grid_position, fastest_lap_time, race_time, participation_status, awarded_points')
      .eq('race_id', raceId)
      .order('finish_position', { ascending: true }),
    window.supabaseClient
      .from('drivers')
      .select('id, display_name')
      .order('display_name', { ascending: true })
  ]);

  if (rowsError || driversError) {
    return showFeedback('manual-results-feedback', 'Ergebnisse konnten nicht geladen werden.', true);
  }

  const driverMap = new Map((drivers || []).map((driver) => [driver.id, driver.display_name]));
  wrap.innerHTML = `
    <table class="manual-results-table">
      <thead>
        <tr><th>Fahrer</th><th>Pos</th><th>Grid</th><th>Schnellste Runde</th><th>Gesamtzeit</th><th>Punkte</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${(rows || []).map((row) => `
          <tr>
            <td>${window.escapeHtml(driverMap.get(row.driver_id) || 'Unbekannt')}</td>
            <td><input class="manual-results-input" inputmode="numeric" data-field="finish_position" data-id="${row.id}" data-driver-id="${row.driver_id}" value="${row.finish_position ?? ''}"></td>
            <td><input class="manual-results-input" inputmode="numeric" data-field="grid_position" data-id="${row.id}" data-driver-id="${row.driver_id}" value="${row.grid_position ?? ''}"></td>
            <td><input class="manual-results-input manual-results-time" data-field="fastest_lap_time" data-id="${row.id}" data-driver-id="${row.driver_id}" value="${row.fastest_lap_time ?? ''}"></td>
            <td><input class="manual-results-input manual-results-time" data-field="race_time" data-id="${row.id}" data-driver-id="${row.driver_id}" value="${row.race_time ?? ''}"></td>
            <td><input class="manual-results-input" inputmode="numeric" data-field="awarded_points" data-id="${row.id}" data-driver-id="${row.driver_id}" value="${row.awarded_points ?? ''}"></td>
            <td>
              <select class="manual-results-select" data-field="participation_status" data-id="${row.id}" data-driver-id="${row.driver_id}">
                <option value="BOT" ${String(row.participation_status).toUpperCase() === 'BOT' ? 'selected' : ''}>BOT</option>
                <option value="PLAYER" ${String(row.participation_status).toUpperCase() === 'PLAYER' ? 'selected' : ''}>PLAYER</option>
              </select>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  setManualResultsDirty(false);
}

async function saveManualResults() {
  if (state.isSavingManualResults) return;
  state.isSavingManualResults = true;
  setManualResultsDirty(state.manualResultsDirty);
  clearFeedback('manual-results-feedback');

  try {
    await requireAdminSession();
    const inputs = [...document.querySelectorAll('#manual-results-wrap [data-id][data-field]')];
    const updates = new Map();

    inputs.forEach((input) => {
      const id = input.dataset.id;
      if (!updates.has(id)) updates.set(id, { id });
      updates.get(id)[input.dataset.field] = input.value;
      if (input.dataset.driverId) updates.get(id).driver_id = input.dataset.driverId;
    });

    const payloads = [...updates.values()].map((entry) => {
      const fastestLapTime = entry.fastest_lap_time || null;
      const raceTime = entry.race_time || null;
      return {
        id: entry.id,
        payload: {
          finish_position: entry.finish_position ? Number(entry.finish_position) : null,
          grid_position: entry.grid_position ? Number(entry.grid_position) : null,
          fastest_lap_time: fastestLapTime,
          fastest_lap_time_ms: parseTimeStringToMs(fastestLapTime),
          race_time: raceTime,
          race_time_ms: parseTimeStringToMs(raceTime),
          awarded_points: entry.awarded_points ? Number(entry.awarded_points) : 0,
          participation_status: entry.participation_status || 'PLAYER'
        }
      };
    });

    const results = await Promise.all(payloads.map((entry) => window.supabaseClient.from('race_results').update(entry.payload).eq('id', entry.id)));
    const failed = results.find((result) => result.error);
    if (failed?.error) return showFeedback('manual-results-feedback', `Fehler beim Speichern: ${failed.error.message}`, true);

    const manualRaceId = document.getElementById('manual-race-select')?.value || null;
    if (manualRaceId) {
      const { data: manualImport } = await window.supabaseClient
        .from('race_result_imports')
        .select('id')
        .eq('race_id', manualRaceId)
        .order('imported_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (manualImport?.id) {
        const existingImportRowsResponse = await window.supabaseClient
          .from('race_result_import_rows')
          .select('id, driver_id')
          .eq('import_id', manualImport.id);
        const existingImportRows = existingImportRowsResponse.data || [];
        const importRowsByDriver = new Map(existingImportRows.map((row) => [row.driver_id, row.id]));

        const importUpdates = payloads
          .filter((entry) => importRowsByDriver.has(updates.get(entry.id)?.driver_id))
          .map((entry) => {
            const driverId = updates.get(entry.id)?.driver_id;
            return window.supabaseClient
              .from('race_result_import_rows')
              .update({
                finish_position: entry.payload.finish_position,
                grid_position: entry.payload.grid_position,
                fastest_lap_time: entry.payload.fastest_lap_time,
                race_time: entry.payload.race_time,
                awarded_points: entry.payload.awarded_points,
                participation_status: entry.payload.participation_status
              })
              .eq('id', importRowsByDriver.get(driverId));
          });

        if (importUpdates.length) {
          const importResults = await Promise.all(importUpdates);
          const failedImportUpdate = importResults.find((result) => result.error);
          if (failedImportUpdate?.error) return showFeedback('manual-results-feedback', `Import-Basis konnte nicht aktualisiert werden: ${failedImportUpdate.error.message}`, true);
        }
      }

      await recalculateOfficialRaceResults(manualRaceId, { preserveManualPoints: true });
    }

    showFeedback(
      'manual-results-feedback',
      'Rennergebnisse gespeichert. Platzierungen und Rennzeiten wurden aktualisiert; manuelle Punkte wurden beibehalten.'
    );
    await loadManualResultsEditor();
  } catch (error) {
    console.error(error);
    showFeedback('manual-results-feedback', `Fehler beim Speichern: ${error.message}`, true);
  } finally {
    state.isSavingManualResults = false;
    setManualResultsDirty(state.manualResultsDirty);
  }
}


function setManualResultsDirty(isDirty = true) {
  state.manualResultsDirty = Boolean(isDirty);
  const feedback = document.getElementById('manual-results-feedback');
  if (feedback && !feedback.hidden && !feedback.dataset.error && state.manualResultsDirty) {
    feedback.hidden = true;
  }

  ['save-manual-results-btn', 'save-manual-results-btn-bottom'].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.disabled = state.isSavingManualResults;
    button.textContent = state.isSavingManualResults ? 'Speichert …' : (state.manualResultsDirty ? 'Änderungen speichern *' : 'Änderungen speichern');
  });
}



function setAdminOverviewValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function updateAdminOverview() {
  try {
    const [season, pendingResponse, sessionResponse] = await Promise.all([
      getCurrentSeasonSafe(),
      window.supabaseClient.from('race_result_imports').select('id', { count: 'exact', head: true }).in('status', ['draft', 'under_review']),
      window.supabaseClient.auth.getSession()
    ]);

    if (season) {
      setAdminOverviewValue('admin-overview-season', `Saison ${season.name || '—'}`);
      try {
        const races = await window.RCCData.fetchRaces({ seasonId: season.id });
        setAdminOverviewValue('admin-overview-races', `${races.length} Rennen im Kalender`);
      } catch (_) {
        setAdminOverviewValue('admin-overview-races', 'Kalender konnte nicht geladen werden');
      }
    } else {
      setAdminOverviewValue('admin-overview-season', 'Keine aktive Saison');
      setAdminOverviewValue('admin-overview-races', 'Bitte Saison prüfen');
    }

    const pendingCount = Number(pendingResponse.count || 0);
    setAdminOverviewValue('admin-overview-imports', `${pendingCount} ${pendingCount === 1 ? 'Entwurf' : 'Entwürfe'}`);
    setAdminOverviewValue('admin-overview-imports-sub', pendingCount ? 'Importe warten auf Freigabe' : 'Kein offener Import im Workflow');

    const session = sessionResponse?.data?.session || null;
    setAdminOverviewValue('admin-overview-session', session ? 'Admin aktiv' : 'Nicht eingeloggt');
    setAdminOverviewValue('admin-overview-session-sub', session?.user?.email || 'Bitte Admin-Login prüfen');
  } catch (error) {
    console.error(error);
  }
}

function getPanelTone(titleText = '') {
  const title = String(titleText || '').toLowerCase();
  if (title.includes('saison')) return 'Workflow';
  if (title.includes('csv') || title.includes('import')) return 'Import';
  if (title.includes('steward')) return 'Stewarding';
  if (title.includes('manuell')) return 'Editor';
  if (title.includes('fahrer')) return 'Roster';
  if (title.includes('rennen')) return 'Kalender';
  return 'Admin';
}

function toggleAdminPanel(panel, shouldCollapse = null) {
  if (!panel) return;
  const collapsed = shouldCollapse === null ? !panel.classList.contains('collapsed') : shouldCollapse;
  panel.classList.toggle('collapsed', collapsed);
  const button = panel.querySelector('.panel-collapse-toggle');
  if (button) {
    button.setAttribute('aria-expanded', String(!collapsed));
    button.textContent = collapsed ? '+ Öffnen' : '− Offen';
  }
}

function enableAdminCollapsibles() {
  const sections = [...document.querySelectorAll('.admin-layout > .panel')];
  sections.forEach((panel) => {
    if (panel.tagName === 'DETAILS') return;
    if (panel.dataset.collapsibleReady === 'true') return;
    const title = panel.querySelector('h3');
    if (!title) return;

    const headerRow = document.createElement('div');
    headerRow.className = 'panel-header-row';
    title.parentNode.insertBefore(headerRow, title);

    const titleWrap = document.createElement('div');
    const eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = getPanelTone(title.textContent || '');
    titleWrap.appendChild(eyebrow);
    titleWrap.appendChild(title);
    headerRow.appendChild(titleWrap);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'button-secondary panel-collapse-toggle';
    toggle.textContent = '− Offen';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.addEventListener('click', () => toggleAdminPanel(panel));
    headerRow.appendChild(toggle);

    panel.dataset.collapsibleReady = 'true';
  });
}

function bindUiEvents() {
  if (state.eventsBound) return;
  state.eventsBound = true;

  document.getElementById('admin-login-btn')?.addEventListener('click', signInAdmin);
  document.getElementById('admin-logout-btn')?.addEventListener('click', signOutAdmin);
  document.getElementById('save-race-btn')?.addEventListener('click', saveRace);
  document.getElementById('shift-race-btn')?.addEventListener('click', shiftRaceDates);
  document.getElementById('save-driver-btn')?.addEventListener('click', saveDriver);
  document.getElementById('reset-driver-btn')?.addEventListener('click', resetDriverForm);
  document.getElementById('save-incident-btn')?.addEventListener('click', saveStewardIncident);
  document.getElementById('import-results-btn')?.addEventListener('click', () => importRaceResults({ previewFieldId: 'csv-preview' }));
  document.getElementById('import-results-btn-2')?.addEventListener('click', () => importRaceResults({ previewFieldId: 'csv-preview-2' }));
  document.getElementById('prepare-season-finalize-btn')?.addEventListener('click', prepareSeasonFinalize);
  document.getElementById('start-new-season-btn')?.addEventListener('click', startNewSeason);
  document.getElementById('generate-season-btn')?.addEventListener('click', createRandomSeason);
  document.getElementById('save-rules-btn')?.addEventListener('click', saveRulesContent);
  document.getElementById('load-manual-results-btn')?.addEventListener('click', loadManualResultsEditor);
  const manualSaveBtn = document.getElementById('save-manual-results-btn');
  manualSaveBtn?.addEventListener('click', saveManualResults);
  document.getElementById('save-manual-results-btn-bottom')?.addEventListener('click', saveManualResults);
  document.getElementById('load-manual-results-btn-bottom')?.addEventListener('click', loadManualResultsEditor);
  document.getElementById('manual-results-panel')?.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 's') {
      event.preventDefault();
      saveManualResults();
    }
  });

  document.getElementById('manual-results-wrap')?.addEventListener('input', (event) => {
    if (event.target.closest('[data-id][data-field]')) setManualResultsDirty(true);
  });

  document.getElementById('manual-results-wrap')?.addEventListener('change', (event) => {
    if (event.target.closest('[data-id][data-field]')) setManualResultsDirty(true);
  });

  document.getElementById('csv-file')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setValue('csv-preview', await file.text());
    previewCsvFromField('csv-preview');
  });

  document.getElementById('csv-file-2')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setValue('csv-preview-2', await file.text());
    previewCsvFromField('csv-preview-2');
  });

  document.getElementById('driver-ai-reference')?.addEventListener('change', (event) => {
    const selectedOption = event.target.options[event.target.selectedIndex];
    const team = selectedOption?.dataset?.team || '';
    const carField = document.getElementById('driver-car-name');
    if (carField && team && !carField.value) carField.value = team;
  });

  document.getElementById('race-grand-prix-name')?.addEventListener('change', (event) => {
    const selectedOption = event.target.options[event.target.selectedIndex];
    setValue('race-circuit-name', selectedOption?.dataset?.circuit || '');
  });

  document.getElementById('race-shift-source')?.addEventListener('change', (event) => {
    const selectedOption = event.target.options[event.target.selectedIndex];
    setValue('race-shift-date', selectedOption?.dataset?.raceDate || '');
  });

  document.addEventListener('click', (event) => {
    const editBtn = event.target.closest('.edit-driver-btn');
    if (editBtn) {
      editDriver(
        editBtn.dataset.id || '',
        editBtn.dataset.displayName || '',
        editBtn.dataset.aiDriverReference || '',
        editBtn.dataset.gamertag || '',
        editBtn.dataset.leagueTeam || '',
        editBtn.dataset.carName || ''
      );
      return;
    }

    const deleteBtn = event.target.closest('.delete-driver-btn');
    if (deleteBtn) {
      deleteDriver(deleteBtn.dataset.id || '', deleteBtn.dataset.displayName || '');
      return;
    }

    const publishBtn = event.target.closest('.publish-results-btn');
    if (publishBtn) {
      publishPendingResults(publishBtn.dataset.importId || '', publishBtn.dataset.raceId || '');
      return;
    }

    const discardBtn = event.target.closest('.discard-results-btn');
    if (discardBtn) {
      discardPendingResults(discardBtn.dataset.importId || '');
    }
  });
}

function bindAuthListener() {
  if (state.authListenerBound) return;
  state.authListenerBound = true;

  window.supabaseClient.auth.onAuthStateChange(() => {
    refreshSessionStatus();
    updateManualResultsVisibility();
  });
}

async function initAdminPage() {
  if (state.initialized) return;
  state.initialized = true;

  populateDriverDropdowns();
  enableAdminCollapsibles();
  bindUiEvents();
  bindAuthListener();

  await Promise.all([
    populateStewardDriverSelects(),
    refreshSessionStatus(),
    loadSeasonSummary(),
    loadDrivers(),
    loadRaceOptions(),
    renderPublishWorkflow(),
    updateManualResultsVisibility(),
    populateManualRaceSelect(),
    updateAdminOverview(),
    loadRulesContent()
  ]);
  renderImportPreviewTable([]);
  setImportPreviewBanner('');
  renderSeasonFinalizePreview(null);
}


document.addEventListener('DOMContentLoaded', initAdminPage);
