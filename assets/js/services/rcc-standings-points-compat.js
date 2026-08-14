(() => {
  if (!window.RCCData?.buildStandings) return;

  const normalizeDriverName = window.RCCData.normalizeDriverName || ((value) => String(value || '').trim().toLowerCase());
  const getFastestLapDriverId = window.RCCData.getFastestLapDriverId || (() => null);

  function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function finalPoints(row, fastestLapDriverId) {
    const stored = Number(row?.awarded_points);
    if (Number.isFinite(stored)) return stored;
    return window.RCCData.getAwardedRacePoints?.(row, fastestLapDriverId) ?? safeNumber(row?.points, 0);
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

  window.RCCData.buildStandings = function buildStandingsCompat({ drivers, races, raceResults, resolver } = {}) {
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

    for (const driver of drivers || []) getOrCreateDriverEntry(driver.id, races?.[0]?.id || null);

    for (const row of scopedResults) {
      const sourceDriverId = row.driver_id;
      const pointsOwnerDriverId = row.points_owner_driver_id || sourceDriverId;
      const snapshot = resolver?.resolveDriverSnapshot(sourceDriverId, row.race_id) || baseDriversById.get(sourceDriverId);
      if (!snapshot?.id) continue;

      const driverEntry = getOrCreateDriverEntry(pointsOwnerDriverId, row.race_id);
      if (!driverEntry) continue;

      const position = safeNumber(row.finish_position, null);
      const fastestLapDriverId = fastestLapWinnerByRace.get(row.race_id) || null;
      const hasFastestLap = fastestLapDriverId === sourceDriverId;
      const points = finalPoints(row, fastestLapDriverId);

      driverEntry.points += points;
      driverEntry.leagueTeam = row.points_team_name || snapshot.league_team || driverEntry.leagueTeam;
      driverEntry.carName = row.points_car_name || snapshot.car_name || driverEntry.carName;
      if (position === 1) driverEntry.wins += 1;
      if ([1, 2, 3].includes(position)) driverEntry.podiums += 1;
      if (hasFastestLap) driverEntry.fastestLaps += 1;

      const teamName = row.points_team_name || snapshot.league_team || 'Ohne Team';
      if (!teamsMap.has(teamName)) teamsMap.set(teamName, { teamName, points: 0, drivers: new Map() });
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
      .filter((entry) => entry.points !== 0 || entry.wins > 0 || entry.podiums > 0 || entry.fastestLaps > 0)
      .sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || b.fastestLaps - a.fastestLaps || a.normalizedName.localeCompare(b.normalizedName, 'de'));

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
      .sort((a, b) => b.points - a.points || a.teamName.localeCompare(b.teamName, 'de', { sensitivity: 'base' }));

    return { driverStandings, teamStandings };
  };
})();
