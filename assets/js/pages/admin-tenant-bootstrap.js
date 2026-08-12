(() => {
  if (document.body?.dataset.page !== 'admin') return;

  const FALLBACK_LEAGUE_SLUG = 'rcc';
  let prepared = false;
  let preparing = null;
  let authReloadBound = false;
  let membersModulePromise = null;
  let leagueCreateModulePromise = null;
  let switcherRenderPromise = null;

  function requestedLeagueSlug() {
    const querySlug = String(new URLSearchParams(window.location.search).get('league') || '').trim();
    return querySlug || window.RCCLeagueContext?.getRequestedLeagueSlug?.() || FALLBACK_LEAGUE_SLUG;
  }

  function setAdminSurfaceVisibility(session) {
    const adminActive = Boolean(session?.user && window.RCCLeagueContext?.isAdmin?.());
    document.querySelectorAll('.admin-layout > details').forEach((panel) => {
      if (panel.id === 'admin-section-auth') {
        panel.hidden = false;
        return;
      }
      panel.hidden = !adminActive;
    });
    const tabs = document.getElementById('admin-mobile-tabs');
    if (tabs) tabs.hidden = !adminActive;
  }

  function dedupeLeagueSwitchers() {
    const switchers = [...document.querySelectorAll('#admin-league-switcher')];
    switchers.slice(1).forEach((node) => node.remove());
    return switchers[0] || null;
  }

  async function hasSwitcherAccess(session) {
    if (!session?.user?.id) return false;
    if (window.RCCLeagueContext?.isAdmin?.()) return true;
    try {
      const { data, error } = await window.supabaseClient.rpc('is_platform_owner');
      return !error && data === true;
    } catch (_) {
      return false;
    }
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

  async function getSession() {
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  async function fetchAccessibleLeagues() {
    const session = await getSession();
    if (!session?.user?.id) return [];
    const { data: memberships, error: membershipError } = await window.supabaseClient.from('league_members').select('league_id, role').eq('user_id', session.user.id);
    if (membershipError) throw membershipError;
    if (!memberships?.length) return [];
    const roleByLeagueId = new Map(memberships.map((row) => [row.league_id, row.role]));
    const leagueIds = memberships.map((row) => row.league_id);
    const { data: leagues, error: leagueError } = await window.supabaseClient.from('leagues').select('id, name, slug, status, is_public').in('id', leagueIds).eq('status', 'active').order('name', { ascending: true });
    if (leagueError) throw leagueError;
    return (leagues || []).map((league) => ({ ...league, role: roleByLeagueId.get(league.id) || 'member' }));
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
        switcher.innerHTML = '<span>Deinem Account ist noch keine Liga zugeordnet.</span>';
        switcher.hidden = false;
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
    window.isAdminSession = (session) => Boolean(session?.user && window.RCCLeagueContext?.isAdmin?.());
    window.requireAdminSession = async () => {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data?.session) throw new Error('Keine aktive Session. Bitte zuerst einloggen.');
      await window.RCCData.getLeagueContext({ forceRefresh: true });
      if (!window.RCCLeagueContext?.isAdmin?.()) throw new Error('Du hast in dieser Liga keine Owner- oder Ligaleitungs-Berechtigung.');
      return data.session;
    };
    const originalRefreshSessionStatus = window.refreshSessionStatus;
    if (typeof originalRefreshSessionStatus === 'function') {
      window.refreshSessionStatus = async (...args) => {
        await window.RCCData.getLeagueContext({ forceRefresh: true }).catch(() => null);
        const result = await originalRefreshSessionStatus(...args);
        const session = await getSession().catch(() => null);
        setAdminSurfaceVisibility(session);
        await renderLeagueSwitcher().catch((error) => console.warn('Liga-Auswahl konnte nicht geladen werden.', error));
        const createModule = await loadLeagueCreateModule().catch((error) => console.warn(error));
        await createModule?.init?.();
        return result;
      };
    }
  }

  function bindPrivateLeagueReload(requestedSlug, initializedSlug) {
    if (authReloadBound || requestedSlug === initializedSlug) return;
    authReloadBound = true;
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) navigateToLeague(requestedSlug);
    });
  }

  async function resolveAdminContext() {
    const requestedSlug = requestedLeagueSlug();
    const session = await getSession();
    try {
      return await window.RCCData.getLeagueContext({ slug: requestedSlug, forceRefresh: true });
    } catch (error) {
      if (!session) {
        if (requestedSlug !== FALLBACK_LEAGUE_SLUG) {
          try {
            const fallback = await window.RCCData.getLeagueContext({ slug: FALLBACK_LEAGUE_SLUG, forceRefresh: true });
            bindPrivateLeagueReload(requestedSlug, fallback.slug);
            return fallback;
          } catch (_) {
            bindPrivateLeagueReload(requestedSlug, FALLBACK_LEAGUE_SLUG);
            return null;
          }
        }
        return null;
      }
      const leagues = await fetchAccessibleLeagues();
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
      const context = await resolveAdminContext();
      if (!context) return null;
      if (!context?.leagueId) throw new Error('Keine aktive Liga für das Admin Center gefunden.');
      installLeagueScopedSupabase(context.leagueId);
      installLeagueRoleGuards();
      prepared = true;
      return context;
    })().finally(() => { preparing = null; });
    return preparing;
  }

  window.RCCAdminTenant = { prepare, fetchAccessibleLeagues, renderLeagueSwitcher, navigateToLeague };

  document.addEventListener('DOMContentLoaded', async (event) => {
    event.stopImmediatePropagation();
    setAdminSurfaceVisibility(null);
    try {
      const context = await prepare();
      if (typeof window.initAdminPage === 'function') await window.initAdminPage();
      const session = await getSession().catch(() => null);
      setAdminSurfaceVisibility(session);
      if (!context) return;
      await renderLeagueSwitcher();
      const createModule = await loadLeagueCreateModule();
      await createModule?.init?.();
      const membersModule = await loadLeagueMembersModule();
      await membersModule?.init?.();
    } catch (error) {
      console.error('RCC Admin tenant bootstrap failed.', error);
      setAdminSurfaceVisibility(null);
      const status = document.getElementById('admin-session-status');
      if (status) status.textContent = `Admin Center konnte nicht initialisiert werden: ${error.message}`;
    }
  });
})();
