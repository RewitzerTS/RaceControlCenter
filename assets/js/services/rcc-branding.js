(() => {
  const DEFAULT_LEAGUE_SLUG = 'rcc';
  const DEFAULT_LOGO_URL = 'assets/images/logo.png';
  const DEFAULT_SUBTITLE = 'TrackVision Studio';
  const FALLBACK_SUBTITLE = 'Race Control Center';
  const DASHBOARD_VIEW_CACHE_KEY = 'rcc.dashboard.view.v1';
  const DASHBOARD_VIEW_OWNER_KEY = 'rcc.dashboard.view.owner.v1';
  const DASHBOARD_VIEW_MAX_AGE_MS = 1000 * 60 * 30;

  let applyPromise = null;

  function getRequestedSlugEarly() {
    const params = new URLSearchParams(window.location.search);
    const querySlug = params.get('league');
    if (querySlug) return String(querySlug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const pathMatch = window.location.pathname.match(/(?:^|\/)l\/([a-z0-9-]+)(?:\/|$)/i);
    return pathMatch?.[1] ? String(pathMatch[1]).toLowerCase() : DEFAULT_LEAGUE_SLUG;
  }

  function installBrandingGate() {
    if (getRequestedSlugEarly() === DEFAULT_LEAGUE_SLUG) return;
    document.documentElement.dataset.leagueBrandingPending = 'true';
    if (document.getElementById('rcc-branding-gate-style')) return;
    const style = document.createElement('style');
    style.id = 'rcc-branding-gate-style';
    style.textContent = `
      html[data-league-branding-pending="true"] .brand-logo,
      html[data-league-branding-pending="true"] .brand-title,
      html[data-league-branding-pending="true"] .brand-subtitle {
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
  }

  function installWarmDashboardLoaderGate() {
    if (document.body?.dataset.page !== 'index') return;
    try {
      const raw = window.sessionStorage?.getItem(DASHBOARD_VIEW_CACHE_KEY);
      const owner = window.sessionStorage?.getItem(DASHBOARD_VIEW_OWNER_KEY);
      if (!raw || owner !== getRequestedSlugEarly()) return;
      const cached = JSON.parse(raw);
      if (!cached?.cachedAt || Date.now() - Number(cached.cachedAt) > DASHBOARD_VIEW_MAX_AGE_MS) return;
      const style = document.createElement('style');
      style.id = 'rcc-warm-dashboard-loader-gate';
      style.textContent = `
        .f1-loader-overlay { display: none !important; }
        body.f1-loading { overflow: auto !important; }
      `;
      document.head.appendChild(style);
      document.documentElement.dataset.warmDashboard = 'true';
    } catch (_error) {
      // Warm-cache optimization is optional.
    }
  }

  function ensureTenantThemeOverrides() {
    if (document.getElementById('rcc-tenant-theme-overrides')) return;
    const style = document.createElement('style');
    style.id = 'rcc-tenant-theme-overrides';
    style.textContent = `
      html[data-league-branding-applied="true"] .button-primary,
      html[data-league-branding-applied="true"] .btn.primary,
      html[data-league-branding-applied="true"] .btn-primary-glow {
        background: linear-gradient(135deg, var(--secondary), var(--accent)) !important;
      }
      html[data-league-branding-applied="true"] .btn-secondary-ghost:hover,
      html[data-league-branding-applied="true"] .button-secondary:hover,
      html[data-league-branding-applied="true"] .btn:hover,
      html[data-league-branding-applied="true"] .main-nav a:hover,
      html[data-league-branding-applied="true"] .main-nav a.active,
      html[data-league-branding-applied="true"] .nav-more-toggle:hover,
      html[data-league-branding-applied="true"] .nav-more.open .nav-more-toggle {
        border-color: var(--accent) !important;
      }
      html[data-league-branding-applied="true"] .btn-secondary-ghost:hover,
      html[data-league-branding-applied="true"] .main-nav a:hover,
      html[data-league-branding-applied="true"] .main-nav a.active,
      html[data-league-branding-applied="true"] .nav-more-toggle:hover,
      html[data-league-branding-applied="true"] .nav-more.open .nav-more-toggle {
        background: color-mix(in srgb, var(--accent) 18%, transparent) !important;
      }
      html[data-league-branding-applied="true"] .next-race-item,
      html[data-league-branding-applied="true"] .accent-outline {
        border-color: color-mix(in srgb, var(--accent) 34%, transparent) !important;
        background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, transparent), rgba(255,255,255,0.03)) !important;
      }
      html[data-league-branding-applied="true"] .violet-outline,
      html[data-league-branding-applied="true"] .countdown-box {
        border-color: color-mix(in srgb, var(--secondary) 32%, transparent) !important;
        background: linear-gradient(180deg, color-mix(in srgb, var(--secondary) 22%, transparent), rgba(255,255,255,0.03)) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function releaseBrandingGate() {
    delete document.documentElement.dataset.leagueBrandingPending;
  }

  installBrandingGate();
  installWarmDashboardLoaderGate();
  ensureTenantThemeOverrides();

  function normalizeHexColor(value) {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : '';
  }

  function normalizeLogoUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
      const url = new URL(raw, window.location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      return raw;
    } catch (_error) {
      return '';
    }
  }

  function getPageLabel() {
    const currentTitle = String(document.title || '').trim();
    const separatorIndex = currentTitle.indexOf('·');
    if (separatorIndex >= 0) {
      return currentTitle.slice(separatorIndex + 1).trim();
    }

    const heading = document.querySelector('h1')?.textContent?.trim();
    return heading || '';
  }

  function setThemeColor(settings = {}) {
    const primary = normalizeHexColor(settings.primary_color);
    const secondary = normalizeHexColor(settings.secondary_color);
    const accent = normalizeHexColor(settings.accent_color);

    if (primary) document.documentElement.style.setProperty('--primary', primary);
    if (secondary) document.documentElement.style.setProperty('--secondary', secondary);
    if (accent) document.documentElement.style.setProperty('--accent', accent);
  }

  function applySnapshot(snapshot) {
    const league = snapshot?.league;
    if (!league) return false;

    const settings = league.settings && typeof league.settings === 'object' ? league.settings : {};
    const leagueName = String(settings.brand_name || league.name || 'Race Control Center').trim();
    const subtitle = String(
      settings.brand_subtitle ||
      (league.slug === DEFAULT_LEAGUE_SLUG ? DEFAULT_SUBTITLE : FALLBACK_SUBTITLE)
    ).trim();
    const logoUrl = normalizeLogoUrl(settings.brand_logo_url || league.logo_url) || DEFAULT_LOGO_URL;

    document.documentElement.dataset.leagueSlug = league.slug || '';
    document.documentElement.dataset.leagueBrandingApplied = 'true';

    document.querySelectorAll('.brand-title').forEach((element) => {
      element.textContent = leagueName;
    });

    document.querySelectorAll('.brand-subtitle').forEach((element) => {
      element.textContent = subtitle;
    });

    document.querySelectorAll('.brand-logo').forEach((image) => {
      image.src = logoUrl;
      image.alt = `${leagueName} Logo`;
    });

    const pageLabel = getPageLabel();
    document.title = pageLabel ? `${leagueName} · ${pageLabel}` : leagueName;

    setThemeColor(settings);
    releaseBrandingGate();

    window.dispatchEvent(new CustomEvent('rcc:league-branding-applied', {
      detail: {
        leagueId: league.id,
        slug: league.slug,
        name: leagueName,
        subtitle,
        logoUrl
      }
    }));

    return true;
  }

  async function apply(options = {}) {
    if (applyPromise && options.forceRefresh !== true) return applyPromise;

    applyPromise = (async () => {
      const contextApi = window.RCCLeagueContext;
      if (!contextApi?.initialize) return false;

      let snapshot = contextApi.snapshot?.();
      if (!snapshot?.league || options.forceRefresh === true) {
        snapshot = await contextApi.initialize({ forceRefresh: options.forceRefresh === true });
      }

      return applySnapshot(snapshot);
    })()
      .catch((error) => {
        console.warn('RCC Branding: league branding could not be applied.', error);
        releaseBrandingGate();
        return false;
      })
      .finally(() => {
        applyPromise = null;
      });

    return applyPromise;
  }

  function loadAdminBrandingEditor() {
    if (document.body?.dataset.page !== 'admin' || window.RCCAdminBranding || document.querySelector('script[data-rcc-admin-branding="true"]')) return;
    const script = document.createElement('script');
    script.src = 'assets/js/pages/admin-branding.js';
    script.dataset.rccAdminBranding = 'true';
    script.onload = () => window.RCCAdminBranding?.init?.();
    script.onerror = () => console.warn('RCC Branding: Admin-Branding-Editor konnte nicht geladen werden.');
    document.head.appendChild(script);
  }

  window.RCCBranding = {
    apply,
    applySnapshot
  };

  document.addEventListener('layout:loaded', () => apply());
  document.addEventListener('dashboard:content-ready', () => {
    if (document.body?.dataset.page === 'index') {
      try { window.sessionStorage?.setItem(DASHBOARD_VIEW_OWNER_KEY, getRequestedSlugEarly()); } catch (_error) {}
    }
  });
  window.addEventListener('rcc:league-context-ready', (event) => {
    if (event?.detail?.league) applySnapshot(event.detail);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply());
  } else {
    apply();
  }

  if (document.readyState === 'complete') loadAdminBrandingEditor();
  else window.addEventListener('load', loadAdminBrandingEditor, { once: true });
})();
