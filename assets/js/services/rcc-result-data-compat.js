(() => {
  const data = window.RCCData;
  if (!data || data.__resultDataCompatApplied) return;

  const originalBuildStandings = typeof data.buildStandings === 'function'
    ? data.buildStandings.bind(data)
    : null;

  function numeric(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function getFastestLapMs(row) {
    const explicit = [row?.fastest_lap_time_ms, row?.fastest_lap_ms]
      .map((value) => numeric(value, null))
      .find((value) => Number.isFinite(value) && value > 0);
    if (Number.isFinite(explicit)) return explicit;

    const textual = [row?.fastest_lap_time, row?.fastest_lap]
      .map((value) => data.parseLapTimeToMs?.(value))
      .find((value) => Number.isFinite(value) && value > 0);
    return Number.isFinite(textual) ? textual : null;
  }

  function getFastestLapDriverId(rows = []) {
    let winnerId = null;
    let bestMs = Infinity;
    for (const row of rows || []) {
      const lapMs = getFastestLapMs(row);
      if (!Number.isFinite(lapMs) || lapMs <= 0 || lapMs >= bestMs) continue;
      bestMs = lapMs;
      winnerId = row?.driver_id || null;
    }
    return winnerId;
  }

  function getAwardedRacePoints(row, fastestLapDriverId = null) {
    const finalPoints = numeric(row?.awarded_points, null);
    if (Number.isFinite(finalPoints)) return finalPoints;

    const base = numeric(row?.points, numeric(row?.base_points, 0)) || 0;
    const position = numeric(row?.finish_position, null);
    const bonus = fastestLapDriverId
      && row?.driver_id === fastestLapDriverId
      && Number.isFinite(position)
      && position >= 1
      && position <= 10
      ? 1
      : 0;
    return base + bonus;
  }

  function rebuildStandings(args = {}) {
    if (!originalBuildStandings) return { driverStandings: [], teamStandings: [] };

    const raceResults = Array.isArray(args.raceResults) ? args.raceResults : [];
    const clonedResults = raceResults.map((row) => ({
      ...row,
      // Legacy RCC rows store the authoritative final score in awarded_points.
      // Keep the original standings implementation from adding another FL bonus.
      points: getAwardedRacePoints(row),
      fastest_lap: null,
      fastest_lap_ms: null
    }));

    const built = originalBuildStandings({ ...args, raceResults: clonedResults });
    const validRaceIds = new Set((args.races || []).map((race) => race.id));
    const byRace = new Map();

    raceResults.forEach((row) => {
      if (!validRaceIds.has(row.race_id)) return;
      if (!byRace.has(row.race_id)) byRace.set(row.race_id, []);
      byRace.get(row.race_id).push(row);
    });

    const fastestLapsByOwner = new Map();
    byRace.forEach((rows) => {
      const fastestId = getFastestLapDriverId(rows);
      if (!fastestId) return;
      const winnerRow = rows.find((row) => String(row.driver_id) === String(fastestId));
      if (!winnerRow) return;
      const ownerId = winnerRow.points_owner_driver_id || winnerRow.driver_id;
      fastestLapsByOwner.set(ownerId, (fastestLapsByOwner.get(ownerId) || 0) + 1);
    });

    (built.driverStandings || []).forEach((entry) => {
      entry.fastestLaps = fastestLapsByOwner.get(entry.driverId) || 0;
    });

    built.driverStandings?.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.podiums !== a.podiums) return b.podiums - a.podiums;
      if (b.fastestLaps !== a.fastestLaps) return b.fastestLaps - a.fastestLaps;
      return String(a.normalizedName || a.driverName || '').localeCompare(String(b.normalizedName || b.driverName || ''), 'de');
    });

    return built;
  }

  data.getFastestLapMs = getFastestLapMs;
  data.getFastestLapDriverId = getFastestLapDriverId;
  data.getAwardedRacePoints = getAwardedRacePoints;
  data.buildStandings = rebuildStandings;
  data.__resultDataCompatApplied = true;
})();
