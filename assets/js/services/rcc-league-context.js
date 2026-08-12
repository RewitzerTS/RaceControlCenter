(() => {
  const DEFAULT_LEAGUE_SLUG = 'rcc';
  const state = {
    league: null,
    membership: null,
    initializedSlug: null,
    initPromise: null,
    initPromiseSlug: null,
    refreshQueued: false
  };

  function normalizeSlug(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || DEFAULT_LEAGUE_SLUG;
  }

  function getRequestedLeagueSlug() {
    const params = new URLSearchParams(window.location.search);
    const querySlug = params.get('league');
    if (querySlug) return normalizeSlug(querySlug);
    const pathMatch = window.location.pathname.match(/(?:^|\/)l\/([a-z0-9-]+)(?:\/|$)/i);
    if (pathMatch?.[1]) return normalizeSlug(pathMatch[1]);
    return DEFAULT_LEAGUE_SLUG;
  }

  async function fetchMembership(client, leagueId) {
    try {
      const { data: authData } = await client.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return null;
      const { data, error } = await client.from('league_members').select('league_id, user_id, role').eq('league_id', leagueId).eq('user_id', userId).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.warn('RCC LeagueContext: membership could not be loaded.', error);
      return null;
    }
  }

  async function initialize(options = {}) {
    const client = window.supabaseClient;
    if (!client) throw new Error('Supabase client is not available.');
    const slug = normalizeSlug(options.slug || getRequestedLeagueSlug());
    const forceRefresh = options.forceRefresh === true;

    // Every caller for the same tenant shares the same in-flight request, even
    // when a second module asks for forceRefresh while initialization is still running.
    if (state.initPromise && state.initPromiseSlug === slug) {
      if (forceRefresh) state.refreshQueued = true;
      return state.initPromise;
    }

    if (!forceRefresh && state.league && state.initializedSlug === slug) return snapshot();

    state.initializedSlug = slug;
    state.initPromiseSlug = slug;
    state.initPromise = (async () => {
      const { data, error } = await client.from('leagues').select('id, name, slug, logo_url, status, is_public, settings').eq('slug', slug).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) throw new Error(`League not found: ${slug}`);
      if (data.status !== 'active') throw new Error(`League is not active: ${slug}`);
      state.league = data;
      state.membership = await fetchMembership(client, data.id);
      window.dispatchEvent(new CustomEvent('rcc:league-context-ready', { detail: snapshot() }));
      return snapshot();
    })().finally(() => {
      state.initPromise = null;
      state.initPromiseSlug = null;
      // A forceRefresh requested during the initial load does not need another
      // immediate network roundtrip: that request already received fresh data.
      state.refreshQueued = false;
    });
    return state.initPromise;
  }

  function snapshot() {
    return { league: state.league ? { ...state.league } : null, membership: state.membership ? { ...state.membership } : null, leagueId: state.league?.id || null, slug: state.league?.slug || state.initializedSlug || getRequestedLeagueSlug(), role: state.membership?.role || null };
  }
  function getLeagueId() { return state.league?.id || null; }
  function getSlug() { return state.league?.slug || state.initializedSlug || getRequestedLeagueSlug(); }
  function getRole() { return state.membership?.role || null; }
  function hasRole(...roles) { return roles.includes(getRole()); }
  function isAdmin() { return hasRole('owner', 'admin', 'steward'); }
  function isStaff() { return hasRole('owner', 'admin', 'steward'); }

  window.RCCLeagueContext = { DEFAULT_LEAGUE_SLUG, initialize, snapshot, getRequestedLeagueSlug, getLeagueId, getSlug, getRole, hasRole, isAdmin, isStaff };
})();
