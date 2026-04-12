function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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
    if (lapTime === null || !isTopTen(row?.finish_position)) continue;
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
  const storedPoints = safeNumber(row?.awarded_points, 0);
  const position = safeNumber(row?.finish_position, 0);
  const basePoints = getBasePointsForPosition(position);
  const hasFastestLapBonus = Boolean(
    fastestLapDriverId
    && row?.driver_id === fastestLapDriverId
    && isTopTen(position)
  );

  if (!hasFastestLapBonus) return storedPoints;
  if (storedPoints >= basePoints + 1) return storedPoints;
  if (storedPoints === basePoints) return basePoints + 1;
  return storedPoints;
}

async function fetchCurrentSeason() {
  const client = window.supabaseClient;
  if (!client) return null;

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

async function fetchSeasonHistory(limit = 6) {
  const client = window.supabaseClient;
  if (!client) return [];

  const { data, error } = await client
    .from('championship_history')
    .select('season_id, driver_champion, constructor_champion, created_at, seasons:season_id(name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function fetchDrivers() {
  const { data, error } = await window.supabaseClient
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

async function fetchRaces(options = {}) {
  let query = window.supabaseClient.from('races').select('*').order('round_number', { ascending: true });
  if (options.seasonId !== undefined && options.seasonId !== null) query = query.eq('season_id', options.seasonId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchRaceResults(options = {}) {
  let query = window.supabaseClient.from('race_results').select('*');
  if (options.raceId) query = query.eq('race_id', options.raceId);
  if (options.raceIds?.length) query = query.in('race_id', options.raceIds);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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

  for (const driver of drivers || []) {
    const baseSnapshot = resolver?.resolveDriverSnapshot(driver.id, races?.[0]?.id) || driver;
    driversMap.set(driver.id, {
      driverId: driver.id,
      driverName: driver.display_name || 'Unbekannt',
      normalizedName: normalizeDriverName(driver.display_name),
      leagueTeam: baseSnapshot?.league_team || driver.league_team || 'Ohne Team',
      carName: baseSnapshot?.car_name || driver.car_name || '—',
      wins: 0,
      podiums: 0,
      fastestLaps: 0,
      points: 0
    });
  }

  for (const row of scopedResults) {
    const snapshot = resolver?.resolveDriverSnapshot(row.driver_id, row.race_id) || (drivers || []).find((driver) => driver.id === row.driver_id);
    if (!snapshot?.id) continue;

    const driverEntry = driversMap.get(snapshot.id);
    const position = safeNumber(row.finish_position, null);
    const hasFastestLap = fastestLapWinnerByRace.get(row.race_id) === snapshot.id;
    const points = getAwardedRacePoints(row, fastestLapWinnerByRace.get(row.race_id));

    driverEntry.points += points;
    driverEntry.leagueTeam = snapshot.league_team || driverEntry.leagueTeam;
    driverEntry.carName = snapshot.car_name || driverEntry.carName;
    if (position === 1) driverEntry.wins += 1;
    if ([1, 2, 3].includes(position)) driverEntry.podiums += 1;
    if (hasFastestLap) driverEntry.fastestLaps += 1;

    const teamName = snapshot.league_team || 'Ohne Team';
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
  fetchSeasonHistory,
  fetchDrivers,
  fetchRaces,
  fetchRaceResults,
  buildStandings
};
