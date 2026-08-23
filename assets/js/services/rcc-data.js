function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

const RCC_QUERY_CACHE_PREFIX = 'rcc_query_cache_v3';
const RCC_DATA_DEFAULT_LEAGUE_SLUG = 'rcc';
const QUERY_CACHE_TTL = {
  season: 1000 * 60 * 5,
  seasons: 1000 * 60 * 15,
  seasonHistory: 1000 * 60 * 30,
  drivers: 1000 * 60 * 15,
  races: 1000 * 60 * 5,
  raceByRound: 1000 * 60 * 5,
  raceResults: 1000 * 60,
  stewardCases: 1000 * 60,
  leagueContent: 1000 * 60 * 5
};

const DATA_SELECT = {
  seasons: 'id,slug,name,championship_code,description,start_date,end_date,is_active,created_at,game_key,game_label,league_id',
  seasonHistory: 'id,season_id,driver_champion,constructor_champion,finalized_at,snapshot,created_at,season_name,driver_champion_team,constructor_champion_lineup',
  drivers: 'id,display_name,gamertag,real_name,nationality_code,number,is_active,ai_driver_reference,car_name,league_team,nationality,avatar_url,league_id',
  races: 'id,season_id,round_number,grand_prix_name,circuit_name,country_code,weekend_start_date,race_date,race_start_at,weather,track_image,status,race_order,race_time,has_sprint',
  raceResults: 'id,race_id,driver_id,team_id,source_assignment_id,car_name_snapshot,ai_driver_reference_snapshot,grid_position,finish_position,race_time_ms,fastest_lap_time_ms,pit_stops,participation_status,base_points,penalty_time_delta_ms,awarded_points,fastest_lap_time,race_time,points_owner_driver_id,points_team_name,points_car_name,points,fastest_lap_ms',
  stewardCases: 'id,race_id,title,description,reported_driver_id,accused_driver_id,status,rule_code,rule_version,created_by,created_at,closed_at,current_decision_version'
};

const DATA_LIMITS = {
  seasons: 100,
  seasonHistory: 100,
  drivers: 500,
  races: 100,
  raceResultsPage: 1000,
  raceResultsMaxPages: 5,
  stewardCases: 500
};

const inflightRequests = new Map();

function normalizeLeagueSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '') || RCC_DATA_DEFAULT_LEAGUE_SLUG;
}

function getRequestedLeagueSlug() {
  if (window.RCCLeagueContext?.getRequestedLeagueSlug) {
    return normalizeLeagueSlug(window.RCCLeagueContext.getRequestedLeagueSlug());
  }

  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get('league');
  if (querySlug) return normalizeLeagueSlug(querySlug);

  const pathMatch = window.location.pathname.match(/(?:^|\/)l\/([a-z0-9-]+)(?:\/|$)/i);
  if (pathMatch?.[1]) return normalizeLeagueSlug(pathMatch[1]);

  return RCC_DATA_DEFAULT_LEAGUE_SLUG;
}

async function getLeagueContext(options = {}) {
  if (!window.RCCLeagueContext?.initialize) {
    throw new Error('RCC LeagueContext is unavailable. Load supabase-client.js before rcc-data.js.');
  }
  return window.RCCLeagueContext.initialize(options);
}

async function getActiveLeagueId(options = {}) {
  const context = await getLeagueContext(options);
  if (!context?.leagueId) throw new Error('No active league context available.');
  return context.leagueId;
}

function normalizeCacheParam(value) {
  if (!Array.isArray(value)) return String(value);
  return [...new Set(value.map((item) => String(item)).filter(Boolean))].sort().join(',');
}

function buildCacheKey(scope, params = {}) {
  const leagueSlug = normalizeLeagueSlug(params.leagueSlug || getRequestedLeagueSlug());
  const stableParams = Object.entries(params)
    .filter(([key, value]) => key !== 'leagueSlug' && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${normalizeCacheParam(value)}`)
    .join('|');
  return `${RCC_QUERY_CACHE_PREFIX}:${leagueSlug}:${scope}${stableParams ? `:${stableParams}` : ''}`;
}

function readCachedValue(key, ttlMs) {
  try {
    const raw = window.localStorage?.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - Number(parsed.timestamp || 0) > ttlMs) return null;
    return parsed.value ?? null;
  } catch (_error) {
    return null;
  }
}

function writeCachedValue(key, value) {
  try {
    window.localStorage?.setItem(key, JSON.stringify({ timestamp: Date.now(), value }));
  } catch (_error) {
    // Local cache is optional.
  }
}

function removeCachedValue(key) {
  try {
    window.localStorage?.removeItem(key);
  } catch (_error) {
    // Local cache is optional.
  }
}

function invalidateCache(scope, params = {}) {
  removeCachedValue(buildCacheKey(scope, params));
}

function clearTenantQueryCache() {
  const prefix = `${RCC_QUERY_CACHE_PREFIX}:${normalizeLeagueSlug(getRequestedLeagueSlug())}:`;
  try {
    const storage = window.localStorage;
    if (!storage) return;
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch (_error) {
    // Local cache is optional.
  }
}

async function fetchWithLocalCache({ scope, params = {}, ttlMs, forceRefresh = false, backgroundRefresh = false, fetcher }) {
  const key = buildCacheKey(scope, params);
  const cached = forceRefresh ? null : readCachedValue(key, ttlMs);

  const runFetch = async () => {
    if (inflightRequests.has(key)) return inflightRequests.get(key);
    const promise = Promise.resolve()
      .then(fetcher)
      .then((value) => {
        writeCachedValue(key, value);
        return value;
      })
      .finally(() => inflightRequests.delete(key));
    inflightRequests.set(key, promise);
    return promise;
  };

  if (cached !== null) {
    if (backgroundRefresh === true) {
      runFetch().catch((error) => console.warn(`RCCData background refresh failed for ${scope}`, error));
    }
    return cached;
  }
  return runFetch();
}

function normalizeDriverName(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseLapTimeToMs(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const match = text.match(/^(?:(\d+):)?(\d{1,2})[.,:](\d{1,3})$/);
  if (!match) return null;
  const minutes = Number(match[1] || 0);
  const seconds = Number(match[2] || 0);
  const millis = Number(String(match[3]).padEnd(3, '0').slice(0, 3));
  return (minutes * 60 + seconds) * 1000 + millis;
}

function isTopTen(position) {
  const value = safeNumber(position, null);
  return Number.isFinite(value) && value >= 1 && value <= 10;
}

function getFastestLapMs(row) {
  const explicit = safeNumber(row?.fastest_lap_ms, null);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const canonical = safeNumber(row?.fastest_lap_time_ms, null);
  if (Number.isFinite(canonical) && canonical > 0) return canonical;
  return parseLapTimeToMs(row?.fastest_lap_time || row?.fastest_lap);
}

function getFastestLapDriverId(rows = []) {
  let winner = null;
  let best = Infinity;
  for (const row of rows) {
    if (!isTopTen(row?.finish_position)) continue;
    const lap = getFastestLapMs(row);
    if (!Number.isFinite(lap) || lap <= 0 || lap >= best) continue;
    best = lap;
    winner = row?.driver_id || null;
  }
  return winner;
}

function getAwardedRacePoints(row, fastestLapDriverId = null) {
  const base = safeNumber(row?.points ?? row?.awarded_points, 0);
  const bonus = fastestLapDriverId && row?.driver_id === fastestLapDriverId && isTopTen(row?.finish_position) ? 1 : 0;
  return base + bonus;
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items || []) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

async function fetchCurrentSeason(options = {}) {
  const client = window.supabaseClient;
  if (!client) return null;
  const leagueId = await getActiveLeagueId();
  return fetchWithLocalCache({
    scope: 'currentSeason',
    ttlMs: QUERY_CACHE_TTL.season,
    forceRefresh: options.forceRefresh === true,
    backgroundRefresh: options.backgroundRefresh === true,
    fetcher: async () => {
      const { data, error } = await client
        .from('seasons')
        .select(DATA_SELECT.seasons)
        .eq('league_id', leagueId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
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
  const leagueId = await getActiveLeagueId();
  return fetchWithLocalCache({
    scope: 'seasons',
    ttlMs: QUERY_CACHE_TTL.seasons,
    forceRefresh: options.forceRefresh === true,
    backgroundRefresh: options.backgroundRefresh === true,
    fetcher: async () => {
      const { data, error } = await client
        .from('seasons')
        .select(DATA_SELECT.seasons)
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false })
        .limit(DATA_LIMITS.seasons);
      if (error) throw error;
      return data || [];
    }
  });
}

async function fetchSeasonHistory(options = {}) {
  const client = window.supabaseClient;
  if (!client) return [];
  const seasons = await fetchSeasons({
    forceRefresh: options.forceRefresh === true,
    backgroundRefresh: false
  });
  const seasonIds = seasons.map((season) => season.id).filter(Boolean);
  if (!seasonIds.length) return [];

  return fetchWithLocalCache({
    scope: 'seasonHistory',
    params: { seasonIds },
    ttlMs: QUERY_CACHE_TTL.seasonHistory,
    forceRefresh: options.forceRefresh === true,
    backgroundRefresh: options.backgroundRefresh === true,
    fetcher: async () => {
      const { data, error } = await client
        .from('championship_history')
        .select(DATA_SELECT.seasonHistory)
        .in('season_id', seasonIds)
        .order('finalized_at', { ascending: false })
        .limit(DATA_LIMITS.seasonHistory);
      if (error) throw error;
      return data || [];
    }
  });
}

async function fetchDrivers(options = {}) {
  const client = window.supabaseClient;
  if (!client) return [];
  const leagueId = await getActiveLeagueId();
  return fetchWithLocalCache({
    scope: 'drivers',
    ttlMs: QUERY_CACHE_TTL.drivers,
    forceRefresh: options.forceRefresh === true,
    backgroundRefresh: options.backgroundRefresh === true,
    fetcher: async () => {
      const { data, error } = await client
        .from('drivers')
        .select(DATA_SELECT.drivers)
        .eq('league_id', leagueId)
        .order('display_name')
        .limit(DATA_LIMITS.drivers);
      if (error) throw error;
      return data || [];
    }
  });
}

async function fetchRaces(options = {}) {
  const client = window.supabaseClient;
  if (!client) return [];
  const seasonId = options.seasonId || null;
  if (!seasonId) return [];
  return fetchWithLocalCache({
    scope: 'races',
    params: { seasonId },
    ttlMs: QUERY_CACHE_TTL.races,
    forceRefresh: options.forceRefresh === true,
    backgroundRefresh: options.backgroundRefresh === true,
    fetcher: async () => {
      const { data, error } = await client
        .from('races')
        .select(DATA_SELECT.races)
        .eq('season_id', seasonId)
        .order('round_number')
        .limit(DATA_LIMITS.races);
      if (error) throw error;
      return data || [];
    }
  });
}

async function fetchRaceByRound(roundNumber, options = {}) {
  const seasonId = options.seasonId || (await fetchCurrentSeason())?.id;
  if (!seasonId) return null;
  const rows = await fetchRaces({
    seasonId,
    forceRefresh: options.forceRefresh === true,
    backgroundRefresh: options.backgroundRefresh === true
  });
  return rows.find((row) => Number(row.round_number) === Number(roundNumber)) || null;
}

async function queryRaceResultsPaged(client, raceIds) {
  const rows = [];
  for (let page = 0; page < DATA_LIMITS.raceResultsMaxPages; page += 1) {
    const from = page * DATA_LIMITS.raceResultsPage;
    const to = from + DATA_LIMITS.raceResultsPage - 1;
    const { data, error } = await client
      .from('race_results')
      .select(DATA_SELECT.raceResults)
      .in('race_id', raceIds)
      .order('race_id', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw error;
    const pageRows = data || [];
    rows.push(...pageRows);
    if (pageRows.length < DATA_LIMITS.raceResultsPage) break;
  }
  return rows;
}

async function fetchRaceResults(options = {}) {
  const client = window.supabaseClient;
  if (!client) return [];
  const raceIds = [...new Set((options.raceIds || (options.raceId ? [options.raceId] : [])).filter(Boolean))].sort();
  if (!raceIds.length) return [];
  return fetchWithLocalCache({
    scope: 'raceResults',
    params: { raceIds },
    ttlMs: QUERY_CACHE_TTL.raceResults,
    forceRefresh: options.forceRefresh === true,
    backgroundRefresh: options.backgroundRefresh === true,
    fetcher: () => queryRaceResultsPaged(client, raceIds)
  });
}

async function fetchStewardCasesByRaceId(raceId, options = {}) {
  const client = window.supabaseClient;
  if (!client || !raceId) return [];
  return fetchWithLocalCache({
    scope: 'stewardCases',
    params: { raceId },
    ttlMs: QUERY_CACHE_TTL.stewardCases,
    forceRefresh: options.forceRefresh === true,
    backgroundRefresh: options.backgroundRefresh === true,
    fetcher: async () => {
      const { data, error } = await client
        .from('steward_cases')
        .select(DATA_SELECT.stewardCases)
        .eq('race_id', raceId)
        .order('created_at', { ascending: false })
        .limit(DATA_LIMITS.stewardCases);
      if (error) throw error;
      return data || [];
    }
  });
}

const DEFAULT_LEAGUE_CONTENT = {
  rules_text: '', faq_text: '', rules_config: {}, faq_items: []
};

async function fetchLeagueContent(options = {}) {
  const client = window.supabaseClient;
  if (!client) return { ...DEFAULT_LEAGUE_CONTENT };
  const leagueId = await getActiveLeagueId();

  return fetchWithLocalCache({
    scope: 'leagueContent',
    ttlMs: QUERY_CACHE_TTL.leagueContent,
    forceRefresh: options.forceRefresh === true,
    backgroundRefresh: options.backgroundRefresh === true,
    fetcher: async () => {
      const { data, error } = await client
        .from('leagues')
        .select('id, settings, updated_at')
        .eq('id', leagueId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return { ...DEFAULT_LEAGUE_CONTENT };
      const settings = data.settings && typeof data.settings === 'object' ? data.settings : {};
      return {
        ...DEFAULT_LEAGUE_CONTENT,
        id: 'default',
        league_id: data.id,
        updated_at: data.updated_at,
        rules_text: typeof settings.rules_text === 'string' ? settings.rules_text : '',
        faq_text: typeof settings.faq_text === 'string' ? settings.faq_text : '',
        rules_config: settings.rules && typeof settings.rules === 'object' ? settings.rules : {},
        faq_items: Array.isArray(settings.faqs) ? settings.faqs : []
      };
    }
  });
}

function hasFreshDashboardCache() {
  const currentSeason = readCachedValue(buildCacheKey('currentSeason'), QUERY_CACHE_TTL.season);
  if (!currentSeason?.id) return false;

  const races = readCachedValue(buildCacheKey('races', { seasonId: currentSeason.id }), QUERY_CACHE_TTL.races);
  const drivers = readCachedValue(buildCacheKey('drivers'), QUERY_CACHE_TTL.drivers);
  if (!Array.isArray(races) || !Array.isArray(drivers)) return false;

  const raceIds = races.map((race) => race.id).filter(Boolean).sort();
  if (!raceIds.length) return true;
  const raceResults = readCachedValue(buildCacheKey('raceResults', { raceIds }), QUERY_CACHE_TTL.raceResults);
  return Array.isArray(raceResults);
}

async function warmDashboardCache(options = {}) {
  await getLeagueContext();
  const currentSeason = await fetchCurrentSeason({ backgroundRefresh: false });
  const races = await fetchRaces({ seasonId: currentSeason?.id, backgroundRefresh: false });
  await Promise.all([
    fetchDrivers({ backgroundRefresh: false }),
    fetchRaceResults({ raceIds: races.map((race) => race.id), backgroundRefresh: false })
  ]);

  if (options.revalidate === true) {
    await Promise.all([
      fetchCurrentSeason({ forceRefresh: true }),
      fetchDrivers({ forceRefresh: true }),
      currentSeason?.id ? fetchRaces({ seasonId: currentSeason.id, forceRefresh: true }) : Promise.resolve([])
    ]);
  }
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
  getLeagueContext,
  getActiveLeagueId,
  getRequestedLeagueSlug,
  fetchCurrentSeason,
  fetchSeasons,
  fetchSeasonHistory,
  fetchDrivers,
  fetchRaces,
  fetchRaceByRound,
  fetchRaceResults,
  fetchStewardCasesByRaceId,
  fetchLeagueContent,
  hasFreshDashboardCache,
  warmDashboardCache,
  buildStandings,
  buildCacheKey,
  readCachedValue,
  invalidateCache,
  clearTenantQueryCache,
  QUERY_CACHE_TTL,
  DATA_LIMITS
};
