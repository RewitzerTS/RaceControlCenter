// Appended only to the V2 copy of the legacy Career service.
(() => {
  const original = window.RCCDriverStats.loadLeagueHistory;
  window.RCCDriverStats.loadLeagueHistory = async (...args) => {
    const history = await original(...args);
    const { data, error } = await window.supabaseClient.rpc('get_league_team_labels');
    if (error) throw error;
    const labels = data || [];
    const label = (season, name) => labels.find(row => row.season_id === season && row.key_name === name)?.display_name ?? name;
    const assignments = history.assignments.map(row => ({ ...row, team_name: label(row.season_id, row.team_name) }));
    const currentRosters = history.currentRosters.map(row => ({ ...row, team_name: label(row.season_id, row.team_name) }));
    const raceResults = history.raceResults.map(row => ({ ...row,
      points_team_name: label(history.racesById.get(String(row.race_id))?.season_id, row.points_team_name)
    }));
    const resultsByRace = new Map();
    for (const row of raceResults) {
      const key = String(row.race_id || '');
      if (!resultsByRace.has(key)) resultsByRace.set(key, []);
      resultsByRace.get(key).push(row);
    }
    return { ...history, assignments, currentRosters, raceResults, resultsByRace,
      resolver: window.RCCDriverContext.createAssignmentResolver({ drivers: history.drivers, races: history.races, assignments })
    };
  };
})();
