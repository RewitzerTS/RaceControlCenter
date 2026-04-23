const SEASON_GAME_CONFIGS = {
  f1_25: {
    label: 'F1 25',
    aiDrivers: [
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
    ],
    teams: ['Alpine', 'Aston Martin', 'Ferrari', 'Haas', 'McLaren', 'Mercedes', 'Red Bull', 'Sauber', 'VCARB', 'Williams']
  },
  f1_26: {
    label: 'F1 26',
    aiDrivers: [
      { team: 'Red Bull Racing', driver: 'Max Verstappen' },
      { team: 'Red Bull Racing', driver: 'Isack Hadjar' },
      { team: 'Mercedes', driver: 'George Russell' },
      { team: 'Mercedes', driver: 'Andrea Kimi Antonelli' },
      { team: 'Ferrari', driver: 'Lewis Hamilton' },
      { team: 'Ferrari', driver: 'Charles Leclerc' },
      { team: 'McLaren', driver: 'Lando Norris' },
      { team: 'McLaren', driver: 'Oscar Piastri' },
      { team: 'Aston Martin', driver: 'Fernando Alonso' },
      { team: 'Aston Martin', driver: 'Lance Stroll' },
      { team: 'Alpine', driver: 'Pierre Gasly' },
      { team: 'Alpine', driver: 'Franco Colapinto' },
      { team: 'Williams', driver: 'Alexander Albon' },
      { team: 'Williams', driver: 'Carlos Sainz' },
      { team: 'Racing Bulls', driver: 'Liam Lawson' },
      { team: 'Racing Bulls', driver: 'Arvid Lindblad' },
      { team: 'Audi', driver: 'Nico Hülkenberg' },
      { team: 'Audi', driver: 'Gabriel Bortoleto' },
      { team: 'Haas', driver: 'Esteban Ocon' },
      { team: 'Haas', driver: 'Oliver Bearman' },
      { team: 'Cadillac', driver: 'Sergio Pérez' },
      { team: 'Cadillac', driver: 'Valtteri Bottas' }
    ],
    teams: ['Red Bull Racing', 'Mercedes', 'Ferrari', 'McLaren', 'Aston Martin', 'Alpine', 'Williams', 'Racing Bulls', 'Audi', 'Haas', 'Cadillac']
  }
};

const DEFAULT_SEASON_GAME_KEY = 'f1_25';
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


const DEFAULT_FAQ_ITEMS = [
  {
    question: 'Wie melde ich mich für ein Rennen an oder ab?',
    answer: 'Bitte die Anmeldung erfolgt über eine Umfrage auf Whatsapp. Eine Abmeldung sollte spätestens fünf Minuten vor Rennbeginn ebenfalls über Whatsapp erfolgen, damit das Rennen pünktlich starten kann.'
  },
  {
    question: 'Was passiert, wenn ich kurzfristig nicht teilnehmen kann?',
    answer: 'Das ist nicht schlimm, dein Ersatzfahrer wird sich für dich ins Cockpit setzen. Die Punkte werden in der Ergebnisübersicht dann entsprechend markiert.'
  },
  {
    question: 'Wann werden Rennergebnisse und Tabellen aktualisiert?',
    answer: 'Sobald die Stewards alle Vorfälle abschließend besprochen und mögliche Konsequenzen verhängt haben.'
  },
  {
    question: 'Wo reiche ich einen Vorfall ein und welche Infos brauche ich dafür?',
    answer: 'Vorfälle reichst du als Videoclip direkt über die Whatsapp Gruppe mit dem Vermerk „bewerten“ ein.'
  },
  {
    question: 'Wo werden Entscheidungen der Rennleitung veröffentlicht?',
    answer: 'Die Entscheidungen findest du über den Kalender, indem du das entsprechende Rennen öffnest.'
  }
];

const state = {
  isSavingDriver: false,
  isDeletingDriver: false,
  isSwappingDriverVehicle: false,
  isSavingManualResults: false,
  isPublishing: false,
  isDiscarding: false,
  isImportingResults: false,
  isSavingRace: false,
  isDeletingRace: false,
  isShiftingRaceDates: false,
  isSavingIncident: false,
  isDeletingIncident: false,
  isSavingRulesContent: false,
  isStartingSeason: false,
  isGeneratingSeason: false,
  seasonFinalizePreview: null,
  driversCache: [],
  selectedSwapSourceDriverId: null,
  activeAdminTabTarget: 'admin-section-results',
  eventsBound: false,
  authListenerBound: false,
  initialized: false
};

let stewardCaseCache = [];

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
  el.dataset.level = isError ? 'error' : 'info';
  el.classList.toggle('notice-error', isError);
}

function clearFeedback(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = true;
  el.style.display = 'none';
  el.textContent = '';
  delete el.dataset.level;
  el.classList.remove('notice-error');
}

async function confirmDangerousAction({
  title = 'Sicherheitsabfrage',
  details = '',
  keyword = 'BESTÄTIGEN'
} = {}) {
  const message = `${title}\n\n${details}\n\nZur Bestätigung zuerst "OK" klicken und danach ${keyword} eingeben.`;
  const confirmed = window.confirm(message);
  if (!confirmed) return false;
  const typed = window.prompt(`Bitte "${keyword}" eingeben, um fortzufahren:`, '');
  if (typed === null) return false;
  return typed.trim().toUpperCase() === keyword;
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

function resolveDriverLogoSourceForAdmin(driver = {}) {
  return window.resolveDriverLogoSource?.(driver)
    || window.findMatchingTeamLogoName?.([driver.car_name, driver.league_team])
    || String(driver.car_name || driver.league_team || '').trim();
}

function resolveSeasonGameLabel(gameKey) {
  return SEASON_GAME_CONFIGS[gameKey]?.label || SEASON_GAME_CONFIGS[DEFAULT_SEASON_GAME_KEY].label;
}

function getSelectedSeasonGameKey() {
  const selected = String(document.getElementById('season-game-select')?.value || '').trim();
  if (selected && SEASON_GAME_CONFIGS[selected]) return selected;
  return DEFAULT_SEASON_GAME_KEY;
}

function getActiveSeasonGameKey() {
  const summaryGameKey = String(document.getElementById('season-summary')?.dataset.gameKey || '').trim();
  if (summaryGameKey && SEASON_GAME_CONFIGS[summaryGameKey]) return summaryGameKey;
  return getSelectedSeasonGameKey();
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

  const fastestLapText = summary.fastestLapWinnerLabel
    ? ` · Schnellste Runde: ${summary.fastestLapWinnerLabel}`
    : '';
  const stats = `Gesamt: ${summary.total || 0} · Gemappt: ${summary.matched || 0} · Konflikte: ${summary.conflicts || 0}${fastestLapText}`;
  preview.innerHTML = `
    <div class="notice">${window.escapeHtml(stats)}</div>
    <table class="admin-preview-table">
      <thead>
        <tr>
          <th>CSV-Fahrer</th>
          <th>Grand Prix</th>
          <th>Match</th>
          <th>Quelle</th>
          <th>Punkte</th>
          <th>Schnellste Runde</th>
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
            <td>${window.escapeHtml(String(row.awardedPoints ?? 0))}</td>
            <td>${window.escapeHtml(row.fastestLapLabel || '—')}</td>
            <td><span class="preview-badge ${row.statusClass || ''}">${window.escapeHtml(row.statusLabel || 'Unbekannt')}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function buildDriverLookupMap(drivers = []) {
  const map = new Map();
  const sourcePriority = {
    'AI-Fahrer': 3,
    Gamertag: 2,
    Anzeigename: 1
  };

  const register = (key, payload) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    const entries = map.get(key);
    const existingIndex = entries.findIndex((entry) => entry.driver_id === payload.driver_id);
    if (existingIndex === -1) {
      entries.push(payload);
      return;
    }

    const current = entries[existingIndex];
    const currentPriority = sourcePriority[current.source] || 0;
    const incomingPriority = sourcePriority[payload.source] || 0;
    if (incomingPriority > currentPriority) entries[existingIndex] = payload;
  };

  drivers.forEach((driver) => {
    const gamertagKey = normalizeDriverLookup(driver.gamertag);
    const aiKey = normalizeDriverLookup(driver.ai_driver_reference);
    const displayNameKey = normalizeDriverLookup(driver.display_name);
    register(gamertagKey, { driver_id: driver.id, participation_status: 'PLAYER', source: 'Gamertag', label: driver.gamertag || driver.display_name || 'Spieler' });
    register(aiKey, { driver_id: driver.id, participation_status: 'BOT', source: 'AI-Fahrer', label: driver.ai_driver_reference || driver.display_name || 'BOT' });
    register(displayNameKey, { driver_id: driver.id, participation_status: 'PLAYER', source: 'Anzeigename', label: driver.display_name || driver.gamertag || 'Spieler' });
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
  const ambiguousDrivers = [];
  const duplicates = new Set();
  const seenNormalized = new Set();
  const previewRows = [];

  for (const row of parsedRows) {
    const rawDriverName = String(row['fahrer'] || '').trim();
    const normalized = normalizeDriverLookup(rawDriverName);
    if (normalized && seenNormalized.has(`${grandPrixName}::${normalized}`)) duplicates.add(rawDriverName);
    seenNormalized.add(`${grandPrixName}::${normalized}`);

    const mappedCandidates = driverMap.get(normalized) || [];
    if (!mappedCandidates.length) {
      missingDrivers.push(rawDriverName || '');
      previewRows.push({
        rawDriverName,
        grandPrixName,
        matchedLabel: '',
        matchSource: '',
        awardedPoints: Number(row['punkte'] || 0) || 0,
        fastestLapLabel: '—',
        statusLabel: 'Kein Match',
        statusClass: 'preview-badge--error'
      });
      continue;
    }

    if (mappedCandidates.length > 1) {
      const candidateLabels = [...new Set(mappedCandidates.map((candidate) => candidate.label).filter(Boolean))];
      ambiguousDrivers.push(rawDriverName || '');
      previewRows.push({
        rawDriverName,
        grandPrixName,
        matchedLabel: candidateLabels.join(' / ') || 'Mehrdeutig',
        matchSource: 'Mehrere Treffer',
        awardedPoints: Number(row['punkte'] || 0) || 0,
        fastestLapLabel: '—',
        statusLabel: 'Mehrdeutig',
        statusClass: 'preview-badge--error'
      });
      continue;
    }

    const mapped = mappedCandidates[0];
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
      driver_id: mapped.driver_id,
      rawDriverName,
      grandPrixName,
      matchedLabel: mapped.label,
      matchSource: mapped.source,
      awardedPoints: Number(row['punkte'] || 0) || 0,
      fastestLapLabel: '—',
      statusLabel: 'Gemappt',
      statusClass: mapped.participation_status === 'BOT' ? 'preview-badge--warning' : 'preview-badge--success'
    });
  }

  const fastestLapWinnerId = getFastestLapWinnerId(preparedRows);
  let fastestLapWinnerLabel = '';
  if (fastestLapWinnerId) {
    previewRows.forEach((row) => {
      if (!row.driver_id) return;
      row.fastestLapLabel = row.driver_id === fastestLapWinnerId ? 'Zugeteilt' : '—';
      if (row.driver_id === fastestLapWinnerId) fastestLapWinnerLabel = row.matchedLabel || row.rawDriverName || '';
    });
  }

  const summary = {
    total: parsedRows.length,
    matched: preparedRows.length,
    conflicts: missingDrivers.length + duplicates.size + ambiguousDrivers.length,
    fastestLapWinnerLabel
  };
  renderImportPreviewTable(previewRows, summary);
  if (missingDrivers.length || duplicates.size || ambiguousDrivers.length) {
    const parts = [];
    if (missingDrivers.length) parts.push(`Nicht gefunden: ${[...new Set(missingDrivers)].join(', ')}`);
    if (ambiguousDrivers.length) parts.push(`Mehrdeutige Zuordnung: ${[...new Set(ambiguousDrivers)].join(', ')}`);
    if (duplicates.size) parts.push(`Doppelte CSV-Einträge: ${[...duplicates].join(', ')}`);
    setImportPreviewBanner(parts.join(' · '), false, true);
  } else {
    setImportPreviewBanner('Import-Vorschau erfolgreich. Alle Fahrer wurden sauber gemappt.', false, false);
  }

  return {
    ok: !missingDrivers.length && !duplicates.size && !ambiguousDrivers.length,
    parsedRows,
    preparedRows,
    grandPrixName,
    missingDrivers,
    ambiguousDrivers,
    duplicates: [...duplicates]
  };
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
  if (!isAdminSession(data.session)) {
    throw new Error('Eingeloggt, aber keine Admin-Berechtigung. Bitte Admin-Rolle (JWT) oder freigegebene E-Mail prüfen.');
  }
  return data.session;
}

function getConfiguredAdminEmails() {
  const configured = window.RCC_ADMIN_EMAILS;
  if (Array.isArray(configured)) {
    return configured.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
  }
  if (typeof configured === 'string') {
    return configured.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

function hasElevatedRole(user = {}) {
  const appRole = String(user?.app_metadata?.role || '').trim().toLowerCase();
  const userRole = String(user?.user_metadata?.role || '').trim().toLowerCase();
  const claimsRole = String(user?.role || '').trim().toLowerCase();
  const allowedRoles = new Set(['admin', 'owner', 'steward_admin', 'league_admin']);
  return allowedRoles.has(appRole) || allowedRoles.has(userRole) || allowedRoles.has(claimsRole);
}

function isAdminSession(session) {
  if (!session?.user) return false;
  if (hasElevatedRole(session.user)) return true;
  const configuredEmails = getConfiguredAdminEmails();
  if (!configuredEmails.length) return false;
  const email = String(session.user.email || '').trim().toLowerCase();
  return Boolean(email && configuredEmails.includes(email));
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

function resetStewardIncidentForm() {
  ['incident-edit-id', 'incident-race', 'incident-title', 'incident-description', 'incident-decision', 'incident-driver-1', 'incident-driver-2'].forEach((id) => setValue(id, ''));
  setValue('incident-consequence', 'Keine');
  const raceSelect = document.getElementById('incident-race');
  if (raceSelect) raceSelect.disabled = false;
  const saveButton = document.getElementById('save-incident-btn');
  if (saveButton) saveButton.textContent = 'Steward-Eintrag speichern';
}

async function upsertPenaltyForStewardCase(entryId, raceId, driver2Id, title, decision, consequence) {
  const seconds = parsePenaltySeconds(consequence);
  const { data: existingPenalty, error: existingPenaltyError } = await window.supabaseClient
    .from('race_penalties')
    .select('id')
    .eq('steward_case_id', entryId)
    .maybeSingle();

  if (existingPenaltyError) throw existingPenaltyError;

  if (!driver2Id || !seconds) {
    if (existingPenalty?.id) {
      const { error: deletePenaltyError } = await window.supabaseClient.from('race_penalties').delete().eq('id', existingPenalty.id);
      if (deletePenaltyError) throw deletePenaltyError;
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
    const { error: updatePenaltyError } = await window.supabaseClient.from('race_penalties').update(payload).eq('id', existingPenalty.id);
    if (updatePenaltyError) throw updatePenaltyError;
  } else {
    const { error: insertPenaltyError } = await window.supabaseClient.from('race_penalties').insert([payload]);
    if (insertPenaltyError) throw insertPenaltyError;
  }
}

function renderStewardCaseAdminList() {
  const list = document.getElementById('admin-incident-list');
  if (!list) return;
  if (!stewardCaseCache.length) {
    list.innerHTML = '<div class="notice">Noch kein Steward-Fall vorhanden.</div>';
    return;
  }

  list.innerHTML = stewardCaseCache.map((entry) => {
    const involved = [entry.driver1?.display_name && `Fahrer 1: ${entry.driver1.display_name}`, entry.driver2?.display_name && `Fahrer 2: ${entry.driver2.display_name}`]
      .filter(Boolean)
      .join(' · ');
    return `
      <article class="incident-item">
        <strong>${window.escapeHtml(entry.races?.grand_prix_name || 'Rennen')} · ${window.escapeHtml(entry.title || 'Steward-Fall')}</strong>
        <span class="muted">${window.escapeHtml(entry.description || 'Keine Beschreibung')}</span>
        <span class="muted">${window.escapeHtml(involved || 'Keine Fahrer zugeordnet')}</span>
        <span class="muted">Entscheidung: ${window.escapeHtml(entry.decision_text || '—')}</span>
        <span class="muted">Konsequenz: ${window.escapeHtml(entry.consequence || 'Keine')}</span>
        <div class="card-actions">
          <button type="button" class="button-secondary edit-incident-btn" data-id="${entry.id}">Bearbeiten</button>
          <button type="button" class="button-secondary button-danger delete-incident-btn" data-id="${entry.id}">Löschen</button>
        </div>
      </article>
    `;
  }).join('');
}

function editStewardIncident(entryId) {
  const entry = stewardCaseCache.find((item) => String(item.id) === String(entryId));
  if (!entry) return;
  setValue('incident-edit-id', entry.id);
  setValue('incident-race', entry.race_id || '');
  setValue('incident-title', entry.title || '');
  setValue('incident-description', entry.description || '');
  setValue('incident-decision', entry.decision_text || '');
  setValue('incident-consequence', entry.consequence || 'Keine');
  setValue('incident-driver-1', entry.driver_1_id || '');
  setValue('incident-driver-2', entry.driver_2_id || '');
  const raceSelect = document.getElementById('incident-race');
  if (raceSelect) raceSelect.disabled = true;
  const saveButton = document.getElementById('save-incident-btn');
  if (saveButton) saveButton.textContent = 'Steward-Fall aktualisieren';
  showFeedback('incident-feedback', `Bearbeitungsmodus aktiv: ${entry.races?.grand_prix_name || 'Rennen'} · ${entry.title || 'Steward-Fall'}`);
}

async function loadStewardCasesForAdmin() {
  const list = document.getElementById('admin-incident-list');
  if (!list) return;
  list.innerHTML = '<div class="notice">Steward-Fälle werden geladen...</div>';

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
      created_at,
      races:race_id ( grand_prix_name ),
      driver1:driver_1_id ( display_name ),
      driver2:driver_2_id ( display_name )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    const relationMissing = error.code === 'PGRST205' || error.code === '42P01';
    list.innerHTML = `<div class="notice">${relationMissing ? 'Steward-Datenbank noch nicht eingerichtet.' : 'Fehler beim Laden der Steward-Fälle.'}</div>`;
    return;
  }

  stewardCaseCache = data || [];
  renderStewardCaseAdminList();
}

async function deleteStewardIncident(entryId) {
  if (state.isDeletingIncident) return;
  state.isDeletingIncident = true;
  clearFeedback('incident-feedback');
  try {
    await requireAdminSession();
    const entry = stewardCaseCache.find((item) => String(item.id) === String(entryId));
    if (!entry) throw new Error('Steward-Fall nicht gefunden.');
    const confirmed = await confirmDangerousAction({
      title: 'Steward-Fall löschen?',
      details: `${entry.title || 'Ausgewählter Fall'} wird inklusive Strafen entfernt.`,
      keyword: 'LOESCHEN'
    });
    if (!confirmed) return;

    const { error: deletePenaltiesError } = await window.supabaseClient.from('race_penalties').delete().eq('steward_case_id', entryId);
    if (deletePenaltiesError) throw deletePenaltiesError;
    const { error: deleteCaseError } = await window.supabaseClient.from('steward_cases').delete().eq('id', entryId);
    if (deleteCaseError) throw deleteCaseError;
    if (entry.race_id) await recalculateOfficialRaceResults(entry.race_id);

    resetStewardIncidentForm();
    showFeedback('incident-feedback', 'Steward-Fall gelöscht und Rennergebnis neu berechnet.');
    await Promise.all([loadStewardCasesForAdmin(), loadSeasonSummary(), renderPublishWorkflow()]);
  } catch (error) {
    console.error(error);
    showFeedback('incident-feedback', `Löschen fehlgeschlagen: ${error.message}`, true);
  } finally {
    state.isDeletingIncident = false;
  }
}

function populateDriverDropdowns() {
  const aiSelect = document.getElementById('driver-ai-reference');
  const carSelect = document.getElementById('driver-car-name');
  const gpSelect = document.getElementById('race-grand-prix-name');
  const weatherSelect = document.getElementById('race-weather');
  const timeSelect = document.getElementById('race-time');
  const seasonGameConfig = SEASON_GAME_CONFIGS[getActiveSeasonGameKey()] || SEASON_GAME_CONFIGS[DEFAULT_SEASON_GAME_KEY];

  renderOptions(
    aiSelect,
    sortByLabel(seasonGameConfig.aiDrivers, (item) => item.driver),
    (item) => `<option value="${item.driver}" data-team="${item.team}">${item.driver} (${item.team})</option>`
  );

  renderOptions(
    carSelect,
    sortByLabel(seasonGameConfig.teams, (car) => car),
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


function normalizeFaqItems(items) {
  const source = Array.isArray(items) && items.length ? items : DEFAULT_FAQ_ITEMS;
  return source
    .map((item) => ({
      id: String(item?.id || '').trim() || (window.crypto?.randomUUID?.() || `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      question: String(item?.question || '').trim(),
      answer: String(item?.answer || '').trim()
    }))
    .filter((item) => item.question && item.answer);
}

function renderFaqEditorItems(items = []) {
  const list = document.getElementById('faq-editor-list');
  if (!list) return;

  const normalizedItems = normalizeFaqItems(items);
  list.innerHTML = normalizedItems.map((item, index) => `
    <article class="faq-editor-item" data-faq-id="${window.escapeHtml(item.id)}">
      <div class="field full">
        <label>Frage ${index + 1}</label>
        <input type="text" class="faq-question-input" value="${escapeHtmlAttr(item.question)}" placeholder="Frage eingeben">
      </div>
      <div class="field full">
        <label>Antwort</label>
        <textarea class="faq-answer-input" rows="3" placeholder="Antwort eingeben">${window.escapeHtml(item.answer)}</textarea>
      </div>
      <div class="card-actions">
        <button type="button" class="button-secondary delete-faq-btn" data-faq-id="${window.escapeHtml(item.id)}">FAQ löschen</button>
      </div>
    </article>
  `).join('');
}

function addFaqEditorItem() {
  const existing = readFaqItemsFromForm();
  existing.push({
    id: window.crypto?.randomUUID?.() || `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: '',
    answer: ''
  });
  renderFaqEditorItems(existing);
}

function removeFaqEditorItem(faqId) {
  const filtered = readFaqItemsFromForm().filter((item) => item.id !== faqId);
  renderFaqEditorItems(filtered);
}

function readFaqItemsFromForm() {
  const rows = [...document.querySelectorAll('#faq-editor-list .faq-editor-item')];
  return rows
    .map((row) => ({
      id: String(row.dataset.faqId || '').trim() || (window.crypto?.randomUUID?.() || `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      question: String(row.querySelector('.faq-question-input')?.value || '').trim(),
      answer: String(row.querySelector('.faq-answer-input')?.value || '').trim()
    }))
    .filter((item) => item.question && item.answer);
}

async function loadRulesContent() {
  try {
    const content = await window.RCCData.fetchLeagueContent();
    applyRulesConfigToForm(content.rules_config || {});
    renderFaqEditorItems(content.faq_items || []);
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

    const faqItems = readFaqItemsFromForm();
    const payload = {
      id: 'default',
      rules_config: buildRulesConfigFromForm(),
      faq_items: faqItems,
      faq_text: faqItems.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n')
    };

    const { error } = await window.supabaseClient
      .from('league_content')
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;

    showFeedback('rules-feedback', 'Regeln & FAQs wurden gespeichert.');
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

function closeDriverSwapModal() {
  const modal = document.getElementById('driver-swap-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  setValue('driver-swap-target', '');
  state.selectedSwapSourceDriverId = null;
}

function openDriverSwapModal(sourceDriverId) {
  const modal = document.getElementById('driver-swap-modal');
  const select = document.getElementById('driver-swap-target');
  const label = document.getElementById('driver-swap-source-label');
  if (!modal || !select || !label) return;

  const sourceDriver = state.driversCache.find((driver) => String(driver.id) === String(sourceDriverId));
  if (!sourceDriver) {
    showFeedback('driver-feedback', 'Fahrer für den Tausch konnte nicht gefunden werden.', true);
    return;
  }

  const swapCandidates = [...state.driversCache]
    .filter((driver) => String(driver.id) !== String(sourceDriver.id))
    .sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || ''), 'de', { sensitivity: 'base' }));

  renderOptions(
    select,
    swapCandidates,
    (driver) => `<option value="${driver.id}">${window.escapeHtml(driver.display_name || 'Unbekannt')} · ${window.escapeHtml(driver.car_name || 'kein Auto')} · ${window.escapeHtml(driver.ai_driver_reference || 'kein AI Fahrer')}</option>`,
    'Fahrer auswählen'
  );
  label.textContent = sourceDriver.display_name || 'Unbekannt';
  state.selectedSwapSourceDriverId = sourceDriver.id;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

async function swapDriverVehicle() {
  if (state.isSwappingDriverVehicle) return;
  const sourceId = state.selectedSwapSourceDriverId;
  const targetId = getTrimmedValue('driver-swap-target');

  if (!sourceId || !targetId) {
    showFeedback('driver-swap-feedback', 'Bitte einen Fahrer zum Tauschen auswählen.', true);
    return;
  }

  const sourceDriver = state.driversCache.find((driver) => String(driver.id) === String(sourceId));
  const targetDriver = state.driversCache.find((driver) => String(driver.id) === String(targetId));
  if (!sourceDriver || !targetDriver) {
    showFeedback('driver-swap-feedback', 'Fahrer konnten nicht geladen werden. Bitte neu versuchen.', true);
    return;
  }

  if (!window.confirm(`Fahrzeug + AI Fahrer von "${sourceDriver.display_name}" und "${targetDriver.display_name}" tauschen?`)) return;

  state.isSwappingDriverVehicle = true;
  clearFeedback('driver-swap-feedback');
  clearFeedback('driver-feedback');

  try {
    await requireAdminSession();

    const firstUpdate = window.supabaseClient
      .from('drivers')
      .update({
        car_name: targetDriver.car_name || null,
        ai_driver_reference: targetDriver.ai_driver_reference || null
      })
      .eq('id', sourceDriver.id);
    const secondUpdate = window.supabaseClient
      .from('drivers')
      .update({
        car_name: sourceDriver.car_name || null,
        ai_driver_reference: sourceDriver.ai_driver_reference || null
      })
      .eq('id', targetDriver.id);

    const [{ error: firstError }, { error: secondError }] = await Promise.all([firstUpdate, secondUpdate]);
    if (firstError) throw firstError;
    if (secondError) throw secondError;

    closeDriverSwapModal();
    showFeedback('driver-feedback', `Fahrzeug + AI Fahrer wurden zwischen "${sourceDriver.display_name}" und "${targetDriver.display_name}" getauscht.`);
    await loadDrivers();
  } catch (error) {
    console.error(error);
    showFeedback('driver-swap-feedback', `Fehler beim Tauschen: ${error.message}`, true);
  } finally {
    state.isSwappingDriverVehicle = false;
  }
}

async function refreshSessionStatus() {
  const statusEl = document.getElementById('admin-session-status');
  const inlineSession = document.getElementById('admin-session-inline');
  const inlineLabel = document.getElementById('admin-session-inline-label');
  const quickLogoutBtn = document.getElementById('admin-quick-logout-btn');
  const banner = document.getElementById('admin-session-banner');
  const bannerLabel = document.getElementById('admin-session-banner-label');
  const loginForm = document.getElementById('admin-login-form');
  const loginActions = document.getElementById('admin-login-actions');
  const authSection = document.getElementById('admin-section-auth');
  const sectionHeader = document.querySelector('.section-header');
  const mobileTabs = document.getElementById('admin-mobile-tabs');
  const protectedPanels = [...document.querySelectorAll('.admin-layout > .panel:not(#admin-section-auth)')];
  if (!statusEl) return;

  const { data, error } = await window.supabaseClient.auth.getSession();
  if (error) {
    statusEl.textContent = `Sessionfehler: ${error.message}`;
    return;
  }

  const session = data?.session || null;
  const adminActive = isAdminSession(session);
  const hasSession = Boolean(session);
  const userEmail = session?.user?.email || '';
  statusEl.textContent = session
    ? (adminActive
      ? `Eingeloggt als Admin (${userEmail})`
      : `Eingeloggt ohne Admin-Rechte: ${userEmail}`)
    : 'Keine aktive Session';
  statusEl.hidden = !hasSession;

  if (inlineLabel) {
    inlineLabel.innerHTML = session
      ? (adminActive
        ? `Eingeloggt als <strong>Admin</strong>${userEmail ? ` (${window.escapeHtml(userEmail)})` : ''}`
        : `Eingeloggt als <strong>Benutzer</strong>${userEmail ? ` (${window.escapeHtml(userEmail)})` : ''}`)
      : 'Nicht eingeloggt';
  }
  if (inlineSession) inlineSession.hidden = !hasSession;
  if (quickLogoutBtn) quickLogoutBtn.hidden = !session;
  if (loginForm) loginForm.hidden = Boolean(adminActive);
  if (loginActions) loginActions.hidden = Boolean(adminActive);
  if (authSection) {
    authSection.hidden = adminActive;
    authSection.open = !adminActive;
  }
  if (sectionHeader) sectionHeader.hidden = !adminActive;
  if (mobileTabs) mobileTabs.hidden = !adminActive;
  protectedPanels.forEach((panel) => {
    panel.hidden = !adminActive;
  });
  if (adminActive) {
    syncAdminTabVisibility();
  }
  if (banner) banner.hidden = !adminActive;
  if (bannerLabel) {
    bannerLabel.textContent = `Eingeloggt als Admin${userEmail ? ` (${userEmail})` : ''}`;
  }

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
    state.driversCache = [];
    list.innerHTML = '<div class="notice">Noch keine Fahrer angelegt.</div>';
    return;
  }

  state.driversCache = data;

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
                  <span class="muted">Auto: ${window.createTeamLogoBadge?.(resolveDriverLogoSourceForAdmin(driver), { size: 'large', label: driver.car_name || driver.league_team || 'Auto' }) || window.escapeHtml(driver.car_name || '—')}</span>
                </div>
                <div class="card-actions compact-driver-actions">
                  <button type="button" class="button-secondary edit-driver-btn"
                    data-id="${driver.id}"
                    data-display-name="${escapeHtmlAttr(driver.display_name)}"
                    data-ai-driver-reference="${escapeHtmlAttr(driver.ai_driver_reference)}"
                    data-gamertag="${escapeHtmlAttr(driver.gamertag)}"
                    data-league-team="${escapeHtmlAttr(driver.league_team)}"
                    data-car-name="${escapeHtmlAttr(driver.car_name)}">Bearbeiten</button>
                  <button type="button" class="button-secondary swap-driver-btn"
                    data-id="${driver.id}">Fahrzeug tauschen</button>
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
  const confirmed = await confirmDangerousAction({
    title: `Fahrer "${displayName}" löschen?`,
    details: 'Alle zugehörigen Ergebnis- und Stewarding-Zuordnungen werden bereinigt.',
    keyword: 'LOESCHEN'
  });
  if (!confirmed) return;
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
      delete el.dataset.gameKey;
      return;
    }

    const races = await window.RCCData.fetchRaces({ seasonId: season.id });
    const seasonGameKey = String(season.game_key || '').trim() || DEFAULT_SEASON_GAME_KEY;
    el.dataset.gameKey = seasonGameKey;
    setValue('season-game-select', seasonGameKey);
    el.innerHTML = `<strong>Aktive Saison:</strong> ${window.escapeHtml(season.name || `Saison ${season.id}`)}<br><strong>Spiel:</strong> ${window.escapeHtml(resolveSeasonGameLabel(seasonGameKey))}<br><strong>Rennen:</strong> ${races.length}<br><strong>Status:</strong> ${window.escapeHtml(season.status || 'active')}`;
    populateDriverDropdowns();
    updateAdminOverview();
  } catch (error) {
    console.error(error);
    el.textContent = 'Saisonübersicht konnte nicht geladen werden.';
    delete el.dataset.gameKey;
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

  const raceDeleteSelect = document.getElementById('race-delete-source');
  if (raceDeleteSelect) {
    const roundSortedRaces = [...(data || [])].sort((a, b) => Number(a.round_number || 0) - Number(b.round_number || 0));
    raceDeleteSelect.innerHTML = roundSortedRaces.length
      ? '<option value="">Bitte Rennen wählen</option>' + roundSortedRaces.map((race) => `<option value="${race.id}">R${race.round_number} · ${race.grand_prix_name} · ${race.race_date || 'kein Datum'}</option>`).join('')
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

    const confirmed = await confirmDangerousAction({
      title: 'Renntermine verschieben?',
      details: `${selectedRace.grand_prix_name} und ${Math.max(affectedRaces.length - 1, 0)} Folge-Rennen werden angepasst.`,
      keyword: 'VERSCHIEBEN'
    });
    if (!confirmed) return;

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

async function deleteRaceFromCalendar() {
  if (state.isDeletingRace) return;
  state.isDeletingRace = true;
  clearFeedback('race-delete-feedback');

  try {
    await requireAdminSession();
    const raceId = getValue('race-delete-source');
    if (!raceId) {
      return showFeedback('race-delete-feedback', 'Bitte ein Rennen zum Entfernen auswählen.', true);
    }

    const season = await getCurrentSeasonSafe();
    let query = window.supabaseClient
      .from('races')
      .select('id, round_number, grand_prix_name')
      .order('round_number', { ascending: true });
    if (season?.id) query = query.eq('season_id', season.id);

    const { data: races, error: racesError } = await query;
    if (racesError) {
      return showFeedback('race-delete-feedback', `Rennen konnten nicht geladen werden: ${racesError.message}`, true);
    }

    const selectedRace = (races || []).find((entry) => String(entry.id) === String(raceId));
    if (!selectedRace) {
      return showFeedback('race-delete-feedback', 'Das gewählte Rennen wurde nicht gefunden.', true);
    }

    const confirmed = await confirmDangerousAction({
      title: `${selectedRace.grand_prix_name} (R${selectedRace.round_number}) entfernen?`,
      details: 'Das Rennen und alle zugehörigen Ergebnisse werden gelöscht.',
      keyword: 'ENTFERNEN'
    });
    if (!confirmed) {
      return;
    }

    const { error: deleteResultsError } = await window.supabaseClient.from('race_results').delete().eq('race_id', selectedRace.id);
    if (deleteResultsError) {
      return showFeedback('race-delete-feedback', `Rennergebnisse konnten nicht entfernt werden: ${deleteResultsError.message}`, true);
    }

    const { error: deleteRaceError } = await window.supabaseClient.from('races').delete().eq('id', selectedRace.id);
    if (deleteRaceError) {
      return showFeedback('race-delete-feedback', `Rennen konnte nicht entfernt werden: ${deleteRaceError.message}`, true);
    }

    const racesToReorder = (races || [])
      .filter((entry) => Number(entry.round_number || 0) > Number(selectedRace.round_number || 0))
      .sort((a, b) => Number(a.round_number || 0) - Number(b.round_number || 0));

    if (racesToReorder.length) {
      const reorderUpdates = await Promise.all(
        racesToReorder.map((entry) => window.supabaseClient
          .from('races')
          .update({ round_number: Number(entry.round_number || 0) - 1 })
          .eq('id', entry.id))
      );

      const failedUpdate = reorderUpdates.find((result) => result.error);
      if (failedUpdate?.error) {
        return showFeedback('race-delete-feedback', `Rennen wurde entfernt, aber Rundennummern konnten nicht vollständig angepasst werden: ${failedUpdate.error.message}`, true);
      }
    }

    showFeedback('race-delete-feedback', `${selectedRace.grand_prix_name} wurde aus dem Rennkalender entfernt.`);
    setValue('race-delete-source', '');
    await Promise.all([
      loadRaceOptions(),
      loadSeasonSummary()
    ]);
  } catch (error) {
    console.error(error);
    showFeedback('race-delete-feedback', `Fehler beim Entfernen: ${error.message}`, true);
  } finally {
    state.isDeletingRace = false;
  }
}

async function saveStewardIncident() {
  if (state.isSavingIncident) return;
  state.isSavingIncident = true;
  clearFeedback('incident-feedback');

  try {
    await requireAdminSession();
    const incidentId = getValue('incident-edit-id');
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

    let stewardCaseId = incidentId;
    if (incidentId) {
      const { error: caseError } = await window.supabaseClient
        .from('steward_cases')
        .update(casePayload)
        .eq('id', incidentId);
      if (caseError) {
        return showFeedback('incident-feedback', `Fehler beim Aktualisieren: ${caseError.message}`, true);
      }
    } else {
      const { data: createdCase, error: caseError } = await window.supabaseClient
        .from('steward_cases')
        .insert([casePayload])
        .select('id')
        .single();
      if (caseError) {
        return showFeedback('incident-feedback', `Fehler beim Speichern: ${caseError.message}`, true);
      }
      stewardCaseId = createdCase.id;
    }

    await upsertPenaltyForStewardCase(stewardCaseId, raceId, driver2Id, title, decision, consequence);

    await recalculateOfficialRaceResults(raceId);

    const seconds = parsePenaltySeconds(consequence);
    const wasEdit = Boolean(incidentId);
    resetStewardIncidentForm();
    showFeedback('incident-feedback', driver2Id && seconds
      ? (wasEdit ? 'Steward-Fall aktualisiert. Zeitkorrektur und Ergebnis wurden neu berechnet.' : 'Steward-Eintrag erfolgreich gespeichert. Die Zeitkorrektur wurde direkt auf das offizielle Rennergebnis angewendet.')
      : (wasEdit ? 'Steward-Fall aktualisiert. Ergebnisse und Wertungen wurden aktualisiert.' : 'Steward-Eintrag erfolgreich gespeichert. Ergebnisse und Wertungen wurden aktualisiert.'));
    await Promise.all([
      renderPublishWorkflow(),
      loadSeasonSummary(),
      loadRaceOptions(),
      loadStewardCasesForAdmin()
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
    const confirmed = await confirmDangerousAction({
      title: `${importItem.races?.grand_prix_name || 'Rennen'} veröffentlichen?`,
      details: 'Bestehende offizielle Ergebnisse dieses Rennens werden überschrieben.',
      keyword: 'VEROEFFENTLICHEN'
    });
    if (!confirmed) return;

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
    const confirmed = await confirmDangerousAction({
      title: `Entwurf für ${item.races?.grand_prix_name || 'dieses Rennen'} löschen?`,
      details: 'Der Entwurf und alle Importzeilen werden dauerhaft entfernt.',
      keyword: 'ENTWURF'
    });
    if (!confirmed) return;

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
    const overwritePublished = Boolean(options.overwritePublished);
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

    const [{ count: existingPublishedResultsCount, error: existingPublishedResultsError }, { count: existingPenaltiesCount, error: existingPenaltiesError }] = await Promise.all([
      window.supabaseClient
        .from('race_results')
        .select('id', { count: 'exact', head: true })
        .eq('race_id', raceData.id),
      window.supabaseClient
        .from('race_penalties')
        .select('id', { count: 'exact', head: true })
        .eq('race_id', raceData.id)
    ]);

    if (existingPublishedResultsError || existingPenaltiesError) {
      return showFeedback(
        'csv-feedback',
        `Vorhandene Rennergebnisse/Steward-Entscheidungen konnten nicht geprüft werden: ${(existingPublishedResultsError || existingPenaltiesError).message}`,
        true
      );
    }

    if ((existingPublishedResultsCount || 0) > 0 && !overwritePublished) {
      return showFeedback('csv-feedback', `Für "${grandPrixName}" sind bereits veröffentlichte Ergebnisse vorhanden. Aktiviere „Korrektur Upload“, um den Stand zu ersetzen.`, true);
    }

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
    const correctionInfo = (existingPublishedResultsCount || 0) > 0
      ? ' Korrekturimport aktiv: Bei der nächsten Freigabe wird der bisher veröffentlichte Stand vollständig überschrieben.'
      : '';
    const stewardInfo = (existingPenaltiesCount || 0) > 0
      ? ` ${existingPenaltiesCount} Steward-Entscheidung${existingPenaltiesCount === 1 ? ' bleibt' : 'en bleiben'} aktiv und ${existingPenaltiesCount === 1 ? 'wird' : 'werden'} bei der Freigabe automatisch auf den neuen Import angewendet.`
      : '';
    showFeedback('csv-feedback', `Ergebnisse für "${grandPrixName}" wurden als Prüfstand importiert. Steward-Fälle können jetzt direkt auf die Freigabe-Vorschau wirken.${correctionInfo}${stewardInfo}`);
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

    const confirmed = await confirmDangerousAction({
      title: `Saison ${currentSeason.name || ''} final abschließen?`,
      details: `Fahrer-Weltmeister: ${preview.driverChampion?.driverName || '—'}\nKonstrukteurs-Weltmeister: ${preview.constructorChampion?.teamName || '—'}\nDanach wird automatisch eine neue Saison angelegt.`,
      keyword: 'SAISON'
    });
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
    const nextSeasonGameKey = getSelectedSeasonGameKey();
    const nextSeasonGameLabel = resolveSeasonGameLabel(nextSeasonGameKey);
    let createResponse = await window.supabaseClient
      .from('seasons')
      .insert([{
        name: `Saison ${nextSeasonNumber}`,
        is_active: true,
        game_key: nextSeasonGameKey,
        game_label: nextSeasonGameLabel
      }])
      .select()
      .single();

    if (createResponse.error && createResponse.error.code === 'PGRST204') {
      createResponse = await window.supabaseClient
        .from('seasons')
        .insert([{ name: `Saison ${nextSeasonNumber}`, is_active: true }])
        .select()
        .single();
    }

    if (createResponse.error) throw createResponse.error;

    setValue('csv-preview', '');
    setValue('csv-file', '');
    ['race-grand-prix-name', 'race-circuit-name', 'race-date', 'race-notes'].forEach((id) => setValue(id, ''));
    setValue('race-time', DEFAULT_RACE_TIME);
    setValue('race-status', DEFAULT_RACE_STATUS);
    setValue('race-weather', DEFAULT_RACE_WEATHER);

    clearFeedback('race-feedback');
    clearFeedback('csv-feedback');
    clearFeedback('incident-feedback');

    state.seasonFinalizePreview = null;
    renderSeasonFinalizePreview(null);
    showFeedback('season-feedback', `Neue Saison gestartet (${nextSeasonGameLabel}). ${currentSeason.name} archiviert (${driverChampion || 'kein Fahrer'} / ${constructorChampion || 'kein Team'}). Der Rennkalender der neuen Saison ist jetzt leer.`);
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
  const adminActive = isAdminSession(data?.session || null);
  if (panelEl) panelEl.classList.toggle('hidden', !adminActive);
  if (statusEl) {
    statusEl.textContent = adminActive
      ? `Manuelle Ergebnisbearbeitung aktiv für ${data.session.user.email}`
      : data?.session
        ? 'Eingeloggt, aber ohne Admin-Berechtigung.'
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
  if (feedback && !feedback.hidden && feedback.dataset.level !== 'error' && state.manualResultsDirty) {
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
    const adminActive = isAdminSession(session);
    setAdminOverviewValue('admin-overview-session', adminActive ? 'Admin aktiv' : (session ? 'Login ohne Admin-Rechte' : 'Nicht eingeloggt'));
    setAdminOverviewValue('admin-overview-session-sub', session?.user?.email || 'Bitte Admin-Login prüfen');
  } catch (error) {
    console.error(error);
  }
}

function initAdminMobileTabs() {
  const tabsRoot = document.getElementById('admin-mobile-tabs');
  if (!tabsRoot || tabsRoot.dataset.bound === 'true') return;

  const buttons = [...tabsRoot.querySelectorAll('[data-admin-tab-target]')];
  const sections = buttons
    .map((button) => document.getElementById(button.dataset.adminTabTarget))
    .filter(Boolean);
  if (!buttons.length || !sections.length) return;

  const setActiveTab = (targetId) => {
    state.activeAdminTabTarget = targetId;
    buttons.forEach((button) => {
      const active = button.dataset.adminTabTarget === targetId;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    sections.forEach((section) => {
      const isTarget = section.id === targetId;
      section.hidden = !isTarget;
      if (isTarget && section.tagName === 'DETAILS') {
        section.open = true;
      }
    });
  };

  const syncVisibility = () => {
    const activeBtn = buttons.find((button) => button.dataset.adminTabTarget === state.activeAdminTabTarget)
      || buttons.find((button) => button.classList.contains('is-active'))
      || buttons[0];
    if (activeBtn) setActiveTab(activeBtn.dataset.adminTabTarget);
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.adminTabTarget));
  });
  syncVisibility();

  tabsRoot.dataset.bound = 'true';
}

function syncAdminTabVisibility() {
  const tabsRoot = document.getElementById('admin-mobile-tabs');
  if (!tabsRoot) return;
  const buttons = [...tabsRoot.querySelectorAll('[data-admin-tab-target]')];
  if (!buttons.length) return;
  const preferred = buttons.find((button) => button.dataset.adminTabTarget === state.activeAdminTabTarget)
    || buttons[0];
  if (!preferred) return;

  preferred.click();
}

function bindUiEvents() {
  if (state.eventsBound) return;
  state.eventsBound = true;

  document.getElementById('admin-login-btn')?.addEventListener('click', signInAdmin);
  document.getElementById('admin-quick-logout-btn')?.addEventListener('click', signOutAdmin);
  document.getElementById('admin-banner-logout-btn')?.addEventListener('click', signOutAdmin);
  document.getElementById('save-race-btn')?.addEventListener('click', saveRace);
  document.getElementById('delete-race-btn')?.addEventListener('click', deleteRaceFromCalendar);
  document.getElementById('shift-race-btn')?.addEventListener('click', shiftRaceDates);
  document.getElementById('save-driver-btn')?.addEventListener('click', saveDriver);
  document.getElementById('reset-driver-btn')?.addEventListener('click', resetDriverForm);
  document.getElementById('save-incident-btn')?.addEventListener('click', saveStewardIncident);
  document.getElementById('reset-incident-btn')?.addEventListener('click', resetStewardIncidentForm);
  document.getElementById('import-results-btn')?.addEventListener('click', () => importRaceResults({
    previewFieldId: 'csv-preview',
    overwritePublished: document.getElementById('csv-overwrite-published')?.checked
  }));
  document.getElementById('prepare-season-finalize-btn')?.addEventListener('click', prepareSeasonFinalize);
  document.getElementById('start-new-season-btn')?.addEventListener('click', startNewSeason);
  document.getElementById('season-game-select')?.addEventListener('change', () => {
    populateDriverDropdowns();
    setValue('driver-ai-reference', '');
    setValue('driver-car-name', '');
  });
  document.getElementById('generate-season-btn')?.addEventListener('click', createRandomSeason);
  document.getElementById('save-rules-btn')?.addEventListener('click', saveRulesContent);
  document.getElementById('add-faq-btn')?.addEventListener('click', addFaqEditorItem);
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

  document.getElementById('driver-swap-confirm-btn')?.addEventListener('click', swapDriverVehicle);
  document.getElementById('driver-swap-cancel-btn')?.addEventListener('click', closeDriverSwapModal);
  document.getElementById('driver-swap-backdrop')?.addEventListener('click', closeDriverSwapModal);

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

    const deleteFaqBtn = event.target.closest('.delete-faq-btn');
    if (deleteFaqBtn) {
      removeFaqEditorItem(deleteFaqBtn.dataset.faqId || '');
      return;
    }

    const deleteBtn = event.target.closest('.delete-driver-btn');
    if (deleteBtn) {
      deleteDriver(deleteBtn.dataset.id || '', deleteBtn.dataset.displayName || '');
      return;
    }

    const swapBtn = event.target.closest('.swap-driver-btn');
    if (swapBtn) {
      clearFeedback('driver-swap-feedback');
      openDriverSwapModal(swapBtn.dataset.id || '');
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
      return;
    }

    const editIncidentBtn = event.target.closest('.edit-incident-btn');
    if (editIncidentBtn) {
      editStewardIncident(editIncidentBtn.dataset.id || '');
      return;
    }

    const deleteIncidentBtn = event.target.closest('.delete-incident-btn');
    if (deleteIncidentBtn) {
      deleteStewardIncident(deleteIncidentBtn.dataset.id || '');
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

  document.querySelector('.section-header')?.setAttribute('hidden', 'hidden');
  document.getElementById('admin-mobile-tabs')?.setAttribute('hidden', 'hidden');
  document.querySelectorAll('.admin-layout > .panel:not(#admin-section-auth)').forEach((panel) => {
    panel.setAttribute('hidden', 'hidden');
  });

  populateDriverDropdowns();
  bindUiEvents();
  bindAuthListener();
  initAdminMobileTabs();

  await Promise.all([
    populateStewardDriverSelects(),
    loadStewardCasesForAdmin(),
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
