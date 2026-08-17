(() => {
  if (window.RCCTeamStats) return;

  const norm = (value) => String(value || '').trim().toLocaleLowerCase('de');
  const pos = (value) => window.RCCDriverStats?.validPosition?.(value) ?? null;

  function snapshot(history, row, race) {
    return window.RCCDriverStats?.driverDisplaySnapshot?.(history, row?.driver_id, race?.id)
      || history?.driversById?.get(String(row?.driver_id || ''))
      || {};
  }

  function actualTeam(history, row, race) {
    const driver = snapshot(history, row, race);
    return String(driver.league_team || driver.car_name || row?.points_team_name || '').trim();
  }

  function pointsTeam(history, row, race) {
    return String(row?.points_team_name || actualTeam(history, row, race)).trim();
  }

  function awardedPoints(row, fastestDriverId) {
    return Number(window.RCCDriverStats?.getAwardedPoints?.(row, fastestDriverId) || 0);
  }

  function racesFor(history, seasonId) {
    if (!seasonId) return history.completedRaces || [];
    return (history.completedRaces || []).filter((race) => String(race.season_id) === String(seasonId));
  }

  function listTeams(history, options = {}) {
    const names = new Map();
    racesFor(history, options.seasonId).forEach((race) => {
      (history.resultsByRace.get(String(race.id)) || []).forEach((row) => {
        [actualTeam(history, row, race), pointsTeam(history, row, race)].forEach((name) => {
          const key = norm(name);
          if (key && !names.has(key)) names.set(key, name);
        });
      });
    });
    (history.assignments || []).forEach((row) => {
      if (options.seasonId && String(row.season_id) !== String(options.seasonId)) return;
      const name = String(row.league_team || row.car_name || '').trim();
      const key = norm(name);
      if (key && !names.has(key)) names.set(key, name);
    });
    return [...names.values()].sort((a, b) => a.localeCompare(b, 'de'));
  }

  function calculateTeamStats(teamName, history, options = {}) {
    const key = norm(teamName);
    if (!key) return null;

    const drivers = new Map();
    const cars = new Map();
    const seasons = new Map();
    const raceHistory = [];
    let canonicalName = String(teamName).trim();
    let starts = 0;
    let wins = 0;
    let podiums = 0;
    let poles = 0;
    let fastestLaps = 0;
    let points = 0;

    racesFor(history, options.seasonId).forEach((race) => {
      const rows = history.resultsByRace.get(String(race.id)) || [];
      const teamRows = rows.filter((row) => norm(actualTeam(history, row, race)) === key);
      const pointRows = rows.filter((row) => norm(pointsTeam(history, row, race)) === key);
      if (!teamRows.length && !pointRows.length) return;

      const fastestId = String(history.fastestByRace.get(String(race.id)) || '');
      const seasonId = String(race.season_id || '');
      const season = history.seasonsById.get(seasonId);
      if (!seasons.has(seasonId)) {
        seasons.set(seasonId, { seasonId, seasonName: season?.name || 'Saison', raceIds: new Set(), starts: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, points: 0, bestFinish: null });
      }
      const seasonStat = seasons.get(seasonId);
      seasonStat.raceIds.add(String(race.id));
      const raceStat = { race, season, drivers: [], points: 0, bestFinish: null };

      teamRows.forEach((row) => {
        const driver = snapshot(history, row, race);
        const displayName = String(driver.display_name || 'Unbekannt');
        const driverId = String(row.driver_id || '');
        const finish = pos(row.finish_position);
        const grid = pos(row.grid_position);
        const car = String(driver.car_name || '').trim();
        canonicalName = actualTeam(history, row, race) || canonicalName;

        starts += 1;
        seasonStat.starts += 1;
        if (finish === 1) { wins += 1; seasonStat.wins += 1; }
        if (Number.isFinite(finish) && finish <= 3) { podiums += 1; seasonStat.podiums += 1; }
        if (grid === 1) { poles += 1; seasonStat.poles += 1; }
        if (fastestId === driverId) { fastestLaps += 1; seasonStat.fastestLaps += 1; }
        if (Number.isFinite(finish)) {
          raceStat.bestFinish = raceStat.bestFinish === null ? finish : Math.min(raceStat.bestFinish, finish);
          seasonStat.bestFinish = seasonStat.bestFinish === null ? finish : Math.min(seasonStat.bestFinish, finish);
        }

        if (!drivers.has(driverId)) drivers.set(driverId, { driverId, name: displayName, starts: 0, wins: 0, podiums: 0, points: 0 });
        const driverStat = drivers.get(driverId);
        driverStat.name = displayName;
        driverStat.starts += 1;
        if (finish === 1) driverStat.wins += 1;
        if (Number.isFinite(finish) && finish <= 3) driverStat.podiums += 1;
        if (car) cars.set(car, (cars.get(car) || 0) + 1);
        raceStat.drivers.push({ driverId, name: displayName, finish, grid, car });
      });

      pointRows.forEach((row) => {
        const value = awardedPoints(row, fastestId);
        points += value;
        raceStat.points += value;
        seasonStat.points += value;
        const ownerId = String(row.points_owner_driver_id || row.driver_id || '');
        if (drivers.has(ownerId)) drivers.get(ownerId).points += value;
      });
      raceHistory.push(raceStat);
    });

    return {
      teamName: canonicalName,
      races: raceHistory.length,
      starts,
      wins,
      podiums,
      poles,
      fastestLaps,
      points,
      bestFinish: raceHistory.reduce((best, entry) => Number.isFinite(entry.bestFinish) ? (best === null ? entry.bestFinish : Math.min(best, entry.bestFinish)) : best, null),
      drivers: [...drivers.values()].sort((a, b) => b.starts - a.starts || b.points - a.points || a.name.localeCompare(b.name, 'de')),
      cars: [...cars.entries()].map(([name, count]) => ({ name, starts: count })).sort((a, b) => b.starts - a.starts),
      recent: raceHistory.slice(-5).reverse(),
      seasonBreakdown: [...seasons.values()].map((entry) => ({ ...entry, races: entry.raceIds.size })).reverse()
    };
  }

  function calculateAllTeamStats(history, options = {}) {
    return listTeams(history, options).map((name) => calculateTeamStats(name, history, options)).filter(Boolean);
  }

  window.RCCTeamStats = { listTeams, calculateTeamStats, calculateAllTeamStats };
})();
