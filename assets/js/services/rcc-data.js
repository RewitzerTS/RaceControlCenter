function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

const RCC_QUERY_CACHE_PREFIX = 'rcc_query_cache_v1';
const QUERY_CACHE_TTL = {
  season: 1000 * 60 * 60 * 12,
  seasons: 1000 * 60 * 60 * 12,
  seasonHistory: 1000 * 60 * 60 * 24,
  drivers: 1000 * 60 * 60 * 24,
  races: 1000 * 60 * 60 * 6,
  raceResults: 1000 * 60 * 60 * 2,
  leagueContent: 1000 * 60 * 30
};

function buildCacheKey(scope, params = null) {
  const serializedParams = params ? JSON.stringify(params) : '';
  return `${RCC_QUERY_CACHE_PREFIX}:${scope}:${serializedParams}`;
}

function readCachedValue(cacheKey, maxAgeMs) {
  if (!window.localStorage) return null;
  if (!cacheKey || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return null;

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cachedAt = Number(parsed?.cachedAt);
    if (!Number.isFinite(cachedAt)) return null;
    if (Date.now() - cachedAt > maxAgeMs) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCachedValue(cacheKey, value) {
  if (!window.localStorage) return;
  if (!cacheKey) return;

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify({
      cachedAt: Date.now(),
      value
    }));
  } catch {
    // Lokaler Storage kann z.B. im Private-Mode oder bei Quota-Limits scheitern.
  }
}

async function fetchWithLocalCache({ scope, params = null, ttlMs = 0, forceRefresh = false, fetcher }) {
  const cacheKey = buildCacheKey(scope, params);

  if (!forceRefresh) {
    const cachedValue = readCachedValue(cacheKey, ttlMs);
    if (cachedValue !== null && cachedValue !== undefined) return cachedValue;
  }

  const freshValue = await fetcher();
  writeCachedValue(cacheKey, freshValue);
  return freshValue;
}

function normalizeDriverName(value) {
  return String(value ?? '')
    .trim()
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã¤/g, 'ä')
    .replace(/ÃŸ/g, 'ß')
    .replace(/Ã©/g, 'é')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseLapTimeToMs(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const text = raw.replace(',', '.');
  const parts = text.split(':').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;

  const numeric = parts.map((part) => Number(part));
  if (numeric.some((part) => !Number.isFinite(part))) return null;

  if (parts.length === 3) {
    const [hours, minutes, seconds] = numeric;
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  }

  if (parts.length === 2) {
    const [minutes, seconds] = numeric;
    return Math.round((minutes * 60 + seconds) * 1000);
  }

  return Math.round(numeric[0] * 1000);
}

function isTopTen(position) {
  const pos = Number(position);
  return Number.isFinite(pos) && pos >= 1 && pos <= 10;
}

function groupBy(items, getKey) {
  return items.reduce((map, item) => {
    const key = getKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

function getFastestLapMs(row) {
  const explicitMs = Number(row?.fastest_lap_time_ms);
  if (Number.isFinite(explicitMs) && explicitMs > 0) return explicitMs;
  return parseLapTimeToMs(row?.fastest_lap_time);
}

function getFastestLapDriverId(rows) {
  let winner = null;
  let bestTime = null;

  for (const row of rows) {
    const lapTime = getFastestLapMs(row);
    if (lapTime === null) continue;
    if (bestTime === null || lapTime < bestTime) {
      bestTime = lapTime;
      winner = row.driver_id;
    }
  }

  return winner;
}

function getBasePointsForPosition(position) {
  const table = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const pos = safeNumber(position, 0);
  return table[pos - 1] || 0;
}

function getAwardedRacePoints(row, fastestLapDriverId = null) {
  const storedPoints = Number(row?.awarded_points);
  if (Number.isFinite(storedPoints)) return storedPoints;

  const position = safeNumber(row?.finish_position, 0);
  const basePoints = getBasePointsForPosition(position);
  const hasFastestLapBonus = Boolean(
    fastestLapDriverId
    && row?.driver_id === fastestLapDriverId
    && isTopTen(position)
  );

  return basePoints + (hasFastestLapBonus ? 1 : 0);
}

async function fetchCurrentSeason(options = {}) {
  const client = window.supabaseClient;
  if (!client) return null;

  return fetchWithLocalCache({
    scope: 'currentSeason',
    ttlMs: QUERY_CACHE_TTL.season,
    forceRefresh: options.forceRefresh === true,
    fetcher: async () => {
      const { data, error } = await client
        .from('seasons')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    }
  });
}

async function fetchSeasons(options = {}) {
  const client = window.supabaseClient;
  if (!client) return [];

  const queryScope = {
    archivedOnly: options.archivedOnly === true,
    activeOnly: options.activeOnly === true
  };

  return fetchWithLocalCache({
    scope: 'seasons',
    params: queryScope,
    ttlMs: QUERY_CACHE_TTL.seasons,
    forceRefresh: options.forceRefresh === true,
    fetcher: async () => {
      let query = client
        .from('seasons')
        .select('id, name, is_active, created_at')
        .order('id', { ascending: false });

      if (options.archivedOnly) query = query.eq('is_active', false);
      if (options.activeOnly) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });
}

async function fetchSeasonHistory(limit = 6, options = {}) {
  const client = window.supabaseClient;
  if (!client) return [];

  return fetchWithLocalCache({
    scope: 'seasonHistory',
    params: { limit },
    ttlMs: QUERY_CACHE_TTL.seasonHistory,
    forceRefresh: options.forceRefresh === true,
    fetcher: async () => {
      const { data, error } = await client
        .from('championship_history')
        .select('season_id, season_name, driver_champion, constructor_champion, constructor_champion_lineup, created_at, seasons:season_id(name)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    }
  });
}

async function fetchDrivers(options = {}) {
  const client = window.supabaseClient;
  if (!client) return [];

  return fetchWithLocalCache({
    scope: 'drivers',
    ttlMs: QUERY_CACHE_TTL.drivers,
    forceRefresh: options.forceRefresh === true,
    fetcher: async () => {
      const { data, error } = await client
        .from('drivers')
        .select('id, display_name, gamertag, ai_driver_reference, league_team, car_name')
        .order('display_name', { ascending: true });

      if (error) throw error;

      return (data || []).map((driver) => ({
        ...driver,
        normalized_display_name: normalizeDriverName(driver.display_name),
        normalized_gamertag: normalizeDriverName(driver.gamertag),
        normalized_ai_driver_reference: normalizeDriverName(driver.ai_driver_reference)
      }));
    }
  });
}

async function fetchRaces(options = {}) {
  const client = window.supabaseClient;
  if (!client) return [];

  const queryScope = {
    seasonId: options.seasonId ?? null
  };

  return fetchWithLocalCache({
    scope: 'races',
    params: queryScope,
    ttlMs: QUERY_CACHE_TTL.races,
    forceRefresh: options.forceRefresh === true,
    fetcher: async () => {
      let query = client.from('races').select('*').order('round_number', { ascending: true });
      if (options.seasonId !== undefined && options.seasonId !== null) query = query.eq('season_id', options.seasonId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });
}

async function fetchRaceResults(options = {}) {
  const client = window.supabaseClient;
  if (!client) return [];

  const raceIds = Array.isArray(options.raceIds) ? [...options.raceIds].sort() : [];
  const queryScope = {
    raceId: options.raceId ?? null,
    raceIds
  };

  return fetchWithLocalCache({
    scope: 'raceResults',
    params: queryScope,
    ttlMs: QUERY_CACHE_TTL.raceResults,
    forceRefresh: options.forceRefresh === true,
    fetcher: async () => {
      let query = client.from('race_results').select('*');
      if (options.raceId) query = query.eq('race_id', options.raceId);
      if (options.raceIds?.length) query = query.in('race_id', options.raceIds);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });
}

const DEFAULT_LEAGUE_CONTENT = {
  id: 'default',
  rules_text: '',
  faq_text: '',
  rules_config: {},
  faq_items: []
};

async function fetchLeagueContent(options = {}) {
  const client = window.supabaseClient;
  if (!client) return { ...DEFAULT_LEAGUE_CONTENT };

  return fetchWithLocalCache({
    scope: 'leagueContent',
    ttlMs: QUERY_CACHE_TTL.leagueContent,
    forceRefresh: options.forceRefresh === true,
    fetcher: async () => {
      const { data, error } = await client
        .from('league_content')
        .select('id, rules_text, faq_text, rules_config, faq_items, updated_at')
        .eq('id', 'default')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return { ...DEFAULT_LEAGUE_CONTENT };
      return {
        ...DEFAULT_LEAGUE_CONTENT,
        ...data,
        rules_config: data.rules_config && typeof data.rules_config === 'object' ? data.rules_config : {},
        faq_items: Array.isArray(data.faq_items) ? data.faq_items : []
      };
    }
  });
}


function hasFreshDashboardCache() {
  const currentSeason = readCachedValue(buildCacheKey('currentSeason'), QUERY_CACHE_TTL.season);
  if (!currentSeason?.id) return false;

  const races = readCachedValue(buildCacheKey('races', { seasonId: currentSeason.id }), QUERY_CACHE_TTL.races);
  const drivers = readCachedValue(buildCacheKey('drivers'), QUERY_CACHE_TTL.drivers);
  const raceResults = readCachedValue(buildCacheKey('raceResults', { raceId: null, raceIds: [] }), QUERY_CACHE_TTL.raceResults);

  return Array.isArray(races) && Array.isArray(drivers) && Array.isArray(raceResults);
}

async function warmDashboardCache() {
  const currentSeason = await fetchCurrentSeason();
  await Promise.all([
    fetchDrivers(),
    fetchRaces({ seasonId: currentSeason?.id }),
    fetchRaceResults()
  ]);
}
function buildStandings({ drivers, races, raceResults, resolver } = {}) {
  const raceIds = new Set((races || []).map((race) => race.id));
  const scopedResults = (raceResults || []).filter((row) => raceIds.has(row.race_id));
  const resultsByRace = groupBy(scopedResults, (row) => row.race_id);
  const fastestLapWinnerByRace = new Map();

  for (const [raceId, rows] of resultsByRace.entries()) {
    const winner = getFastestLapDriverId(rows);
    if (winner) fastestLapWinnerByRace.set(raceId, winner);
  }

  const driversMap = new Map();
  const teamsMap = new Map();
  const baseDriversById = new Map((drivers || []).map((driver) => [driver.id, driver]));

  function getOrCreateDriverEntry(driverId, raceId = null) {
    if (driversMap.has(driverId)) return driversMap.get(driverId);

    const baseDriver = baseDriversById.get(driverId);
    const snapshot = resolver?.resolveDriverSnapshot(driverId, raceId) || baseDriver;
    if (!snapshot) return null;

    const entry = {
      driverId: snapshot.id,
      driverName: snapshot.display_name || 'Unbekannt',
      normalizedName: normalizeDriverName(snapshot.display_name),
      leagueTeam: snapshot.league_team || 'Ohne Team',
      carName: snapshot.car_name || '—',
      wins: 0,
      podiums: 0,
      fastestLaps: 0,
      points: 0
    };
    driversMap.set(driverId, entry);
    return entry;
  }

  for (const driver of drivers || []) {
    getOrCreateDriverEntry(driver.id, races?.[0]?.id || null);
  }

  for (const row of scopedResults) {
    const sourceDriverId = row.driver_id;
    const pointsOwnerDriverId = row.points_owner_driver_id || sourceDriverId;
    const snapshot = resolver?.resolveDriverSnapshot(sourceDriverId, row.race_id) || baseDriversById.get(sourceDriverId);
    if (!snapshot?.id) continue;

    const driverEntry = getOrCreateDriverEntry(pointsOwnerDriverId, row.race_id);
    if (!driverEntry) continue;
    const position = safeNumber(row.finish_position, null);
    const hasFastestLap = fastestLapWinnerByRace.get(row.race_id) === sourceDriverId;
    const points = getAwardedRacePoints(row, fastestLapWinnerByRace.get(row.race_id));

    driverEntry.points += points;
    driverEntry.leagueTeam = row.points_team_name || snapshot.league_team || driverEntry.leagueTeam;
    driverEntry.carName = row.points_car_name || snapshot.car_name || driverEntry.carName;
    if (position === 1) driverEntry.wins += 1;
    if ([1, 2, 3].includes(position)) driverEntry.podiums += 1;
    if (hasFastestLap) driverEntry.fastestLaps += 1;

    const teamName = row.points_team_name || snapshot.league_team || 'Ohne Team';
    if (!teamsMap.has(teamName)) {
      teamsMap.set(teamName, {
        teamName,
        points: 0,
        drivers: new Map()
      });
    }

    const teamEntry = teamsMap.get(teamName);
    teamEntry.points += points;
    if (!teamEntry.drivers.has(snapshot.id)) {
      teamEntry.drivers.set(snapshot.id, {
        name: snapshot.display_name || 'Unbekannt',
        normalizedName: normalizeDriverName(snapshot.display_name),
        car: snapshot.car_name || '—'
      });
    }
  }

  const driverStandings = [...driversMap.values()]
    .filter((entry) => entry.points > 0 || entry.wins > 0 || entry.podiums > 0 || entry.fastestLaps > 0)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.podiums !== a.podiums) return b.podiums - a.podiums;
      if (b.fastestLaps !== a.fastestLaps) return b.fastestLaps - a.fastestLaps;
      return a.normalizedName.localeCompare(b.normalizedName, 'de');
    });

  const teamStandings = [...teamsMap.values()]
    .map((entry) => {
      const driversSorted = [...entry.drivers.values()].sort((a, b) => a.normalizedName.localeCompare(b.normalizedName, 'de'));
      return {
        teamName: entry.teamName,
        points: entry.points,
        driver1: driversSorted[0]?.name || '—',
        car1: driversSorted[0]?.car || '—',
        driver2: driversSorted[1]?.name || '—',
        car2: driversSorted[1]?.car || '—'
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.teamName.localeCompare(b.teamName, 'de', { sensitivity: 'base' });
    });

  return { driverStandings, teamStandings };
}

window.RCCData = {
  safeNumber,
  normalizeDriverName,
  parseLapTimeToMs,
  isTopTen,
  getFastestLapMs,
  getFastestLapDriverId,
  getAwardedRacePoints,
  groupBy,
  fetchCurrentSeason,
  fetchSeasons,
  fetchSeasonHistory,
  fetchDrivers,
  fetchRaces,
  fetchRaceResults,
  fetchLeagueContent,
  hasFreshDashboardCache,
  warmDashboardCache,
  buildStandings
};
