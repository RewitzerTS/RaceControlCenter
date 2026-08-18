(() => {
  if (window.RCCDriverRivalries) return;

  const id = (value) => String(value || '');
  const pos = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const compare = (a, b) => {
    const left = pos(a);
    const right = pos(b);
    if (Number.isFinite(left) && Number.isFinite(right)) return left === right ? 0 : (left < right ? 1 : -1);
    if (Number.isFinite(left)) return 1;
    if (Number.isFinite(right)) return -1;
    return 0;
  };

  function scopedRaces(history, seasonId = null) {
    const races = history?.completedRaces || [];
    return seasonId ? races.filter((race) => id(race.season_id) === id(seasonId)) : races;
  }

  function actual(rows, driverId) {
    return (rows || []).find((row) => id(row.driver_id) === id(driverId)) || null;
  }

  function teamAt(history, driverId, raceId) {
    const snapshot = window.RCCDriverStats?.driverDisplaySnapshot?.(history, driverId, raceId);
    return String(snapshot?.league_team || '').trim();
  }

  function compareDrivers(driverId, opponentId, history, options = {}) {
    let shared = 0;
    let ahead = 0;
    let behind = 0;
    let ties = 0;
    let teammateRaces = 0;
    let teammateAhead = 0;
    let teammateBehind = 0;
    let teammateTies = 0;

    scopedRaces(history, options.seasonId || null).forEach((race) => {
      const rows = history.resultsByRace.get(id(race.id)) || [];
      const mine = actual(rows, driverId);
      const other = actual(rows, opponentId);
      if (!mine || !other) return;

      shared += 1;
      const outcome = compare(mine.finish_position, other.finish_position);
      if (outcome > 0) ahead += 1;
      else if (outcome < 0) behind += 1;
      else ties += 1;

      const myTeam = teamAt(history, driverId, race.id);
      const otherTeam = teamAt(history, opponentId, race.id);
      if (!myTeam || myTeam !== otherTeam) return;
      teammateRaces += 1;
      if (outcome > 0) teammateAhead += 1;
      else if (outcome < 0) teammateBehind += 1;
      else teammateTies += 1;
    });

    return {
      shared,
      ahead,
      behind,
      ties,
      teammateRaces,
      teammateAhead,
      teammateBehind,
      teammateTies,
      margin: Math.abs(ahead - behind)
    };
  }

  function calculate(driverId, history, options = {}) {
    const subject = history?.driversById?.get(id(driverId));
    if (!subject) return { rivalries: [], teammates: [] };

    const rows = (history.drivers || [])
      .filter((driver) => id(driver.id) !== id(driverId))
      .map((driver) => ({
        driver,
        ...compareDrivers(driverId, driver.id, history, options)
      }));

    const rivalries = rows
      .filter((entry) => entry.shared >= 2)
      .sort((a, b) => b.shared - a.shared || a.margin - b.margin || b.ahead + b.behind - (a.ahead + a.behind) || String(a.driver.display_name || '').localeCompare(String(b.driver.display_name || ''), 'de'))
      .slice(0, 4);

    const teammates = rows
      .filter((entry) => entry.teammateRaces > 0)
      .sort((a, b) => b.teammateRaces - a.teammateRaces || Math.abs(a.teammateAhead - a.teammateBehind) - Math.abs(b.teammateAhead - b.teammateBehind) || String(a.driver.display_name || '').localeCompare(String(b.driver.display_name || ''), 'de'))
      .slice(0, 4);

    return { rivalries, teammates };
  }

  window.RCCDriverRivalries = { calculate };
})();
