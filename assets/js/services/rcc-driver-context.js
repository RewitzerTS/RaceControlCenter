(function installEarlyContextCoalescer(global) {
  if (global.RCCContextRequestCoalescer?.installed) return;

  const leagueContext = global.RCCLeagueContext;
  const client = global.supabaseClient;
  if (!leagueContext?.initialize || !client?.auth) return;

  const BOOTSTRAP_COALESCE_MS = 6000;
  const installedAt = Date.now();
  const nativeInitialize = leagueContext.initialize.bind(leagueContext);
  const nativeInvalidate = typeof leagueContext.invalidate === 'function'
    ? leagueContext.invalidate.bind(leagueContext)
    : null;

  let inFlight = null;
  let inFlightSlug = null;
  let lastSnapshot = null;
  let lastSlug = null;
  let knownUserId;

  function normalizeSlug(value) {
    return String(value || leagueContext.getRequestedLeagueSlug?.() || 'rcc')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') || 'rcc';
  }

  function cloneSnapshot(snapshot) {
    if (!snapshot) return snapshot;
    return {
      ...snapshot,
      league: snapshot.league ? { ...snapshot.league } : null,
      membership: snapshot.membership ? { ...snapshot.membership } : null
    };
  }

  function remember(snapshot, slug) {
    if (!snapshot?.league) return;
    lastSnapshot = cloneSnapshot(snapshot);
    lastSlug = normalizeSlug(snapshot.slug || slug);
  }

  function clear() {
    lastSnapshot = null;
    lastSlug = null;
  }

  const seed = leagueContext.snapshot?.();
  if (seed?.league) remember(seed, seed.slug);

  leagueContext.initialize = (options = {}) => {
    const slug = normalizeSlug(options.slug);
    const forceRefresh = options.forceRefresh === true;
    const bypassCoalescing = options.bypassCoalescing === true;
    const inBootstrapWindow = Date.now() - installedAt < BOOTSTRAP_COALESCE_MS;

    if (!bypassCoalescing && inFlight && inFlightSlug === slug) return inFlight;

    if (!bypassCoalescing && lastSnapshot && lastSlug === slug) {
      if (!forceRefresh || inBootstrapWindow) {
        return Promise.resolve(cloneSnapshot(lastSnapshot));
      }
    }

    inFlightSlug = slug;
    inFlight = Promise.resolve(nativeInitialize(options))
      .then((snapshot) => {
        remember(snapshot, slug);
        return snapshot;
      })
      .finally(() => {
        inFlight = null;
        inFlightSlug = null;
      });
    return inFlight;
  };

  if (nativeInvalidate) {
    leagueContext.invalidate = (options = {}) => {
      clear();
      return nativeInvalidate(options);
    };
  }

  global.addEventListener('rcc:league-context-ready', (event) => {
    remember(event?.detail, event?.detail?.slug);
  });

  client.auth.onAuthStateChange((event, session) => {
    const nextUserId = session?.user?.id || null;
    if (knownUserId !== undefined && nextUserId !== knownUserId) clear();
    if (event === 'SIGNED_OUT') clear();
    knownUserId = nextUserId;
  });

  leagueContext.__rccAdminContextCoalesced = true;
  global.RCCContextRequestCoalescer = Object.freeze({
    installed: true,
    bootstrapWindowMs: BOOTSTRAP_COALESCE_MS
  });
})(window);

(function setupDriverContext(global) {
  function isMissingRelation(error) {
    return error?.code === 'PGRST205' || error?.code === '42P01' || error?.code === '404';
  }

  function normalizeSeasonAssignment(row = {}) {
    return {
      ...row,
      league_team: row.league_team || row.team_name || '',
      ai_driver_reference: row.ai_driver_reference || row.ai_driver_name || '',
      is_primary: row.is_primary ?? true,
      effective_from_race_id: row.effective_from_race_id ?? null,
      effective_round_number: row.effective_round_number ?? null
    };
  }

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

    // Public pages use published result snapshots, never the private roster.
    if (global.supabaseClient.auth?.getSession) {
      const session = await global.supabaseClient.auth.getSession();
      if (session.error) throw session.error;
      if (!session.data?.session) {
        const races = await global.RCCData.fetchRaces({ seasonId: options.seasonId });
        const raceIds = races.map((race) => race.id);
        const results = raceIds.length ? await global.RCCData.fetchRaceResults({ raceIds }) : [];
        return publishedAssignmentSnapshots(races, results);
      }
    }

    let query = global.supabaseClient
      .from('season_driver_assignments')
      .select(`
        id,
        driver_id,
        season_id,
        seat_code,
        team_name,
        car_name,
        ai_driver_name,
        participant_type,
        gamertag_snapshot,
        number,
        nationality_code,
        created_at
      `)
      .order('created_at', { ascending: true });

    if (options.seasonId !== undefined && options.seasonId !== null) {
      query = query.eq('season_id', options.seasonId);
    }

    const current = await query;
    if (!current.error) return (current.data || []).map(normalizeSeasonAssignment);
    if (!isMissingRelation(current.error)) throw current.error;
    if (global.RCC_DISABLE_LEGACY_DRIVER_SEASON_ASSIGNMENTS === true) return [];

    let legacyQuery = global.supabaseClient
      .from('driver_season_assignments')
      .select(`
        id,
        driver_id,
        season_id,
        effective_from_race_id,
        effective_round_number,
        team_id,
        league_team,
        car_name,
        ai_driver_reference,
        is_primary,
        created_at
      `)
      .order('created_at', { ascending: true });

    if (options.seasonId !== undefined && options.seasonId !== null) {
      legacyQuery = legacyQuery.eq('season_id', options.seasonId);
    }

    const legacy = await legacyQuery;
    if (legacy.error) {
      if (isMissingRelation(legacy.error)) return [];
      throw legacy.error;
    }
    return (legacy.data || []).map(normalizeSeasonAssignment);
  }

  function publishedAssignmentSnapshots(races = [], results = []) {
    const byRace = new Map(races.map((race) => [String(race.id), race]));
    return results.flatMap((row) => {
      const race = byRace.get(String(row.race_id));
      if (!race?.current_result_version_id
        || String(race.current_result_version_id) !== String(row.result_version_id)) return [];
      return [normalizeSeasonAssignment({
        id: row.source_assignment_id || row.id,
        driver_id: row.driver_id,
        season_id: race.season_id,
        team_id: row.team_id,
        league_team: !row.points_owner_driver_id || row.points_owner_driver_id === row.driver_id ? row.points_team_name : '',
        car_name: row.car_name_snapshot,
        ai_driver_reference: row.ai_driver_reference_snapshot,
        effective_from_race_id: race.id,
        effective_round_number: Number(race.round_number),
        is_primary: false,
        created_at: row.created_at,
      })];
    });
  }

  function createAssignmentResolver({ drivers = [], races = [], assignments = [] } = {}) {
    const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
    const racesById = new Map(races.map((race) => [race.id, race]));
    const assignmentsByDriver = groupByDriver(assignments.map(normalizeSeasonAssignment));

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
      const currentSeasonId = race?.season_id == null ? null : String(race.season_id);
      const rows = (assignmentsByDriver.get(driverId) || []).filter((row) => {
        if (!currentSeasonId) return true;
        return String(row?.season_id || '') === currentSeasonId;
      });
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
        league_team: assignment.league_team ?? baseDriver.league_team,
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
    publishedAssignmentSnapshots,
    createAssignmentResolver
  };
})(window);
