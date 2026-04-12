(function setupDriverContext(global) {
  function groupByDriver(assignments = []) {
    return assignments.reduce((map, assignment) => {
      const key = assignment.driver_id;
      if (!key) return map;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(assignment);
      return map;
    }, new Map());
  }

  async function fetchDriverSeasonAssignments(options = {}) {
    if (!global.supabaseClient) return [];

    let query = global.supabaseClient
      .from('driver_season_assignments')
      .select(`
        id,
        driver_id,
        season_id,
        effective_from_race_id,
        effective_round_number,
        team_id,
        car_name,
        ai_driver_reference,
        is_primary,
        created_at
      `)
      .order('created_at', { ascending: true });

    if (options.seasonId !== undefined && options.seasonId !== null) {
      query = query.eq('season_id', options.seasonId);
    }

    const { data, error } = await query;
    if (error) {
      const relationMissing = error.code === 'PGRST205' || error.code === '42P01' || error.code === '404';
      if (relationMissing) return [];
      throw error;
    }

    return data || [];
  }

  function createAssignmentResolver({ drivers = [], races = [], assignments = [] } = {}) {
    const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
    const racesById = new Map(races.map((race) => [race.id, race]));
    const assignmentsByDriver = groupByDriver(assignments);

    function getAssignmentStartRound(row) {
      if (Number.isFinite(Number(row?.effective_round_number))) {
        return Number(row.effective_round_number);
      }

      if (row?.effective_from_race_id) {
        const round = Number(racesById.get(row.effective_from_race_id)?.round_number);
        if (Number.isFinite(round)) return round;
      }

      if (row?.is_primary) return 0;
      return Number.MAX_SAFE_INTEGER;
    }

    for (const rows of assignmentsByDriver.values()) {
      rows.sort((left, right) => {
        const leftRound = getAssignmentStartRound(left);
        const rightRound = getAssignmentStartRound(right);
        if (leftRound !== rightRound) return leftRound - rightRound;
        return new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime();
      });
    }

    function getAssignmentForRace(driverId, raceId) {
      const race = racesById.get(raceId);
      const currentRound = Number(race?.round_number || 0);
      const rows = assignmentsByDriver.get(driverId) || [];
      let winner = null;

      for (const row of rows) {
        const startRound = getAssignmentStartRound(row);
        if (startRound <= currentRound) winner = row;
      }

      return winner;
    }

    function resolveDriverSnapshot(driverId, raceId) {
      const baseDriver = driversById.get(driverId);
      if (!baseDriver) return null;

      const assignment = getAssignmentForRace(driverId, raceId);
      if (!assignment) return { ...baseDriver };

      return {
        ...baseDriver,
        league_team: baseDriver.league_team,
        car_name: assignment.car_name || baseDriver.car_name,
        ai_driver_reference: assignment.ai_driver_reference || baseDriver.ai_driver_reference,
        team_id: assignment.team_id || baseDriver.team_id,
        assignment_id: assignment.id,
        effective_from_race_id: assignment.effective_from_race_id,
        effective_round_number: assignment.effective_round_number
      };
    }

    return {
      getAssignmentForRace,
      resolveDriverSnapshot,
      racesById,
      driversById,
      assignmentsByDriver
    };
  }

  global.RCCDriverContext = {
    fetchDriverSeasonAssignments,
    createAssignmentResolver
  };
})(window);
