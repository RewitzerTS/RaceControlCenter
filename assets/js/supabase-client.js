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

// RaceVora is the platform brand. Tenant branding replaces these fallbacks once
// the requested league has loaded; productive tenant data is never rewritten here.
(() => {
  const PLATFORM_NAME = 'RaceVora';
  const PLATFORM_MARK = 'assets/images/racevora-logo-color.png';

  function replaceStaticPlatformTitle() {
    const current = String(document.title || '');
    if (/^Race Control Center\s*·/i.test(current)) {
      document.title = current.replace(/^Race Control Center\s*·/i, `${PLATFORM_NAME} ·`);
    } else if (/^RCC\s*·/i.test(current)) {
      document.title = current.replace(/^RCC\s*·/i, `${PLATFORM_NAME} ·`);
    }
  }

  function ensurePlatformMetadata() {
    replaceStaticPlatformTitle();
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle && /^(RCC|Race Control Center)$/i.test(String(appleTitle.content || '').trim())) {
      appleTitle.content = PLATFORM_NAME;
    }

    const existingSvgIcon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
    if (!existingSvgIcon) {
      const icon = document.createElement('link');
      icon.rel = 'icon';
      icon.type = 'image/svg+xml';
      icon.href = PLATFORM_MARK;
      document.head.appendChild(icon);
    }
  }

  function replaceVisiblePlatformFallbacks(root = document) {
    root.querySelectorAll?.('.f1-loader p').forEach((node) => {
      if (/^Race Control lädt/i.test(String(node.textContent || '').trim())) node.textContent = 'RaceVora lädt…';
    });

    if (RCC_REQUEST_LEAGUE_SLUG !== RCC_DEFAULT_LEAGUE_SLUG) {
      root.querySelectorAll?.('.brand-subtitle').forEach((node) => {
        if (/^Race Control Center$/i.test(String(node.textContent || '').trim())) node.textContent = PLATFORM_NAME;
      });
      root.querySelectorAll?.('.league-brand-footer').forEach((node) => {
        if (String(node.textContent || '').includes(' · Race Control Center')) {
          node.textContent = String(node.textContent || '').replace(' · Race Control Center', ` · ${PLATFORM_NAME}`);
        }
      });
    }
  }

  function patchThemePresetLabels() {
    const presets = window.RCCThemePresets;
    if (!presets || presets.__raceVoraLabelsPatched) return;
    const mapTheme = (theme) => {
      if (!theme || String(theme.id) !== '0') return theme;
      return {
        ...theme,
        name: theme.name === 'RCC Standard' ? 'RaceVora Standard' : theme.name,
        subtitle: theme.subtitle === 'RCC Violett & Teal' ? 'RaceVora Violett & Teal' : theme.subtitle
      };
    };
    const nativeAll = presets.all?.bind(presets);
    const nativeGet = presets.get?.bind(presets);
    const nativeMatch = presets.match?.bind(presets);
    if (nativeAll) presets.all = () => nativeAll().map(mapTheme);
    if (nativeGet) presets.get = (id) => mapTheme(nativeGet(id));
    if (nativeMatch) presets.match = (settings) => mapTheme(nativeMatch(settings));
    presets.__raceVoraLabelsPatched = true;
  }

  ensurePlatformMetadata();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensurePlatformMetadata();
      replaceVisiblePlatformFallbacks(document);
      patchThemePresetLabels();
    }, { once: true });
  } else {
    replaceVisiblePlatformFallbacks(document);
    patchThemePresetLabels();
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        replaceVisiblePlatformFallbacks(node);
      });
    }
  });
  const startObserver = () => document.body && observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });

  window.addEventListener('rcc:league-branding-applied', () => {
    replaceVisiblePlatformFallbacks(document);
    patchThemePresetLabels();
  });
})();

try {
  const previousTenant = window.sessionStorage?.getItem(RCC_TENANT_CACHE_KEY);
  if (previousTenant && previousTenant !== RCC_REQUEST_LEAGUE_SLUG) {
    clearTenantUiCaches();
  }
  window.sessionStorage?.setItem(RCC_LEAGUE_SESSION_KEY, RCC_REQUEST_LEAGUE_SLUG);
  window.sessionStorage?.setItem(RCC_TENANT_CACHE_KEY, RCC_REQUEST_LEAGUE_SLUG);
} catch (_error) {
  // Session storage can be blocked by browser privacy settings.
}

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

// Authenticated helper RPCs are short-circuited locally while anonymous. This
// avoids avoidable 401 traffic without weakening the database-side grants.
(() => {
  const client = window.supabaseClient;
  if (!client?.rpc || client.__rccAuthenticatedRoleRpcGuard) return;

  const authenticatedOnlyBooleanRpcs = new Set([
    'is_platform_owner',
    'is_league_member',
    'has_league_role'
  ]);
  const nativeRpc = client.rpc.bind(client);

  client.rpc = async (fn, args, options) => {
    if (authenticatedOnlyBooleanRpcs.has(String(fn || ''))) {
      try {
        const { data, error } = await client.auth.getSession();
        if (error) return { data: null, error };
        if (!data?.session?.user?.id) return { data: false, error: null };
      } catch (error) {
        return { data: null, error };
      }
    }
    return nativeRpc(fn, args, options);
  };

  client.__rccAuthenticatedRoleRpcGuard = true;
})();

// The bundled Hall-of-Fame JSON is legacy data for the original RCC league.
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

// Canonical tenant/session context. This is the only implementation. It uses the
// locally persisted Supabase session instead of auth.getUser() for every UI probe,
// deduplicates concurrent loads, and only refreshes when explicitly invalidated.
(() => {
  if (window.RCCLeagueContext?.initialize) return;

  const client = window.supabaseClient;
  const state = {
    league: null,
    membership: null,
    initializedSlug: null,
    loadedUserId: null,
    initPromise: null,
    initPromiseSlug: null
  };

  function normalizeSlug(value) {
    return normalizeSupabaseLeagueSlug(value);
  }

  function getRequestedLeagueSlug() {
    return RCC_REQUEST_LEAGUE_SLUG || RCC_DEFAULT_LEAGUE_SLUG;
  }

  async function getSessionUserId() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session?.user?.id || null;
  }

  async function fetchMembership(leagueId, userId) {
    if (!userId) return null;
    const { data, error } = await client
      .from('league_members')
      .select('league_id, user_id, role')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
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

  function invalidate(options = {}) {
    const invalidateLeague = options.league === true;
    const invalidateMembership = options.membership !== false;
    if (invalidateLeague) {
      state.league = null;
      state.initializedSlug = null;
    }
    if (invalidateMembership) {
      state.membership = null;
      state.loadedUserId = null;
    }
  }

  async function initialize(options = {}) {
    const slug = normalizeSlug(options.slug || getRequestedLeagueSlug());
    const forceRefresh = options.forceRefresh === true;
    const userId = await getSessionUserId();

    if (state.initPromise && state.initPromiseSlug === slug) {
      return state.initPromise;
    }

    const leagueReusable = Boolean(state.league && state.initializedSlug === slug);
    const membershipReusable = state.loadedUserId === userId;
    if (!forceRefresh && leagueReusable && membershipReusable) return snapshot();

    state.initializedSlug = slug;
    state.initPromiseSlug = slug;
    state.initPromise = (async () => {
      let league = leagueReusable && !forceRefresh ? state.league : null;
      if (!league) {
        const { data, error } = await client
          .from('leagues')
          .select('id, name, slug, logo_url, status, is_public, settings')
          .eq('slug', slug)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) throw new Error(`League not found: ${slug}`);
        if (data.status !== 'active') throw new Error(`League is not active: ${slug}`);
        league = data;
      }

      state.league = league;
      state.membership = await fetchMembership(league.id, userId);
      state.loadedUserId = userId;

      const current = snapshot();
      window.dispatchEvent(new CustomEvent('rcc:league-context-ready', { detail: current }));
      return current;
    })().finally(() => {
      state.initPromise = null;
      state.initPromiseSlug = null;
    });

    return state.initPromise;
  }

  function getLeagueId() { return state.league?.id || null; }
  function getSlug() { return state.league?.slug || state.initializedSlug || getRequestedLeagueSlug(); }
  function getRole() { return state.membership?.role || null; }
  function hasRole(...roles) { return roles.includes(getRole()); }
  function isAdmin() { return hasRole('owner', 'admin'); }
  function isStaff() { return hasRole('owner', 'admin', 'steward'); }

  window.RCCLeagueContext = {
    DEFAULT_LEAGUE_SLUG: RCC_DEFAULT_LEAGUE_SLUG,
    initialize,
    snapshot,
    invalidate,
    getRequestedLeagueSlug,
    getLeagueId,
    getSlug,
    getRole,
    hasRole,
    isAdmin,
    isStaff
  };

  if (client?.auth?.onAuthStateChange) {
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        invalidate({ membership: true });
        return;
      }
      if (['SIGNED_IN', 'USER_UPDATED'].includes(event)) {
        const nextUserId = session?.user?.id || null;
        if (nextUserId !== state.loadedUserId) invalidate({ membership: true });
      }
    });
  }
})();

// Shared navigation access. The context-ready event only updates UI from the
// supplied snapshot; it never triggers another forced context load.
(() => {
  const client = window.supabaseClient;
  let refreshPromise = null;
  let authListenerBound = false;
  let platformOwnerCache = { userId: null, value: false, promise: null };

  function scopedAdminHref(slug) {
    const target = new URL('admin.html', window.location.href);
    target.searchParams.set('league', normalizeSupabaseLeagueSlug(slug || RCC_REQUEST_LEAGUE_SLUG));
    return `${target.pathname.split('/').pop()}${target.search}`;
  }

  function removeLegacyBrandShortcut() {
    const brand = document.querySelector('.brand');
    if (!brand || brand.dataset.directNavigation === 'true') return;
    const replacement = brand.cloneNode(true);
    replacement.dataset.directNavigation = 'true';
    brand.replaceWith(replacement);
  }

  function hideAdminEntry() {
    const link = document.querySelector('[data-admin-nav-link]');
    if (!link) return;
    link.hidden = true;
    link.removeAttribute('aria-current');
  }

  function resetPlatformOwnerCache() {
    platformOwnerCache = { userId: null, value: false, promise: null };
  }

  async function isPlatformOwner(userId) {
    if (!userId) return false;
    if (platformOwnerCache.userId === userId && platformOwnerCache.promise) {
      return platformOwnerCache.promise;
    }
    if (platformOwnerCache.userId === userId) return platformOwnerCache.value;

    const promise = client.rpc('is_platform_owner')
      .then(({ data, error }) => {
        if (error) {
          console.warn('Admin-Navigation: Plattform-Owner-Status konnte nicht geprüft werden.', error);
          return false;
        }
        return data === true;
      })
      .then((value) => {
        platformOwnerCache = { userId, value, promise: null };
        return value;
      })
      .catch((error) => {
        console.warn('Admin-Navigation: Plattform-Owner-Status konnte nicht geprüft werden.', error);
        platformOwnerCache = { userId, value: false, promise: null };
        return false;
      });

    platformOwnerCache = { userId, value: false, promise };
    return promise;
  }

  async function refreshAdminEntry(options = {}) {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const link = document.querySelector('[data-admin-nav-link]');
      if (!link || !client?.auth) return;
      hideAdminEntry();

      const { data, error } = await client.auth.getSession();
      const userId = data?.session?.user?.id || null;
      if (error || !userId) return;

      let context = options.context || null;
      try {
        if (!context) {
          context = await window.RCCLeagueContext?.initialize?.({
            slug: RCC_REQUEST_LEAGUE_SLUG,
            forceRefresh: options.forceContextRefresh === true
          });
        }
      } catch (errorContext) {
        console.warn('Admin-Navigation: Liga-Kontext konnte nicht geladen werden.', errorContext);
      }

      let allowed = ['owner', 'admin', 'steward'].includes(String(context?.role || '').toLowerCase());
      if (!allowed) allowed = await isPlatformOwner(userId);
      if (!allowed) return;

      link.href = scopedAdminHref(context?.slug || RCC_REQUEST_LEAGUE_SLUG);
      link.hidden = false;
    })().finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  document.addEventListener('layout:loaded', () => {
    window.setTimeout(removeLegacyBrandShortcut, 0);
    refreshAdminEntry().catch(() => {});

    if (!authListenerBound && client?.auth?.onAuthStateChange) {
      authListenerBound = true;
      client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          resetPlatformOwnerCache();
          hideAdminEntry();
          return;
        }
        if (['SIGNED_IN', 'USER_UPDATED'].includes(event)) {
          resetPlatformOwnerCache();
          window.RCCLeagueContext?.invalidate?.({ membership: true });
          window.setTimeout(() => refreshAdminEntry({ forceContextRefresh: true }).catch(() => {}), 0);
        }
      });
    }
  });

  window.addEventListener('rcc:league-context-ready', (event) => {
    refreshAdminEntry({ context: event?.detail || null }).catch(() => {});
  });

  window.RCCNavigationAccess = { refresh: refreshAdminEntry };
})();
