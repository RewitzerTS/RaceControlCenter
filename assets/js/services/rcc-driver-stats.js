(() => {
  if (window.RCCDriverStats) return;

  let historyPromise = null;

  const num = (value, fallback = null) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const validPosition = (value) => {
    const parsed = num(value, null);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const average = (values) => {
    const usable = values.filter((value) => Number.isFinite(value));
    if (!usable.length) return null;
    return usable.reduce((sum, value) => sum + value, 0) / usable.length;
  };

  const groupBy = (rows, keyFn) => {
    const result = new Map();
    (rows || []).forEach((row) => {
      const key = keyFn(row);
      if (key === undefined || key === null || key === '') return;
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(row);
    });
    return result;
  };

  const raceSortValue = (race, seasonsById) => {
    const season = seasonsById.get(String(race?.season_id || ''));
    const seasonDate = Date.parse(season?.start_date || season?.created_at || 0) || 0;
    const raceDate = Date.parse(race?.race_date || race?.race_start_at || race?.weekend_start_date || 0) || 0;
    return seasonDate * 1000 + raceDate + Number(race?.round_number || 0);
  };

  function isCompletedRace(race, resultsByRace) {
    const status = window.getRaceLifecycleStatus ? window.getRaceLifecycleStatus(race) : race?.status;
    return status === 'completed' || (resultsByRace.get(race?.id) || []).length > 0;
  }

  function getFastestLapDriverId(rows) {
    return window.RCCData?.getFastestLapDriverId?.(rows || []) || null;
  }

  function getAwardedPoints(row, fastestDriverId) {
    if (window.RCCData?.getAwardedRacePoints) {
      return Number(window.RCCData.getAwardedRacePoints(row, fastestDriverId) || 0);
    }
    return Number(row?.awarded_points ?? row?.points ?? row?.base_points ?? 0) || 0;
  }

  async function fetchOwnProfileNumbers() {
    if (!window.supabaseClient) return new Map();

    const identityResponse = await window.supabaseClient
      .from('driver_identities')
      .select('id, profile_number')
      .maybeSingle();
    if (identityResponse.error || !identityResponse.data) return new Map();

    const linksResponse = await window.supabaseClient
      .from('driver_identity_links')
      .select('driver_id')
      .eq('driver_identity_id', identityResponse.data.id);
    if (linksResponse.error) return new Map();

    const profileNumber = Number(identityResponse.data.profile_number);
    if (!Number.isInteger(profileNumber) || profileNumber < 0 || profileNumber > 99) return new Map();
    return new Map((linksResponse.data || []).map((link) => [String(link.driver_id), profileNumber]));
  }

  async function loadLeagueHistory(options = {}) {
    if (historyPromise && options.forceRefresh !== true) return historyPromise;

    historyPromise = (async () => {
      if (!window.RCCData || !window.RCCDriverContext) {
        throw new Error('RaceVora driver data services are unavailable.');
      }

      const [seasons, drivers, assignments, profileNumbersByDriver] = await Promise.all([
        window.RCCData.fetchSeasons({ forceRefresh: options.forceRefresh === true }),
        window.RCCData.fetchDrivers({ forceRefresh: options.forceRefresh === true }),
        window.RCCDriverContext.fetchDriverSeasonAssignments(),
        fetchOwnProfileNumbers()
      ]);

      const raceGroups = await Promise.all((seasons || []).map(async (season) => {
        const races = await window.RCCData.fetchRaces({ seasonId: season.id, forceRefresh: options.forceRefresh === true });
        return (races || []).map((race) => ({ ...race, season_id: race.season_id || season.id }));
      }));
      const races = raceGroups.flat();
      const raceIds = races.map((race) => race.id).filter(Boolean);

      const raceResults = [];
      const chunkSize = 50;
      for (let offset = 0; offset < raceIds.length; offset += chunkSize) {
        const chunk = raceIds.slice(offset, offset + chunkSize);
        if (!chunk.length) continue;
        const rows = await window.RCCData.fetchRaceResults({ raceIds: chunk, forceRefresh: options.forceRefresh === true });
        raceResults.push(...(rows || []));
      }

      const seasonsById = new Map((seasons || []).map((season) => [String(season.id), season]));
      const driversById = new Map((drivers || []).map((driver) => [String(driver.id), driver]));
      const racesById = new Map((races || []).map((race) => [String(race.id), race]));
      const resultsByRace = groupBy(raceResults, (row) => String(row.race_id || ''));
      const resolver = window.RCCDriverContext.createAssignmentResolver({ drivers, races, assignments });
      const completedRaces = races
        .filter((race) => isCompletedRace(race, resultsByRace))
        .sort((left, right) => raceSortValue(left, seasonsById) - raceSortValue(right, seasonsById));
      const fastestByRace = new Map();
      completedRaces.forEach((race) => {
        fastestByRace.set(String(race.id), getFastestLapDriverId(resultsByRace.get(String(race.id)) || []));
      });

      return {
        seasons: seasons || [],
        drivers: drivers || [],
        assignments: assignments || [],
        races,
        completedRaces,
        raceResults,
        seasonsById,
        driversById,
        racesById,
        resultsByRace,
        fastestByRace,
        profileNumbersByDriver,
        resolver
      };
    })().catch((error) => {
      historyPromise = null;
      throw error;
    });

    return historyPromise;
  }

  function scopedRaces(history, seasonId = null) {
    if (!seasonId) return history.completedRaces || [];
    return (history.completedRaces || []).filter((race) => String(race.season_id) === String(seasonId));
  }

  function actualResultForDriver(rows, driverId) {
    const id = String(driverId || '');
    return (rows || []).find((row) => String(row.driver_id || '') === id) || null;
  }

  function pointsOwnerId(row) {
    return String(row?.points_owner_driver_id || row?.driver_id || '');
  }

  function driverDisplaySnapshot(history, driverId, raceId) {
    return history.resolver?.resolveDriverSnapshot?.(driverId, raceId)
      || history.driversById.get(String(driverId))
      || null;
  }

  function calculateDriverStats(driverId, history, options = {}) {
    const id = String(driverId || '');
    const driver = history.driversById.get(id);
    if (!driver) return null;

    const races = scopedRaces(history, options.seasonId || null);
    const raceIdSet = new Set(races.map((race) => String(race.id)));
    const actualEntries = [];
    let points = 0;

    races.forEach((race) => {
      const rows = history.resultsByRace.get(String(race.id)) || [];
      const actual = actualResultForDriver(rows, id);
      if (actual) actualEntries.push({ race, row: actual });

      rows.forEach((row) => {
        if (pointsOwnerId(row) !== id) return;
        points += getAwardedPoints(row, history.fastestByRace.get(String(race.id)));
      });
    });

    const finishes = actualEntries.map(({ row }) => validPosition(row.finish_position)).filter(Number.isFinite);
    const grids = actualEntries.map(({ row }) => validPosition(row.grid_position)).filter(Number.isFinite);
    const gains = actualEntries.map(({ row }) => {
      const grid = validPosition(row.grid_position);
      const finish = validPosition(row.finish_position);
      return Number.isFinite(grid) && Number.isFinite(finish) ? grid - finish : null;
    }).filter(Number.isFinite);

    const wins = actualEntries.filter(({ row }) => validPosition(row.finish_position) === 1).length;
    const podiums = actualEntries.filter(({ row }) => {
      const finish = validPosition(row.finish_position);
      return Number.isFinite(finish) && finish <= 3;
    }).length;
    const poles = actualEntries.filter(({ row }) => validPosition(row.grid_position) === 1).length;
    const fastestLaps = actualEntries.filter(({ race }) => String(history.fastestByRace.get(String(race.id)) || '') === id).length;
    const dnfs = actualEntries.filter(({ row }) => !Number.isFinite(validPosition(row.finish_position))).length;

    const bySeason = new Map();
    races.forEach((race) => {
      const seasonKey = String(race.season_id || '');
      const season = history.seasonsById.get(seasonKey);
      if (!bySeason.has(seasonKey)) {
        bySeason.set(seasonKey, {
          seasonId: seasonKey,
          seasonName: season?.name || season?.slug || 'Saison',
          starts: 0,
          wins: 0,
          podiums: 0,
          poles: 0,
          fastestLaps: 0,
          points: 0,
          bestFinish: null
        });
      }
      const bucket = bySeason.get(seasonKey);
      const rows = history.resultsByRace.get(String(race.id)) || [];
      const actual = actualResultForDriver(rows, id);
      if (actual) {
        bucket.starts += 1;
        const finish = validPosition(actual.finish_position);
        const grid = validPosition(actual.grid_position);
        if (finish === 1) bucket.wins += 1;
        if (Number.isFinite(finish) && finish <= 3) bucket.podiums += 1;
        if (grid === 1) bucket.poles += 1;
        if (String(history.fastestByRace.get(String(race.id)) || '') === id) bucket.fastestLaps += 1;
        if (Number.isFinite(finish)) bucket.bestFinish = bucket.bestFinish === null ? finish : Math.min(bucket.bestFinish, finish);
      }
      rows.forEach((row) => {
        if (pointsOwnerId(row) === id) bucket.points += getAwardedPoints(row, history.fastestByRace.get(String(race.id)));
      });
    });

    const trackMap = new Map();
    actualEntries.forEach(({ race, row }) => {
      const key = String(race.circuit_name || race.grand_prix_name || 'Unbekannt');
      if (!trackMap.has(key)) trackMap.set(key, { name: key, starts: 0, wins: 0, podiums: 0, points: 0, bestFinish: null });
      const bucket = trackMap.get(key);
      const finish = validPosition(row.finish_position);
      bucket.starts += 1;
      if (finish === 1) bucket.wins += 1;
      if (Number.isFinite(finish) && finish <= 3) bucket.podiums += 1;
      if (Number.isFinite(finish)) bucket.bestFinish = bucket.bestFinish === null ? finish : Math.min(bucket.bestFinish, finish);
      if (pointsOwnerId(row) === id) bucket.points += getAwardedPoints(row, history.fastestByRace.get(String(race.id)));
    });

    const teamMap = new Map();
    actualEntries.forEach(({ race }) => {
      const snapshot = driverDisplaySnapshot(history, id, race.id) || driver;
      const team = String(snapshot.league_team || snapshot.car_name || 'Ohne Team');
      const car = String(snapshot.car_name || '');
      const key = `${team}::${car}`;
      if (!teamMap.has(key)) teamMap.set(key, { team, car, starts: 0, firstRaceId: race.id, lastRaceId: race.id });
      const bucket = teamMap.get(key);
      bucket.starts += 1;
      bucket.lastRaceId = race.id;
    });

    const recent = [...actualEntries]
      .sort((left, right) => raceSortValue(left.race, history.seasonsById) - raceSortValue(right.race, history.seasonsById))
      .slice(-5)
      .reverse()
      .map(({ race, row }) => ({
        race,
        row,
        season: history.seasonsById.get(String(race.season_id || '')) || null,
        points: pointsOwnerId(row) === id ? getAwardedPoints(row, history.fastestByRace.get(String(race.id))) : 0,
        gain: (() => {
          const grid = validPosition(row.grid_position);
          const finish = validPosition(row.finish_position);
          return Number.isFinite(grid) && Number.isFinite(finish) ? grid - finish : null;
        })()
      }));

    const latestEntry = actualEntries.at(-1) || null;
    const currentSnapshot = latestEntry ? driverDisplaySnapshot(history, id, latestEntry.race.id) : driver;

    return {
      driver,
      currentSnapshot,
      scopeSeasonId: options.seasonId || null,
      starts: actualEntries.length,
      wins,
      podiums,
      poles,
      fastestLaps,
      points,
      avgStart: average(grids),
      avgFinish: average(finishes),
      positionsGained: gains.reduce((sum, value) => sum + value, 0),
      avgPositionsGained: average(gains),
      dnfs,
      finishRate: actualEntries.length ? (actualEntries.length - dnfs) / actualEntries.length : null,
      bestFinish: finishes.length ? Math.min(...finishes) : null,
      recent,
      seasonBreakdown: [...bySeason.values()].filter((entry) => entry.starts > 0 || entry.points !== 0).reverse(),
      trackStats: [...trackMap.values()].sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.points - a.points || a.name.localeCompare(b.name)).slice(0, 8),
      teamHistory: [...teamMap.values()],
      raceIds: raceIdSet
    };
  }

  function comparePosition(left, right) {
    const a = validPosition(left);
    const b = validPosition(right);
    if (Number.isFinite(a) && Number.isFinite(b)) return a === b ? 0 : (a < b ? 1 : -1);
    if (Number.isFinite(a)) return 1;
    if (Number.isFinite(b)) return -1;
    return 0;
  }

  function calculateHeadToHead(driverAId, driverBId, history, options = {}) {
    const aId = String(driverAId || '');
    const bId = String(driverBId || '');
    const driverA = history.driversById.get(aId);
    const driverB = history.driversById.get(bId);
    if (!driverA || !driverB || aId === bId) return null;

    const races = scopedRaces(history, options.seasonId || null);
    const common = [];
    let finishA = 0;
    let finishB = 0;
    let finishTies = 0;
    let qualiA = 0;
    let qualiB = 0;
    let qualiTies = 0;
    let pointsA = 0;
    let pointsB = 0;

    races.forEach((race) => {
      const rows = history.resultsByRace.get(String(race.id)) || [];
      const rowA = actualResultForDriver(rows, aId);
      const rowB = actualResultForDriver(rows, bId);
      if (!rowA || !rowB) return;

      const finishWinner = comparePosition(rowA.finish_position, rowB.finish_position);
      const qualiWinner = comparePosition(rowA.grid_position, rowB.grid_position);
      if (finishWinner > 0) finishA += 1;
      else if (finishWinner < 0) finishB += 1;
      else finishTies += 1;
      if (qualiWinner > 0) qualiA += 1;
      else if (qualiWinner < 0) qualiB += 1;
      else qualiTies += 1;

      const fastestId = history.fastestByRace.get(String(race.id));
      const racePointsA = pointsOwnerId(rowA) === aId ? getAwardedPoints(rowA, fastestId) : 0;
      const racePointsB = pointsOwnerId(rowB) === bId ? getAwardedPoints(rowB, fastestId) : 0;
      pointsA += racePointsA;
      pointsB += racePointsB;

      common.push({
        race,
        season: history.seasonsById.get(String(race.season_id || '')) || null,
        rowA,
        rowB,
        finishWinner,
        qualiWinner,
        pointsA: racePointsA,
        pointsB: racePointsB
      });
    });

    const finishPositionsA = common.map((entry) => validPosition(entry.rowA.finish_position)).filter(Number.isFinite);
    const finishPositionsB = common.map((entry) => validPosition(entry.rowB.finish_position)).filter(Number.isFinite);
    const gridPositionsA = common.map((entry) => validPosition(entry.rowA.grid_position)).filter(Number.isFinite);
    const gridPositionsB = common.map((entry) => validPosition(entry.rowB.grid_position)).filter(Number.isFinite);

    const metrics = (driverId, side) => {
      const rows = common.map((entry) => side === 'A' ? entry.rowA : entry.rowB);
      return {
        wins: rows.filter((row) => validPosition(row.finish_position) === 1).length,
        podiums: rows.filter((row) => {
          const finish = validPosition(row.finish_position);
          return Number.isFinite(finish) && finish <= 3;
        }).length,
        poles: rows.filter((row) => validPosition(row.grid_position) === 1).length,
        fastestLaps: common.filter((entry) => String(history.fastestByRace.get(String(entry.race.id)) || '') === String(driverId)).length
      };
    };

    return {
      driverA,
      driverB,
      commonRaces: common,
      commonRaceCount: common.length,
      raceH2H: { a: finishA, b: finishB, ties: finishTies },
      qualifyingH2H: { a: qualiA, b: qualiB, ties: qualiTies },
      points: { a: pointsA, b: pointsB },
      avgFinish: { a: average(finishPositionsA), b: average(finishPositionsB) },
      avgStart: { a: average(gridPositionsA), b: average(gridPositionsB) },
      metricsA: metrics(aId, 'A'),
      metricsB: metrics(bId, 'B')
    };
  }

  window.RCCDriverStats = {
    loadLeagueHistory,
    calculateDriverStats,
    calculateHeadToHead,
    validPosition,
    getAwardedPoints,
    driverDisplaySnapshot
  };
})();
