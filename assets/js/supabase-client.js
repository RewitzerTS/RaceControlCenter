const SUPABASE_URL = 'https://kjccstcbqygxuqkvdaqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY2NzdGNicXlneHVxa3ZkYXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU4NzYsImV4cCI6MjA5MDY0MTg3Nn0.7aojXjXa4nfHRiT8CrGo6tX-lqAxYQ6mCMaHLhjo1J8';
const RCC_DEFAULT_LEAGUE_SLUG = 'rcc';
const RCC_LEAGUE_SESSION_KEY = 'rcc.activeLeagueSlug.v1';
const RCC_TENANT_CACHE_KEY = 'rcc.lastTenantSlug.v1';

function normalizeSupabaseLeagueSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '') || RCC_DEFAULT_LEAGUE_SLUG;
}

function readStoredLeagueSlug() {
  try {
    const stored = window.sessionStorage?.getItem(RCC_LEAGUE_SESSION_KEY);
    return stored ? normalizeSupabaseLeagueSlug(stored) : RCC_DEFAULT_LEAGUE_SLUG;
  } catch (_error) {
    return RCC_DEFAULT_LEAGUE_SLUG;
  }
}

function resolveSupabaseLeagueSlug() {
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get('league');
  if (querySlug) return normalizeSupabaseLeagueSlug(querySlug);

  const pathMatch = window.location.pathname.match(/(?:^|\/)l\/([a-z0-9-]+)(?:\/|$)/i);
  if (pathMatch?.[1]) return normalizeSupabaseLeagueSlug(pathMatch[1]);

  return readStoredLeagueSlug();
}

function removeSessionStorageByPrefix(prefix) {
  try {
    const storage = window.sessionStorage;
    if (!storage) return;
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch (_error) {
    // Session storage is optional.
  }
}

function clearTenantUiCaches() {
  try {
    window.sessionStorage?.removeItem('rcc.dashboard.view.v1');
    window.sessionStorage?.removeItem('rcc.calendar.activeSection');
    window.sessionStorage?.removeItem('rcc.calendar.archiveSeason');
    removeSessionStorageByPrefix('rcc.standings.view.v1:');
  } catch (_error) {
    // Session storage can be blocked by browser privacy settings.
  }
}

const RCC_REQUEST_LEAGUE_SLUG = resolveSupabaseLeagueSlug();

try {
  const previousTenant = window.sessionStorage?.getItem(RCC_TENANT_CACHE_KEY);
  if (previousTenant && previousTenant !== RCC_REQUEST_LEAGUE_SLUG) {
    // Never render cached HTML or UI state from another tenant while the new
    // tenant data is still loading. This avoids even a brief cross-league flash.
    clearTenantUiCaches();
  }
  window.sessionStorage?.setItem(RCC_LEAGUE_SESSION_KEY, RCC_REQUEST_LEAGUE_SLUG);
  window.sessionStorage?.setItem(RCC_TENANT_CACHE_KEY, RCC_REQUEST_LEAGUE_SLUG);
} catch (_error) {
  // Session storage can be blocked by browser privacy settings.
}

// JS redirects can accidentally drop ?league=. Restore the non-default tenant
// immediately so every subsequent link and request sees the same context.
if (RCC_REQUEST_LEAGUE_SLUG !== RCC_DEFAULT_LEAGUE_SLUG) {
  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.get('league')) {
    currentUrl.searchParams.set('league', RCC_REQUEST_LEAGUE_SLUG);
    window.history.replaceState(window.history.state, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  }
}

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'rcc_admin_session'
  },
  global: {
    headers: {
      'x-rcc-league-slug': RCC_REQUEST_LEAGUE_SLUG
    }
  }
});

// The bundled Hall-of-Fame JSON is legacy data for the original RCC league.
// Other tenants must show an empty history until they archive their own season.
if (RCC_REQUEST_LEAGUE_SLUG !== RCC_DEFAULT_LEAGUE_SLUG && typeof window.fetch === 'function') {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      if (rawUrl) {
        const url = new URL(rawUrl, window.location.href);
        if (url.pathname.endsWith('/data/hall-of-fame-fallback.json')) {
          return Promise.resolve(new Response(JSON.stringify({ history: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
      }
    } catch (_error) {
      // Fall through to the native request.
    }
    return nativeFetch(input, init);
  };
}

// Make the tenant context available before admin-tenant-bootstrap.js executes.
// Without this early context, the bootstrap can incorrectly fall back to the
// default `rcc` league before rcc-league-context.js has been dynamically loaded.
(() => {
  if (window.RCCLeagueContext?.initialize) return;

  const DEFAULT_LEAGUE_SLUG = RCC_DEFAULT_LEAGUE_SLUG;
  const state = {
    league: null,
    membership: null,
    initializedSlug: null,
    initPromise: null
  };

  function normalizeSlug(value) {
    return normalizeSupabaseLeagueSlug(value);
  }

  function getRequestedLeagueSlug() {
    return RCC_REQUEST_LEAGUE_SLUG || DEFAULT_LEAGUE_SLUG;
  }

  async function fetchMembership(client, leagueId) {
    try {
      const { data: authData } = await client.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return null;

      const { data, error } = await client
        .from('league_members')
        .select('league_id, user_id, role')
        .eq('league_id', leagueId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.warn('RCC LeagueContext: membership could not be loaded.', error);
      return null;
    }
  }

  function snapshot() {
    return {
      league: state.league ? { ...state.league } : null,
      membership: state.membership ? { ...state.membership } : null,
      leagueId: state.league?.id || null,
      slug: state.league?.slug || state.initializedSlug || getRequestedLeagueSlug(),
      role: state.membership?.role || null
    };
  }

  async function initialize(options = {}) {
    const client = window.supabaseClient;
    if (!client) throw new Error('Supabase client is not available.');

    const slug = normalizeSlug(options.slug || getRequestedLeagueSlug());
    if (!options.forceRefresh && state.league && state.initializedSlug === slug) return snapshot();
    if (!options.forceRefresh && state.initPromise && state.initializedSlug === slug) return state.initPromise;

    state.initializedSlug = slug;
    state.initPromise = (async () => {
      const { data, error } = await client
        .from('leagues')
        .select('id, name, slug, logo_url, status, is_public, settings')
        .eq('slug', slug)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) throw new Error(`League not found: ${slug}`);
      if (data.status !== 'active') throw new Error(`League is not active: ${slug}`);

      state.league = data;
      state.membership = await fetchMembership(client, data.id);
      window.dispatchEvent(new CustomEvent('rcc:league-context-ready', { detail: snapshot() }));
      return snapshot();
    })().finally(() => {
      state.initPromise = null;
    });

    return state.initPromise;
  }

  function getLeagueId() { return state.league?.id || null; }
  function getSlug() { return state.league?.slug || state.initializedSlug || getRequestedLeagueSlug(); }
  function getRole() { return state.membership?.role || null; }
  function hasRole(...roles) { return roles.includes(getRole()); }
  function isAdmin() { return hasRole('owner', 'admin', 'steward'); }
  function isStaff() { return hasRole('owner', 'admin', 'steward'); }

  window.RCCLeagueContext = {
    DEFAULT_LEAGUE_SLUG,
    initialize,
    snapshot,
    getRequestedLeagueSlug,
    getLeagueId,
    getSlug,
    getRole,
    hasRole,
    isAdmin,
    isStaff
  };
})();
