(() => {
  if (window.RCCRecords) return;

  const pos = (value) => window.RCCDriverStats?.validPosition?.(value) ?? null;
  const points = (row, fastestId) => Number(window.RCCDriverStats?.getAwardedPoints?.(row, fastestId) || 0);

  function racesFor(history, seasonId) {
    const races = seasonId
      ? (history.completedRaces || []).filter((race) => String(race.season_id) === String(seasonId))
      : [...(history.completedRaces || [])];
    return races;
  }

  function trackName(race) {
    return String(race?.circuit_name || race?.grand_prix_name || 'Unbekannte Strecke').trim();
  }

  function leader(rows, field, options = {}) {
    const usable = (rows || []).filter((row) => !options.filter || options.filter(row));
    return usable.sort((a, b) => {
      const av = Number(a?.[field]);
      const bv = Number(b?.[field]);
      if (av !== bv) return options.lowerIsBetter ? av - bv : bv - av;
      return String(a?.driver?.display_name || a?.teamName || '').localeCompare(String(b?.driver?.display_name || b?.teamName || ''), 'de');
    })[0] || null;
  }

  function top(rows, field, options = {}) {
    return (rows || []).filter((row) => !options.filter || options.filter(row)).sort((a, b) => {
      const av = Number(a?.[field]);
      const bv = Number(b?.[field]);
      if (av !== bv) return options.lowerIsBetter ? av - bv : bv - av;
      return String(a?.driver?.display_name || a?.teamName || '').localeCompare(String(b?.driver?.display_name || b?.teamName || ''), 'de');
    }).slice(0, options.limit || 5);
  }

  function actualEntries(history, driverId, seasonId) {
    const id = String(driverId || '');
    return racesFor(history, seasonId).map((race) => {
      const rows = history.resultsByRace.get(String(race.id)) || [];
      const row = rows.find((candidate) => String(candidate.driver_id || '') === id);
      return row ? { race, row, fastestId: history.fastestByRace.get(String(race.id)) } : null;
    }).filter(Boolean);
  }

  function longestStreak(history, driverId, seasonId, predicate) {
    let best = 0;
    let current = 0;
    let bestEnd = null;
    actualEntries(history, driverId, seasonId).forEach((entry) => {
      if (predicate(entry)) {
        current += 1;
        if (current > best) {
          best = current;
          bestEnd = entry.race;
        }
      } else {
        current = 0;
      }
    });
    return { value: best, endRace: bestEnd };
  }

  function bestStreak(history, driverStats, seasonId, predicate) {
    let best = null;
    driverStats.forEach((stat) => {
      const streak = longestStreak(history, stat.driver.id, seasonId, predicate);
      if (!best || streak.value > best.value || (streak.value === best.value && String(stat.driver.display_name).localeCompare(String(best.driver.display_name), 'de') < 0)) {
        best = { ...streak, driver: stat.driver };
      }
    });
    return best?.value ? best : null;
  }

  function biggestComeback(history, seasonId) {
    let best = null;
    racesFor(history, seasonId).forEach((race) => {
      const rows = history.resultsByRace.get(String(race.id)) || [];
      rows.forEach((row) => {
        const grid = pos(row.grid_position);
        const finish = pos(row.finish_position);
        if (!Number.isFinite(grid) || !Number.isFinite(finish)) return;
        const gain = grid - finish;
        if (!best || gain > best.gain) {
          best = {
            gain,
            grid,
            finish,
            race,
            driver: window.RCCDriverStats.driverDisplaySnapshot(history, row.driver_id, race.id) || history.driversById.get(String(row.driver_id || ''))
          };
        }
      });
    });
    return best && best.gain > 0 ? best : null;
  }

  function trackSpecialist(history, seasonId) {
    const map = new Map();
    racesFor(history, seasonId).forEach((race) => {
      const track = trackName(race);
      (history.resultsByRace.get(String(race.id)) || []).forEach((row) => {
        if (pos(row.finish_position) !== 1) return;
        const id = String(row.driver_id || '');
        if (!id) return;
        const key = `${id}::${track.toLocaleLowerCase('de')}`;
        if (!map.has(key)) {
          map.set(key, {
            driverId: id,
            driver: window.RCCDriverStats.driverDisplaySnapshot(history, id, race.id) || history.driversById.get(id),
            track,
            wins: 0
          });
        }
        map.get(key).wins += 1;
      });
    });
    return [...map.values()].sort((a, b) => b.wins - a.wins || String(a.driver?.display_name || '').localeCompare(String(b.driver?.display_name || ''), 'de'))[0] || null;
  }

  function calculate(history, options = {}) {
    const seasonId = options.seasonId || null;
    const driverStats = (history.drivers || [])
      .map((driver) => window.RCCDriverStats.calculateDriverStats(driver.id, history, { seasonId }))
      .filter((stat) => stat?.starts > 0);
    const teamStats = window.RCCTeamStats.calculateAllTeamStats(history, { seasonId }).filter((stat) => stat?.races > 0);

    const comeback = biggestComeback(history, seasonId);
    const winStreak = bestStreak(history, driverStats, seasonId, ({ row }) => pos(row.finish_position) === 1);
    const podiumStreak = bestStreak(history, driverStats, seasonId, ({ row }) => {
      const finish = pos(row.finish_position);
      return Number.isFinite(finish) && finish <= 3;
    });
    const pointsStreak = bestStreak(history, driverStats, seasonId, ({ row, fastestId }) => points(row, fastestId) > 0);
    const specialist = trackSpecialist(history, seasonId);
    const avgFinish = leader([...driverStats], 'avgFinish', { lowerIsBetter: true, filter: (stat) => stat.starts >= 3 && Number.isFinite(stat.avgFinish) });
    const finishRate = leader([...driverStats], 'finishRate', { filter: (stat) => stat.starts >= 5 && Number.isFinite(stat.finishRate) });
    const positionsGained = leader([...driverStats], 'positionsGained');

    return {
      seasonId,
      driverStats,
      teamStats,
      raceCount: racesFor(history, seasonId).length,
      leaderboards: {
        drivers: {
          wins: top([...driverStats], 'wins'),
          podiums: top([...driverStats], 'podiums'),
          poles: top([...driverStats], 'poles'),
          fastestLaps: top([...driverStats], 'fastestLaps'),
          points: top([...driverStats], 'points'),
          starts: top([...driverStats], 'starts')
        },
        teams: {
          points: top([...teamStats], 'points'),
          wins: top([...teamStats], 'wins'),
          podiums: top([...teamStats], 'podiums'),
          poles: top([...teamStats], 'poles'),
          fastestLaps: top([...teamStats], 'fastestLaps'),
          races: top([...teamStats], 'races')
        }
      },
      specials: {
        comeback,
        winStreak,
        podiumStreak,
        pointsStreak,
        specialist,
        avgFinish,
        finishRate,
        positionsGained
      }
    };
  }

  window.RCCRecords = { calculate };
})();
