(() => {
  'use strict';

  if (window.__raceVoraAppUxPolish) return;
  window.__raceVoraAppUxPolish = true;

  const SESSION_KEY = 'rcc.activeLeagueSlug.v1';
  const TENANT_KEY = 'rcc.lastTenantSlug.v1';

  function currentLeagueSlug() {
    const params = new URLSearchParams(window.location.search);
    const query = String(params.get('league') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (query) return query;
    try {
      return String(sessionStorage.getItem(SESSION_KEY) || 'rcc').trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'rcc';
    } catch (_) {
      return 'rcc';
    }
  }

  function setLeagueContext(slug) {
    const normalized = String(slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!normalized) return;
    try {
      sessionStorage.setItem(SESSION_KEY, normalized);
      sessionStorage.setItem(TENANT_KEY, normalized);
      sessionStorage.removeItem('rcc.dashboard.view.v1');
      sessionStorage.removeItem('rcc.calendar.activeSection');
      sessionStorage.removeItem('rcc.calendar.archiveSeason');
      [...Array(sessionStorage.length).keys()]
        .map((index) => sessionStorage.key(index))
        .filter((key) => key?.startsWith('rcc.standings.view.v1:'))
        .forEach((key) => sessionStorage.removeItem(key));
    } catch (_) {
      // Storage may be unavailable in privacy mode.
    }
  }

  async function fetchAccessibleLeagues(userId) {
    if (!userId || !window.supabaseClient) return [];
    const membershipsResponse = await window.supabaseClient
      .from('league_members')
      .select('league_id, role')
      .eq('user_id', userId);
    if (membershipsResponse.error) throw membershipsResponse.error;
    const memberships = membershipsResponse.data || [];
    if (!memberships.length) return [];

    const roleById = new Map(memberships.map((row) => [String(row.league_id), String(row.role || 'member')]));
    const ids = memberships.map((row) => row.league_id).filter(Boolean);
    const leaguesResponse = await window.supabaseClient
      .from('leagues')
      .select('id, name, slug, status')
      .in('id', ids)
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (leaguesResponse.error) throw leaguesResponse.error;
    return (leaguesResponse.data || []).map((league) => ({
      ...league,
      role: roleById.get(String(league.id)) || 'member'
    }));
  }

  function navigateToLeague(slug) {
    setLeagueContext(slug);
    const file = window.location.pathname.split('/').pop() || 'race-hub.html';
    const targetFile = file === 'admin.html' ? 'admin.html' : file;
    const url = new URL(targetFile, window.location.href);
    url.searchParams.set('league', slug);
    window.location.assign(`${url.pathname.split('/').pop()}${url.search}${url.hash}`);
  }

  async function setupFooterAccountControls() {
    const footer = document.querySelector('.footer__inner');
    if (!footer || footer.querySelector('[data-rcc-footer-account]') || !window.supabaseClient?.auth) return;

    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error || !data?.session?.user?.id) return;

    const session = data.session;
    const container = document.createElement('div');
    container.className = 'footer-account-controls';
    container.dataset.rccFooterAccount = 'true';

    const identity = document.createElement('span');
    identity.className = 'footer-account-controls__identity';
    identity.textContent = session.user.email || 'RaceVora Account';
    container.appendChild(identity);

    try {
      const leagues = await fetchAccessibleLeagues(session.user.id);
      if (leagues.length > 1) {
        const label = document.createElement('label');
        label.className = 'footer-account-controls__league';
        const text = document.createElement('span');
        text.textContent = 'Liga';
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Aktive Rennliga wechseln');
        const active = currentLeagueSlug();
        leagues.forEach((league) => {
          const option = document.createElement('option');
          option.value = league.slug;
          option.textContent = league.name || league.slug;
          option.selected = league.slug === active;
          select.appendChild(option);
        });
        select.addEventListener('change', () => navigateToLeague(select.value));
        label.append(text, select);
        container.appendChild(label);
      }
    } catch (errorLeagues) {
      console.warn('Footer Liga-Auswahl konnte nicht geladen werden.', errorLeagues);
    }

    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'footer-account-controls__logout';
    logout.textContent = 'Logout';
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      await window.supabaseClient.auth.signOut().catch(() => null);
      try {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(TENANT_KEY);
      } catch (_) {}
      window.location.assign('index.html');
    });
    container.appendChild(logout);
    footer.appendChild(container);
  }

  function profileHref(driverId) {
    const base = window.withLeagueContextHref?.('fahrer-profil.html') || 'fahrer-profil.html';
    const url = new URL(base, window.location.href);
    url.searchParams.set('driver', String(driverId));
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  function setupGridDriverProfiles() {
    if (document.body?.dataset.page !== 'grid' || document.documentElement.dataset.rccGridProfileLinks === 'true') return;
    document.documentElement.dataset.rccGridProfileLinks = 'true';
    document.addEventListener('click', (event) => {
      const card = event.target?.closest?.('.driver-team-member-flip[data-driver-id]');
      if (!card) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const driverId = card.dataset.driverId;
      if (driverId) window.location.assign(profileHref(driverId));
    }, true);
  }

  function relocateCalendarTrackLink() {
    if (document.body?.dataset.page !== 'kalender') return;
    const link = document.querySelector('.section-header a[href="strecken.html"]');
    const archive = document.querySelector('.calendar-toggle[data-target="archive-section"]');
    const row = archive?.parentElement;
    if (!link || !archive || !row) return;
    link.classList.add('calendar-track-link');
    archive.before(link);
  }

  function fixResultsChart() {
    if (document.body?.dataset.page !== 'ergebnisse' || !window.Chart?.getChart) return;
    const canvas = document.getElementById('results-trend-chart');
    const chart = canvas ? window.Chart.getChart(canvas) : null;
    if (!chart) return;
    chart.options.maintainAspectRatio = false;
    chart.resize();
  }

  function removeExtraRulesLauncher() {
    document.querySelectorAll('.rcc-admin-home__secondary-actions').forEach((node) => node.remove());
  }

  function compactAdminContext() {
    if (document.body?.dataset.page !== 'admin') return;
    const banner = document.getElementById('admin-session-banner');
    const inline = document.getElementById('admin-session-inline');
    const switcher = document.getElementById('admin-league-switcher');
    [banner, inline, switcher].filter(Boolean).forEach((node) => node.classList.add('admin-context-compact'));
  }

  function installLeagueManagementInCalendar() {
    if (document.body?.dataset.page !== 'admin') return;
    const source = document.getElementById('admin-section-create-league');
    if (!source) return;

    source.classList.add('rcc-create-league-source-only');
    source.hidden = true;
    source.dataset.rccAdminHubIgnore = 'true';

    const hub = document.querySelector('#admin-section-calendar > .rcc-admin-section-hub');
    const grid = hub?.querySelector('.rcc-results-workflow__grid');
    if (!grid || grid.querySelector('[data-rcc-league-management-card]')) return;

    const card = document.createElement('article');
    card.className = 'rcc-results-workflow__card rcc-results-workflow__card--secondary';
    card.dataset.rccLeagueManagementCard = 'true';
    card.innerHTML = `
      <div class="rcc-results-workflow__icon" aria-hidden="true">L</div>
      <div>
        <h4>Ligaverwaltung</h4>
        <p>Eine weitere Rennliga anlegen und anschließend Schritt für Schritt einrichten.</p>
      </div>
      <button type="button" class="button-secondary">Neue Liga erstellen</button>`;
    card.querySelector('button')?.addEventListener('click', () => {
      const panel = source.querySelector(':scope > section.panel') || source;
      window.RCCWizardDialog?.open?.(panel, {
        title: 'Ligaverwaltung · Neue Liga erstellen',
        headerActionLabel: 'Schließen',
        onHeaderAction: () => window.RCCWizardDialog?.close?.()
      });
    });
    grid.appendChild(card);
  }

  function removeEmptyAdminModules() {
    if (document.body?.dataset.page !== 'admin') return;
    document.querySelectorAll('.admin-layout > .panel').forEach((panel) => {
      if (panel.id === 'admin-section-auth' || panel.id === 'admin-section-create-league') return;
      if (panel.matches('details') && panel.querySelector('.rcc-admin-section-hub')) return;
      const meaningful = panel.querySelector('input,select,textarea,button,a,[id]:not(summary)') || String(panel.textContent || '').trim();
      if (!meaningful) panel.remove();
    });
  }

  function setupAdminPolish() {
    if (document.body?.dataset.page !== 'admin') return;
    removeExtraRulesLauncher();
    compactAdminContext();
    installLeagueManagementInCalendar();
    removeEmptyAdminModules();

    const observer = new MutationObserver(() => {
      removeExtraRulesLauncher();
      compactAdminContext();
      installLeagueManagementInCalendar();
      removeEmptyAdminModules();
    });
    observer.observe(document.querySelector('.admin-layout') || document.body, { childList: true, subtree: true });
  }

  function init() {
    setupGridDriverProfiles();
    relocateCalendarTrackLink();
    setupAdminPolish();
    setupFooterAccountControls().catch((error) => console.warn('Footer Account-Steuerung konnte nicht initialisiert werden.', error));
    fixResultsChart();
    document.addEventListener('rcc:page-content-ready', fixResultsChart);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  document.addEventListener('layout:loaded', () => {
    setupFooterAccountControls().catch(() => null);
    relocateCalendarTrackLink();
    setupAdminPolish();
  });
})();