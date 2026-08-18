(() => {
  if (window.RCCContextRequestCoalescer?.installed) return;

  const leagueContext = window.RCCLeagueContext;
  const client = window.supabaseClient;
  if (!leagueContext?.initialize || !client?.auth) return;

  const FORCE_COALESCE_MS = 2500;
  const nativeInitialize = leagueContext.initialize.bind(leagueContext);
  const nativeInvalidate = typeof leagueContext.invalidate === 'function'
    ? leagueContext.invalidate.bind(leagueContext)
    : null;

  let inFlight = null;
  let inFlightSlug = null;
  let lastSnapshot = null;
  let lastSlug = null;
  let lastResolvedAt = 0;
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
    lastResolvedAt = Date.now();
  }

  function clear() {
    lastSnapshot = null;
    lastSlug = null;
    lastResolvedAt = 0;
  }

  const seed = leagueContext.snapshot?.();
  if (seed?.league) remember(seed, seed.slug);

  leagueContext.initialize = (options = {}) => {
    const slug = normalizeSlug(options.slug);
    const forceRefresh = options.forceRefresh === true;
    const bypassCoalescing = options.bypassCoalescing === true;
    const now = Date.now();

    if (!bypassCoalescing && inFlight && inFlightSlug === slug) return inFlight;

    if (!bypassCoalescing && lastSnapshot && lastSlug === slug) {
      if (!forceRefresh || now - lastResolvedAt < FORCE_COALESCE_MS) {
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

  window.addEventListener('rcc:league-context-ready', (event) => {
    remember(event?.detail, event?.detail?.slug);
  });

  client.auth.onAuthStateChange((event, session) => {
    const nextUserId = session?.user?.id || null;
    if (knownUserId !== undefined && nextUserId !== knownUserId) clear();
    if (event === 'SIGNED_OUT') clear();
    knownUserId = nextUserId;
  });

  window.RCCContextRequestCoalescer = Object.freeze({
    installed: true,
    forceWindowMs: FORCE_COALESCE_MS
  });
})();
