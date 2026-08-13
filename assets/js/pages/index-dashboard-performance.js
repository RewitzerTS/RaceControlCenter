(() => {
  const state = window.RCCDashboardPerformance = window.RCCDashboardPerformance || {};

  function keepExistingNewsWarm() {
    try {
      const key = 'rcc.liveF1News.v1';
      const raw = window.localStorage?.getItem(key);
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload || !Array.isArray(payload.items) || !payload.items.length) return;
      // Existing headlines are good enough for the first paint. Refreshing their
      // timestamp prevents external RSS gateways from blocking the critical UI.
      payload.updatedAt = Date.now();
      window.localStorage?.setItem(key, JSON.stringify(payload));
    } catch (_error) {
      // Optional optimization only.
    }
  }

  function startCriticalPrefetch() {
    if (!window.RCCData || state.prefetchPromise) return state.prefetchPromise;

    state.prefetchStartedAt = performance.now();
    const currentSeasonPromise = window.RCCData.fetchCurrentSeason();
    const driversPromise = window.RCCData.fetchDrivers();

    state.prefetchPromise = currentSeasonPromise
      .then(async (season) => {
        if (!season?.id) return { season, drivers: await driversPromise, races: [], assignments: [], raceResults: [] };

        const racesPromise = window.RCCData.fetchRaces({ seasonId: season.id });
        const assignmentsPromise = window.RCCDriverContext?.fetchDriverSeasonAssignments
          ? window.RCCDriverContext.fetchDriverSeasonAssignments({ seasonId: season.id })
          : Promise.resolve([]);

        const [drivers, races, assignments] = await Promise.all([
          driversPromise,
          racesPromise,
          assignmentsPromise
        ]);
        const raceIds = (races || []).map((race) => race.id).filter(Boolean);
        const raceResults = raceIds.length
          ? await window.RCCData.fetchRaceResults({ raceIds })
          : [];

        return { season, drivers, races, assignments, raceResults };
      })
      .then((payload) => {
        state.prefetchFinishedAt = performance.now();
        state.prefetched = payload;
        return payload;
      })
      .catch((error) => {
        console.debug('Dashboard-Prefetch übersprungen:', error);
        return null;
      });

    return state.prefetchPromise;
  }

  keepExistingNewsWarm();
  startCriticalPrefetch();
})();
