(() => {
  if (document.body?.dataset.page !== 'admin') return;

  const FALLBACK_LEAGUE_SLUG = 'rcc';
  const ADMIN_UI_HINT_PREFIX = 'rcc.adminUiHint.v2:';
  const ADMIN_UI_HINT_MAX_AGE_MS = 1000 * 60 * 60 * 12;
  const ADMIN_ROLES = new Set(['owner', 'admin']);
  const PRIVILEGED_ROLES = new Set(['owner', 'admin', 'steward']);
  let prepared = false;
  let preparing = null;
  let authReloadBound = false;
  let membersModulePromise = null;
  let leagueCreateModulePromise = null;
  let adminResultsUiPromise = null;
  let switcherRenderPromise = null;

  // The Admin Center uses the same RaceVora account/session as every other page.
  // Remove the legacy second login UI as soon as the deferred bootstrap executes.
  document.getElementById('admin-section-auth')?.remove();

  function requestedLeagueSlug() {
    const querySlug = String(new URLSearchParams(window.location.search).get('league') || '').trim();
    return querySlug || window.RCCLeagueContext?.getRequestedLeagueSlug?.() || FALLBACK_LEAGUE_SLUG;
  }

  function currentRole(context = null) {
    return String(context?.role || window.RCCLeagueContext?.getRole?.() || '').trim().toLowerCase();
  }

  function hasPrivilegedRole(role) {
    return PRIVILEGED_ROLES.has(String(role || '').trim().toLowerCase());
  }

  function hasAdminRole(role) {
    return ADMIN_ROLES.has(String(role || '').trim().toLowerCase());
  }

  function adminUiHintKey() {
    return `${ADMIN_UI_HINT_PREFIX}${requestedLeagueSlug()}`;
  }

  function clearAdminUiHint() {
    try {
      window.sessionStorage?.removeItem(adminUiHintKey());
    } catch (_) {
      // Session storage is an optional UI optimization only.
    }
  }

  function readAdminUiHint(session) {
    if (!session?.user?.id) return null;
    try {
      const raw = window.sessionStorage?.getItem(adminUiHintKey());
      if (!raw) return null;
      const hint = JSON.parse(raw);
      const age = Date.now() - Number(hint?.savedAt || 0);
      if (!hint || hint.userId !== session.user.id || age < 0 || age > ADMIN_UI_HINT_MAX_AGE_MS) {
        clearAdminUiHint();
        return null;
      }
      if (!hasPrivilegedRole(hint.role)) {
        clearAdminUiHint();
        return null;
      }
      return hint;
    } catch (_) {
      clearAdminUiHint();
      return null;
    }
  }

  function writeAdminUiHint(session, context) {
    const role = currentRole(context);
    if (!session?.user?.id || !context?.leagueId || !hasPrivilegedRole(role)) {
      clearAdminUiHint();
      return;
    }
    try {
      window.sessionStorage?.setItem(adminUiHintKey(), JSON.stringify({
        userId: session.user.id,
        email: session.user.email || '',
        leagueId: context.leagueId,
        slug: context.slug || requestedLeagueSlug(),
        role,
        savedAt: Date.now()
      }));
    } catch (_) {
      // Session storage is an optional UI optimization only.
    }
  }

  function loginHref() {
    const next = `${window.location.pathname.split('/').pop() || 'admin.html'}${window.location.search || ''}`;
    const url = new URL('index.html', window.location.href);
    url.searchParams.set('login', '1');
    url.searchParams.set('next', next);
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  function leagueHomeHref(slug = requestedLeagueSlug()) {
    const url = new URL('race-hub.html', window.location.href);
    url.searchParams.set('league', slug || FALLBACK_LEAGUE_SLUG);
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  function redirectToLogin() {
    window.location.replace(loginHref());
  }

  function redirectToLeague(slug = requestedLeagueSlug()) {
    window.location.replace(leagueHomeHref(slug));
  }

  function setAdminSurfaceVisibility(session, options = {}) {
    const role = String(options.role || currentRole() || '').toLowerCase();
    const privilegedActive = Boolean(session?.user && (options.assumePrivileged === true || hasPrivilegedRole(role)));
    const stewardMode = privilegedActive && role === 'steward';

    document.body.dataset.adminAccessReady = 'true';
    document.body.dataset.adminAccessRole = privilegedActive ? role : 'none';

    document.querySelectorAll('.admin-layout > details').forEach((panel) => {
      const allowed = privilegedActive && (!stewardMode || panel.id === 'admin-section-stewarding');
      panel.hidden = !allowed;
      if (allowed && stewardMode && panel.tagName === 'DETAILS') panel.open = true;
    });

    const sectionHeader = document.querySelector('.section-header');
    if (sectionHeader) sectionHeader.hidden = !privilegedActive;

    const tabs = document.getElementById('admin-mobile-tabs');
    if (tabs) {
      tabs.hidden = !privilegedActive;
      tabs.querySelectorAll('[data-admin-tab-target]').forEach((button) => {
        const allowed = !stewardMode || button.dataset.adminTabTarget === 'admin-section-stewarding';
        button.hidden = !allowed;
        if (stewardMode) {
          const active = allowed;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-selected', String(active));
        }
      });
    }

    if (privilegedActive && stewardMode) {
      const stewardButton = tabs?.querySelector('[data-admin-tab-target="admin-section-stewarding"]');
      stewardButton?.click?.();
    } else if (privilegedActive && typeof window.syncAdminTabVisibility === 'function') {
      window.syncAdminTabVisibility();
    }
  }

  function dedupeLeagueSwitchers() {
    const switchers = [...document.querySelectorAll('#admin-league-switcher')];
    switchers.slice(1).forEach((node) => node.remove());
    return switchers[0] || null;
  }

  async function getSession() {
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  async function fetchAccessibleLeagues() {
    const session = await getSession();
    if (!session?.user?.id) return [];
    const { data: memberships, error: membershipError } = await window.supabaseClient
      .from('league_members')
      .select('league_id, role')
      .eq('user_id', session.user.id);
    if (membershipError) throw membershipError;
    const privilegedMemberships = (memberships || []).filter((row) => hasPrivilegedRole(row.role));
    if (!privilegedMemberships.length) return [];
    const roleByLeagueId = new Map(privilegedMemberships.map((row) => [row.league_id, row.role]));
    const leagueIds = privilegedMemberships.map((row) => row.league_id);
    const { data: leagues, error: leagueError } = await window.supabaseClient
      .from('leagues')
      .select('id, name, slug, status, is_public')
      .in('id', leagueIds)
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (leagueError) throw leagueError;
    return (leagues || []).map((league) => ({ ...league, role: roleByLeagueId.get(league.id) || 'member' }));
  }

  async function hasSwitcherAccess(session) {
    if (!session?.user?.id) return false;
    if (hasPrivilegedRole(currentRole())) return true;
    try {
      const { data, error } = await window.supabaseClient.rpc('is_platform_owner');
      return !error && data === true;
    } catch (_) {
      return false;
    }
  }

  function roleLabel(role) {
    const labels = { owner: 'Owner', admin: 'Ligaleitung', steward: 'Steward', member: 'Mitglied' };
    return labels[role] || role || 'Mitglied';
  }

  function navigateToLeague(slug) {
    const url = new URL(window.location.href);
    url.searchParams.set('league', slug);
    window.location.assign(url.toString());
  }

  async function renderLeagueSwitcher() {
    if (switcherRenderPromise) return switcherRenderPromise;
    switcherRenderPromise = (async () => {
      const session = await getSession();
      let switcher = dedupeLeagueSwitchers();
      if (!session || !(await hasSwitcherAccess(session))) {
        switcher?.remove();
        return;
      }

      if (!switcher) {
        switcher = document.createElement('div');
        switcher.id = 'admin-league-switcher';
        switcher.className = 'container admin-session-banner';
        const banner = document.getElementById('admin-session-banner');
        if (banner?.parentNode) banner.parentNode.insertBefore(switcher, banner.nextSibling);
      }

      const leagues = await fetchAccessibleLeagues();
      const currentSlug = window.RCCLeagueContext?.getSlug?.() || requestedLeagueSlug();
      if (!leagues.length) {
        switcher?.remove();
        return;
      }
      switcher.innerHTML = `<label for="admin-league-select"><strong>Aktive Liga:</strong></label><select id="admin-league-select" aria-label="Aktive Liga auswählen">${leagues.map((league) => `<option value="${league.slug}" ${league.slug === currentSlug ? 'selected' : ''}>${league.name} · ${roleLabel(league.role)}</option>`).join('')}</select>`;
      switcher.hidden = false;
      const select = switcher.querySelector('#admin-league-select');
      select?.addEventListener('change', () => {
        const nextSlug = String(select.value || '').trim();
        if (nextSlug && nextSlug !== currentSlug) navigateToLeague(nextSlug);
      });
      dedupeLeagueSwitchers();
    })().finally(() => { switcherRenderPromise = null; });
    return switcherRenderPromise;
  }

  function addLeagueId(payload, leagueId, table) {
    const enhanceRow = (row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
      const next = { ...row, league_id: leagueId };
      if (table === 'seasons' && !String(next.slug || '').trim()) {
        const base = String(next.name || 'season').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'season';
        next.slug = base;
      }
      return next;
    };
    return Array.isArray(payload) ? payload.map(enhanceRow) : enhanceRow(payload);
  }

  async function loadLeagueMembersModule() {
    if (window.RCCLeagueMembers) return window.RCCLeagueMembers;
    if (membersModulePromise) return membersModulePromise;
    membersModulePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/js/pages/admin-members.js';
      script.onload = () => resolve(window.RCCLeagueMembers);
      script.onerror = () => reject(new Error('Liga-Mitglieder-Modul konnte nicht geladen werden.'));
      document.head.appendChild(script);
    }).finally(() => { membersModulePromise = null; });
    return membersModulePromise;
  }

  async function loadLeagueCreateModule() {
    if (window.RCCLeagueCreate) return window.RCCLeagueCreate;
    if (leagueCreateModulePromise) return leagueCreateModulePromise;
    leagueCreateModulePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/js/pages/admin-league-create.js';
      script.onload = () => resolve(window.RCCLeagueCreate);
      script.onerror = () => reject(new Error('Liga-Erstellen-Modul konnte nicht geladen werden.'));
      document.head.appendChild(script);
    }).finally(() => { leagueCreateModulePromise = null; });
    return leagueCreateModulePromise;
  }

  async function loadAdminResultsUi() {
    if (window.RCCWizardDialog && window.RCCResultsWorkflow) {
      window.RCCResultsWorkflow.ensureLauncher?.();
      return window.RCCResultsWorkflow;
    }
    if (adminResultsUiPromise) return adminResultsUiPromise;

    const loadScript = (src, globalName, errorMessage) => {
      if (window[globalName]) return Promise.resolve(window[globalName]);
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-rcc-dynamic-src="${src}"]`);
        if (existing) {
          existing.addEventListener('load', () => resolve(window[globalName]), { once: true });
          existing.addEventListener('error', () => reject(new Error(errorMessage)), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.dataset.rccDynamicSrc = src;
        script.onload = () => resolve(window[globalName]);
        script.onerror = () => reject(new Error(errorMessage));
        document.head.appendChild(script);
      });
    };

    adminResultsUiPromise = (async () => {
      await loadScript('assets/js/components/rcc-wizard-dialog.js', 'RCCWizardDialog', 'Dialog-Komponente konnte nicht geladen werden.');
      const workflow = await loadScript('assets/js/components/rcc-results-workflow.js', 'RCCResultsWorkflow', 'Ergebnis-Workflow konnte nicht geladen werden.');
      workflow?.ensureLauncher?.();
      return workflow;
    })().finally(() => { adminResultsUiPromise = null; });

    return adminResultsUiPromise;
  }

  function installLeagueScopedSupabase(leagueId) {
    const client = window.supabaseClient;
    if (!client || client.__rccLeagueScoped === leagueId) return;
    const originalFrom = client.from.bind(client);
    const rootTables = new Set(['drivers', 'seasons', 'league_content']);
    client.from = (table) => {
      const builder = originalFrom(table);
      if (!rootTables.has(table)) return builder;
      const originalSelect = builder.select.bind(builder);
      const originalInsert = builder.insert.bind(builder);
      const originalUpsert = builder.upsert.bind(builder);
      const originalUpdate = builder.update.bind(builder);
      const originalDelete = builder.delete.bind(builder);
      builder.select = (...args) => originalSelect(...args).eq('league_id', leagueId);
      builder.insert = (payload, options) => originalInsert(addLeagueId(payload, leagueId, table), options);
      builder.upsert = (payload, options = {}) => originalUpsert(addLeagueId(payload, leagueId, table), table === 'league_content' ? { ...options, onConflict: 'league_id,id' } : options);
      builder.update = (...args) => originalUpdate(...args).eq('league_id', leagueId);
      builder.delete = (...args) => originalDelete(...args).eq('league_id', leagueId);
      return builder;
    };
    client.__rccLeagueScoped = leagueId;
  }

  function installLeagueRoleGuards() {
    window.isAdminSession = (session) => Boolean(session?.user && hasAdminRole(currentRole()));
    window.requireAdminSession = async () => {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data?.session) throw new Error('Keine aktive RaceVora-Session.');
      await window.RCCData.getLeagueContext({ forceRefresh: true });
      if (!hasAdminRole(currentRole())) throw new Error('Du hast in dieser Liga keine Owner- oder Ligaleitungs-Berechtigung.');
      return data.session;
    };

    const originalRefreshSessionStatus = window.refreshSessionStatus;
    if (typeof originalRefreshSessionStatus === 'function' && !originalRefreshSessionStatus.__rccUnifiedAccess) {
      const wrappedRefresh = async (...args) => {
        const sessionBeforeRefresh = await getSession().catch(() => null);
        if (sessionBeforeRefresh?.user && !window.RCCLeagueContext?.getRole?.()) {
          await window.RCCData.getLeagueContext({ forceRefresh: true }).catch(() => null);
        } else if (sessionBeforeRefresh?.user) {
          await window.RCCData.getLeagueContext().catch(() => null);
        }
        const result = await originalRefreshSessionStatus(...args);
        const session = await getSession().catch(() => null);
        const context = window.RCCLeagueContext?.snapshot?.() || null;
        const role = currentRole(context);
        if (session && hasPrivilegedRole(role)) writeAdminUiHint(session, context);
        else clearAdminUiHint();
        setAdminSurfaceVisibility(session, { role });
        await renderLeagueSwitcher().catch((error) => console.warn('Liga-Auswahl konnte nicht geladen werden.', error));
        return result;
      };
      wrappedRefresh.__rccUnifiedAccess = true;
      window.refreshSessionStatus = wrappedRefresh;
    }
  }

  function bindAuthAccessRedirect() {
    if (authReloadBound) return;
    authReloadBound = true;
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearAdminUiHint();
        redirectToLogin();
      }
    });
  }

  async function resolveAdminContext(session) {
    if (!session?.user) return null;
    const requestedSlug = requestedLeagueSlug();
    try {
      return await window.RCCData.getLeagueContext({ slug: requestedSlug, forceRefresh: true });
    } catch (error) {
      const leagues = await fetchAccessibleLeagues().catch(() => []);
      const first = leagues[0];
      if (first?.slug && first.slug !== requestedSlug) {
        navigateToLeague(first.slug);
        return null;
      }
      const wrapped = new Error(`Die angeforderte Liga "${requestedSlug}" konnte nicht geladen werden. ${error.message || ''}`.trim());
      wrapped.cause = error;
      throw wrapped;
    }
  }

  async function prepare() {
    if (prepared) return window.RCCLeagueContext || null;
    if (preparing) return preparing;
    preparing = (async () => {
      const session = await getSession();
      if (!session?.user) return null;
      const context = await resolveAdminContext(session);
      if (!context) return null;
      if (!context?.leagueId) throw new Error('Keine aktive Liga für das Admin Center gefunden.');
      installLeagueScopedSupabase(context.leagueId);
      installLeagueRoleGuards();
      prepared = true;
      return context;
    })().finally(() => { preparing = null; });
    return preparing;
  }

  async function initStewardPage() {
    window.populateDriverDropdowns?.();
    window.bindUiEvents?.();
    window.bindAuthListener?.();
    window.initAdminMobileTabs?.();
    await Promise.all([
      Promise.resolve(window.populateStewardDriverSelects?.()),
      Promise.resolve(window.loadStewardCasesForAdmin?.()),
      Promise.resolve(window.refreshSessionStatus?.())
    ]);
    const stewardButton = document.querySelector('#admin-mobile-tabs [data-admin-tab-target="admin-section-stewarding"]');
    stewardButton?.click?.();
  }

  window.RCCAdminTenant = { prepare, fetchAccessibleLeagues, renderLeagueSwitcher, navigateToLeague };

  document.addEventListener('DOMContentLoaded', async (event) => {
    event.stopImmediatePropagation();

    const initialSession = await getSession().catch(() => null);
    if (!initialSession?.user) {
      clearAdminUiHint();
      redirectToLogin();
      return;
    }

    const cachedHint = readAdminUiHint(initialSession);
    if (cachedHint) setAdminSurfaceVisibility(initialSession, { assumePrivileged: true, role: cachedHint.role });
    else setAdminSurfaceVisibility(null);

    try {
      const context = await prepare();
      const session = await getSession().catch(() => null);
      if (!session?.user) {
        redirectToLogin();
        return;
      }
      if (!context) return;

      const role = currentRole(context);
      if (!hasPrivilegedRole(role)) {
        clearAdminUiHint();
        redirectToLeague(context.slug || requestedLeagueSlug());
        return;
      }

      writeAdminUiHint(session, context);
      bindAuthAccessRedirect();
      setAdminSurfaceVisibility(session, { role });

      if (role === 'steward') {
        await initStewardPage();
        setAdminSurfaceVisibility(session, { role });
        await renderLeagueSwitcher();
        return;
      }

      const adminUiReady = loadAdminResultsUi().catch((error) => {
        console.warn('Ergebnis-Workflow konnte nicht geladen werden.', error);
        return null;
      });
      await adminUiReady;

      const adminInitPromise = typeof window.initAdminPage === 'function'
        ? Promise.resolve(window.initAdminPage())
        : Promise.resolve();
      setAdminSurfaceVisibility(session, { role });
      await adminInitPromise;
      setAdminSurfaceVisibility(session, { role });

      await renderLeagueSwitcher();
      const createModule = await loadLeagueCreateModule();
      await createModule?.init?.();
      const membersModule = await loadLeagueMembersModule();
      await membersModule?.init?.();
    } catch (error) {
      console.error('RCC Admin tenant bootstrap failed.', error);
      clearAdminUiHint();
      const session = await getSession().catch(() => null);
      if (!session?.user) redirectToLogin();
      else redirectToLeague(requestedLeagueSlug());
    }
  });
})();