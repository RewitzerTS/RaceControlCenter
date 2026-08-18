(() => {
  const CONTEXT_FORCE_COALESCE_MS = 2000;
  let initialized = false;
  let initPromise = null;
  let observer = null;
  let contextListenerBound = false;
  let reconcileRunning = false;
  let leagueIsComplete = false;
  let seasonCheckLeagueId = null;
  let seasonCheckResult = false;

  function requestedSlug() {
    return String(new URLSearchParams(window.location.search).get('league') || 'rcc')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') || 'rcc';
  }

  function cloneContext(context) {
    if (!context) return context;
    return {
      ...context,
      league: context.league ? { ...context.league } : null,
      membership: context.membership ? { ...context.membership } : null
    };
  }

  function installContextRequestCoalescer() {
    const client = window.supabaseClient;
    const leagueContext = window.RCCLeagueContext;
    if (!client || !leagueContext?.initialize || leagueContext.__rccAdminContextCoalesced) return;

    const nativeInitialize = leagueContext.initialize.bind(leagueContext);
    const nativeInvalidate = typeof leagueContext.invalidate === 'function'
      ? leagueContext.invalidate.bind(leagueContext)
      : null;

    let inFlight = null;
    let inFlightSlug = null;
    let lastSnapshot = null;
    let lastSlug = null;
    let lastResolvedAt = 0;
    let knownAuthUserId;

    const clearResolved = () => {
      lastSnapshot = null;
      lastSlug = null;
      lastResolvedAt = 0;
    };

    const seed = leagueContext.snapshot?.();
    if (seed?.league) {
      lastSnapshot = cloneContext(seed);
      lastSlug = String(seed.slug || requestedSlug());
      lastResolvedAt = Date.now();
    }

    leagueContext.initialize = (options = {}) => {
      const slug = String(options.slug || requestedSlug()).trim().toLowerCase() || 'rcc';
      const forceRefresh = options.forceRefresh === true;
      const bypassCoalescing = options.bypassCoalescing === true;
      const now = Date.now();

      if (inFlight && inFlightSlug === slug) return inFlight;

      if (!bypassCoalescing && lastSnapshot && lastSlug === slug) {
        if (!forceRefresh || now - lastResolvedAt < CONTEXT_FORCE_COALESCE_MS) {
          return Promise.resolve(cloneContext(lastSnapshot));
        }
      }

      inFlightSlug = slug;
      inFlight = Promise.resolve(nativeInitialize(options))
        .then((snapshot) => {
          if (snapshot?.league) {
            lastSnapshot = cloneContext(snapshot);
            lastSlug = String(snapshot.slug || slug);
            lastResolvedAt = Date.now();
          }
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
        clearResolved();
        return nativeInvalidate(options);
      };
    }

    window.addEventListener('rcc:league-context-ready', (event) => {
      const snapshot = event?.detail;
      if (!snapshot?.league) return;
      lastSnapshot = cloneContext(snapshot);
      lastSlug = String(snapshot.slug || requestedSlug());
      lastResolvedAt = Date.now();
    });

    client.auth?.onAuthStateChange?.((event, session) => {
      const nextUserId = session?.user?.id || null;
      if (knownAuthUserId !== undefined && nextUserId !== knownAuthUserId) clearResolved();
      if (event === 'SIGNED_OUT') clearResolved();
      knownAuthUserId = nextUserId;
    });

    leagueContext.__rccAdminContextCoalesced = true;
  }

  function removeDuplicateLeagueSwitchers() {
    const switchers = [...document.querySelectorAll('#admin-league-switcher')];
    if (switchers.length <= 1) return;
    switchers.slice(1).forEach((node) => node.remove());
  }

  function removeCompletedOnboardingPanel() {
    if (!leagueIsComplete) return;
    document.getElementById('admin-section-league-onboarding')?.remove();

    const url = new URL(window.location.href);
    if (url.searchParams.has('onboarding')) {
      url.searchParams.delete('onboarding');
      window.history.replaceState({}, '', url.toString());
    }
  }

  async function hasAnySeason(client, leagueId) {
    if (seasonCheckLeagueId === leagueId) return seasonCheckResult;
    const { data: seasons, error } = await client
      .from('seasons')
      .select('id')
      .eq('league_id', leagueId)
      .limit(1);
    if (error) throw error;
    seasonCheckLeagueId = leagueId;
    seasonCheckResult = Boolean(seasons?.length);
    return seasonCheckResult;
  }

  async function reconcileLeagueState(contextHint = null) {
    if (reconcileRunning) return;
    const client = window.supabaseClient;
    const leagueContext = window.RCCLeagueContext;
    if (!client || !leagueContext) return;

    reconcileRunning = true;
    try {
      const slug = requestedSlug();
      let context = contextHint;
      if (!context?.league || String(context.slug || '') !== slug) {
        context = await leagueContext.initialize({ slug });
      }

      const league = context?.league;
      if (!league?.id) return;

      leagueIsComplete = league.settings?.onboarding_complete === true;
      if (!leagueIsComplete) leagueIsComplete = await hasAnySeason(client, league.id);

      removeCompletedOnboardingPanel();
      removeDuplicateLeagueSwitchers();
    } catch (error) {
      console.warn('RCC onboarding context reconciliation failed.', error);
    } finally {
      reconcileRunning = false;
    }
  }

  function installRpcGuard() {
    const client = window.supabaseClient;
    const leagueContext = window.RCCLeagueContext;
    if (!client || !leagueContext || client.__rccOnboardingContextGuard) return;

    const previousRpc = client.rpc.bind(client);
    client.rpc = (fn, args, options) => {
      if (fn !== 'complete_league_onboarding') return previousRpc(fn, args, options);

      return (async () => {
        const slug = requestedSlug();
        const context = await leagueContext.initialize({
          slug,
          forceRefresh: true,
          bypassCoalescing: true
        });
        if (!context?.leagueId) throw new Error('Die aktuelle Liga konnte nicht eindeutig aufgelöst werden.');
        if (context.slug !== slug) throw new Error('Liga-Kontext stimmt nicht mit der aufgerufenen Liga überein.');

        return previousRpc(fn, {
          ...args,
          p_league_id: context.leagueId
        }, options);
      })();
    };

    client.__rccOnboardingContextGuard = true;
  }

  function installDomGuard() {
    if (observer) return;
    observer = new MutationObserver(() => {
      removeDuplicateLeagueSwitchers();
      if (leagueIsComplete) removeCompletedOnboardingPanel();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function bindContextListener() {
    if (contextListenerBound) return;
    contextListenerBound = true;
    window.addEventListener('rcc:league-context-ready', (event) => {
      removeDuplicateLeagueSwitchers();
      const context = event?.detail;
      if (!context?.league || String(context.slug || '') !== requestedSlug()) return;
      reconcileLeagueState(context);
    });
  }

  async function init() {
    if (initialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const client = window.supabaseClient;
      const leagueContext = window.RCCLeagueContext;
      if (!client || !leagueContext) return;

      installContextRequestCoalescer();
      installRpcGuard();
      installDomGuard();
      bindContextListener();
      await reconcileLeagueState(leagueContext.snapshot?.() || null);
      initialized = true;
    })().finally(() => {
      initPromise = null;
    });

    return initPromise;
  }

  window.RCCOnboardingContextGuard = {
    init,
    reconcile: reconcileLeagueState
  };
})();
