(() => {
  const state = window.RCCDashboardPerformance = window.RCCDashboardPerformance || {};

  function getLeagueScopedDashboardCacheKey() {
    const legacyKey = 'rcc.dashboard.view.v1';
    let slug = '';
    try {
      slug = window.RCCData?.getRequestedLeagueSlug?.() || new URLSearchParams(window.location.search).get('league') || '';
    } catch (_error) {
      slug = '';
    }
    slug = String(slug || 'rcc').trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'rcc';
    return `${legacyKey}:${slug}`;
  }

  function installScopedDashboardViewCache() {
    if (state.scopedDashboardCacheInstalled || typeof Storage === 'undefined') return;
    const legacyKey = 'rcc.dashboard.view.v1';
    const scopedKey = getLeagueScopedDashboardCacheKey();
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.getItem = function patchedGetItem(key) {
      if (this === window.sessionStorage && key === legacyKey) {
        return originalGetItem.call(this, scopedKey);
      }
      return originalGetItem.call(this, key);
    };

    Storage.prototype.setItem = function patchedSetItem(key, value) {
      if (this === window.sessionStorage && key === legacyKey) {
        return originalSetItem.call(this, scopedKey, value);
      }
      return originalSetItem.call(this, key, value);
    };

    Storage.prototype.removeItem = function patchedRemoveItem(key) {
      if (this === window.sessionStorage && key === legacyKey) {
        return originalRemoveItem.call(this, scopedKey);
      }
      return originalRemoveItem.call(this, key);
    };

    state.scopedDashboardCacheInstalled = true;
    state.dashboardCacheKey = scopedKey;
  }

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

  async function refreshScopedStewardCount() {
    const statusEl = document.getElementById('status-stewards');
    if (!statusEl || !window.supabaseClient || !window.RCCData) return;

    try {
      const season = await window.RCCData.fetchCurrentSeason();
      if (!season?.id) {
        statusEl.textContent = 'Keine aktive Saison';
        return;
      }

      const races = await window.RCCData.fetchRaces({ seasonId: season.id });
      const raceIds = (races || []).map((race) => race.id).filter(Boolean);
      if (!raceIds.length) {
        statusEl.textContent = 'Keine Fälle hinterlegt';
        return;
      }

      const { count, error } = await window.supabaseClient
        .from('steward_cases')
        .select('id', { count: 'exact', head: true })
        .in('race_id', raceIds);
      if (error) throw error;

      statusEl.textContent = count ? `${count} Fälle protokolliert` : 'Keine Fälle hinterlegt';
    } catch (error) {
      console.debug('Liga-spezifischer Steward-Status konnte nicht geladen werden:', error);
    }
  }

  installScopedDashboardViewCache();
  keepExistingNewsWarm();
  startCriticalPrefetch();

  document.addEventListener('dashboard:content-ready', () => {
    refreshScopedStewardCount();
  }, { once: true });
})();
