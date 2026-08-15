(() => {
  const DEFAULT_LEAGUE_SLUG = 'rcc';
  const DEFAULT_LOGO_URL = 'assets/images/logo.png';
  const DEFAULT_SUBTITLE = 'TrackVision Studio';
  const FALLBACK_SUBTITLE = 'Race Control Center';
  const DASHBOARD_VIEW_CACHE_KEY = 'rcc.dashboard.view.v1';
  const DASHBOARD_VIEW_OWNER_KEY = 'rcc.dashboard.view.owner.v1';
  const DASHBOARD_VIEW_MAX_AGE_MS = 1000 * 60 * 30;
  const BRAND_THEME_CACHE_KEY = 'rcc.brand.theme.v1';
  let applyPromise = null;

  function getRequestedSlugEarly() {
    const params = new URLSearchParams(location.search);
    const querySlug = params.get('league');
    if (querySlug) return String(querySlug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const match = location.pathname.match(/(?:^|\/)l\/([a-z0-9-]+)(?:\/|$)/i);
    return match?.[1] ? String(match[1]).toLowerCase() : DEFAULT_LEAGUE_SLUG;
  }

  function normalizeHexColor(value) {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : '';
  }

  function setThemeColor(settings = {}) {
    const background = normalizeHexColor(settings.background_color);
    const primary = normalizeHexColor(settings.primary_color);
    const secondary = normalizeHexColor(settings.secondary_color);
    const accent = normalizeHexColor(settings.accent_color);

    if (background) {
      document.documentElement.style.setProperty('--bg-main', background);
      document.documentElement.style.setProperty('--bg-deep', `color-mix(in srgb, ${background} 72%, #000000)`);
      document.documentElement.style.backgroundColor = background;
    }
    if (primary) document.documentElement.style.setProperty('--primary', primary);
    if (secondary) document.documentElement.style.setProperty('--secondary', secondary);
    if (accent) document.documentElement.style.setProperty('--accent', accent);
  }

  function applyCachedThemeEarly() {
    try {
      const raw = sessionStorage.getItem(BRAND_THEME_CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (cached?.slug !== getRequestedSlugEarly()) return;
      setThemeColor(cached.settings || {});
      document.documentElement.dataset.leagueBrandingApplied = 'true';
    } catch (_) {}
  }
  applyCachedThemeEarly();

  function installBrandingGate() {
    if (getRequestedSlugEarly() === DEFAULT_LEAGUE_SLUG) return;
    document.documentElement.dataset.leagueBrandingPending = 'true';
    if (document.getElementById('rcc-branding-gate-style')) return;
    const style = document.createElement('style');
    style.id = 'rcc-branding-gate-style';
    style.textContent = 'html[data-league-branding-pending="true"] .brand-logo,html[data-league-branding-pending="true"] .brand-title,html[data-league-branding-pending="true"] .brand-subtitle,html[data-league-branding-pending="true"] .league-brand-footer,html[data-league-branding-pending="true"] #app-launch-splash img{visibility:hidden!important}';
    document.head.appendChild(style);
  }

  function installWarmDashboardLoaderGate() {
    if (document.body?.dataset.page !== 'index') return;
    try {
      const raw = sessionStorage.getItem(DASHBOARD_VIEW_CACHE_KEY);
      const owner = sessionStorage.getItem(DASHBOARD_VIEW_OWNER_KEY);
      if (!raw || owner !== getRequestedSlugEarly()) return;
      const cached = JSON.parse(raw);
      if (!cached?.cachedAt || Date.now() - Number(cached.cachedAt) > DASHBOARD_VIEW_MAX_AGE_MS) return;
      const style = document.createElement('style');
      style.id = 'rcc-warm-dashboard-loader-gate';
      style.textContent = '.f1-loader-overlay{display:none!important}body.f1-loading{overflow:auto!important}';
      document.head.appendChild(style);
      document.documentElement.dataset.warmDashboard = 'true';
    } catch (_) {}
  }

  function ensureTenantThemeOverrides() {
    if (document.getElementById('rcc-tenant-theme-overrides')) return;
    const style = document.createElement('style');
    style.id = 'rcc-tenant-theme-overrides';
    style.textContent = `
      html[data-league-branding-applied="true"] body{
        background:
          radial-gradient(circle at top left,color-mix(in srgb,var(--secondary) 24%,transparent),transparent 28%),
          radial-gradient(circle at top right,color-mix(in srgb,var(--accent) 16%,transparent),transparent 22%),
          linear-gradient(180deg,var(--bg-main),var(--bg-deep))!important
      }
      html[data-league-branding-applied="true"] .button-primary,
      html[data-league-branding-applied="true"] .btn.primary,
      html[data-league-branding-applied="true"] .btn-primary-glow{background:linear-gradient(135deg,var(--secondary),var(--accent))!important}
      html[data-league-branding-applied="true"] .btn-secondary-ghost:hover,
      html[data-league-branding-applied="true"] .button-secondary:hover,
      html[data-league-branding-applied="true"] .btn:hover,
      html[data-league-branding-applied="true"] .main-nav a:hover,
      html[data-league-branding-applied="true"] .main-nav a.active,
      html[data-league-branding-applied="true"] .nav-more-toggle:hover,
      html[data-league-branding-applied="true"] .nav-more.open .nav-more-toggle{border-color:var(--accent)!important;background:color-mix(in srgb,var(--accent) 18%,transparent)!important}
      html[data-league-branding-applied="true"] .next-race-item,
      html[data-league-branding-applied="true"] .accent-outline{border-color:color-mix(in srgb,var(--accent) 34%,transparent)!important;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 14%,transparent),rgba(255,255,255,.03))!important}
      html[data-league-branding-applied="true"] .violet-outline,
      html[data-league-branding-applied="true"] .countdown-box{border-color:color-mix(in srgb,var(--secondary) 32%,transparent)!important;background:linear-gradient(180deg,color-mix(in srgb,var(--secondary) 22%,transparent),rgba(255,255,255,.03))!important}
      html[data-league-branding-applied="true"] .status-dot{background:var(--accent)!important;box-shadow:0 0 12px color-mix(in srgb,var(--accent) 65%,transparent)!important}
      html[data-league-branding-applied="true"] .status-dot.violet{background:var(--secondary)!important;box-shadow:0 0 12px color-mix(in srgb,var(--secondary) 65%,transparent)!important}
      html[data-league-branding-applied="true"] .hero-main{background:radial-gradient(circle at top right,color-mix(in srgb,var(--accent) 18%,transparent),transparent 25%),radial-gradient(circle at bottom right,color-mix(in srgb,var(--secondary) 28%,transparent),transparent 28%),linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02))!important}
      html[data-league-branding-applied="true"] .hero-main::before{background:radial-gradient(circle,color-mix(in srgb,var(--secondary) 30%,transparent),transparent 68%)!important}
      html[data-league-branding-applied="true"] .live-badge{border-color:color-mix(in srgb,var(--accent) 30%,transparent)!important;background:color-mix(in srgb,var(--accent) 13%,transparent)!important}
      html[data-league-branding-applied="true"] .race-card:hover,
      html[data-league-branding-applied="true"] .race-card-link-highlight .race-card{border-color:var(--accent)!important}
      html[data-league-branding-applied="true"] .position-badge,
      html[data-league-branding-applied="true"] .number-box{background:linear-gradient(180deg,color-mix(in srgb,var(--secondary) 36%,transparent),color-mix(in srgb,var(--accent) 20%,transparent))!important;border-color:color-mix(in srgb,var(--secondary) 48%,transparent)!important}
      .league-public-profile{width:min(var(--max),calc(100% - 28px));margin:18px auto 0;padding:22px;border:1px solid color-mix(in srgb,var(--accent) 28%,var(--line));border-radius:24px;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 16%,transparent),color-mix(in srgb,var(--accent) 8%,transparent)),rgba(255,255,255,.025);box-shadow:var(--shadow)}
      .league-public-profile h2{margin:.2rem 0 .7rem}
      .league-public-profile p{margin:0;color:var(--text-muted);line-height:1.65;white-space:pre-line}
      .league-public-profile__links{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}`;
    document.head.appendChild(style);
  }

  function releaseBrandingGate() {
    delete document.documentElement.dataset.leagueBrandingPending;
  }

  installBrandingGate();
  installWarmDashboardLoaderGate();
  ensureTenantThemeOverrides();

  function normalizeLogoUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, location.href);
      return ['http:', 'https:'].includes(url.protocol) ? raw : '';
    } catch (_) {
      return '';
    }
  }

  function normalizePublicUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function getPageLabel() {
    const title = String(document.title || '').trim();
    const separator = title.indexOf('·');
    if (separator >= 0) return title.slice(separator + 1).trim();
    return document.querySelector('h1')?.textContent?.trim() || '';
  }

  function renderPublicProfile(settings = {}) {
    if (document.body?.dataset.page !== 'index') return;
    const description = String(settings.public_description || '').trim().slice(0, 500);
    const website = normalizePublicUrl(settings.public_website);
    const discord = normalizePublicUrl(settings.public_discord);
    let section = document.getElementById('league-public-profile');

    if (!description && !website && !discord) {
      section?.remove();
      return;
    }

    if (!section) {
      section = document.createElement('section');
      section.id = 'league-public-profile';
      section.className = 'league-public-profile';
      document.querySelector('.dashboard-hero')?.insertAdjacentElement('afterend', section);
    }

    section.replaceChildren();
    const label = document.createElement('div');
    label.className = 'card-label';
    label.textContent = 'Über die Liga';
    section.appendChild(label);

    if (description) {
      const paragraph = document.createElement('p');
      paragraph.textContent = description;
      section.appendChild(paragraph);
    }

    if (website || discord) {
      const links = document.createElement('div');
      links.className = 'league-public-profile__links';
      if (website) {
        const anchor = document.createElement('a');
        anchor.className = 'btn-primary-glow';
        anchor.href = website;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = 'Website';
        links.appendChild(anchor);
      }
      if (discord) {
        const anchor = document.createElement('a');
        anchor.className = 'btn-secondary-ghost';
        anchor.href = discord;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = 'Discord';
        links.appendChild(anchor);
      }
      section.appendChild(links);
    }
  }

  function applySnapshot(snapshot) {
    const league = snapshot?.league;
    if (!league) return false;

    const settings = league.settings && typeof league.settings === 'object' ? league.settings : {};
    const name = String(settings.brand_name || league.name || 'Race Control Center').trim();
    const subtitle = String(
      settings.brand_subtitle || (league.slug === DEFAULT_LEAGUE_SLUG ? DEFAULT_SUBTITLE : FALLBACK_SUBTITLE)
    ).trim();
    const logo = normalizeLogoUrl(settings.brand_logo_url || league.logo_url) || DEFAULT_LOGO_URL;

    document.documentElement.dataset.leagueSlug = league.slug || '';
    document.documentElement.dataset.leagueBrandingApplied = 'true';
    document.querySelectorAll('.brand-title').forEach((element) => { element.textContent = name; });
    document.querySelectorAll('.brand-subtitle').forEach((element) => { element.textContent = subtitle; });
    document.querySelectorAll('.brand-logo,#app-launch-splash img').forEach((image) => {
      image.src = logo;
      image.alt = `${name} Logo`;
    });
    document.querySelectorAll('.league-brand-footer').forEach((element) => {
      element.textContent = subtitle ? `${name} · ${subtitle}` : name;
    });

    renderPublicProfile(settings);
    const label = getPageLabel();
    document.title = label ? `${name} · ${label}` : name;
    setThemeColor(settings);

    try {
      sessionStorage.setItem(BRAND_THEME_CACHE_KEY, JSON.stringify({
        slug: league.slug,
        settings: {
          background_color: settings.background_color,
          primary_color: settings.primary_color,
          secondary_color: settings.secondary_color,
          accent_color: settings.accent_color
        }
      }));
    } catch (_) {}

    releaseBrandingGate();
    dispatchEvent(new CustomEvent('rcc:league-branding-applied', {
      detail: { leagueId: league.id, slug: league.slug, name, subtitle, logoUrl: logo }
    }));
    return true;
  }

  async function apply(options = {}) {
    if (applyPromise && options.forceRefresh !== true) return applyPromise;
    applyPromise = (async () => {
      const api = window.RCCLeagueContext;
      if (!api?.initialize) return false;
      let snapshot = api.snapshot?.();
      if (!snapshot?.league || options.forceRefresh === true) {
        snapshot = await api.initialize({ forceRefresh: options.forceRefresh === true });
      }
      return applySnapshot(snapshot);
    })().catch((error) => {
      console.warn('RCC Branding: league branding could not be applied.', error);
      releaseBrandingGate();
      return false;
    }).finally(() => { applyPromise = null; });
    return applyPromise;
  }

  function loadAdminBrandingEditor() {
    if (
      document.body?.dataset.page !== 'admin'
      || window.RCCAdminBranding
      || document.querySelector('script[data-rcc-admin-branding="true"]')
    ) return;

    const script = document.createElement('script');
    script.src = 'assets/js/pages/admin-branding.js';
    script.dataset.rccAdminBranding = 'true';
    script.onload = () => window.RCCAdminBranding?.init?.();
    script.onerror = () => console.warn('RCC Branding: Admin-Branding-Editor konnte nicht geladen werden.');
    document.head.appendChild(script);
  }

  window.RCCBranding = { apply, applySnapshot };
  document.addEventListener('layout:loaded', () => apply());
  document.addEventListener('dashboard:content-ready', () => {
    if (document.body?.dataset.page === 'index') {
      try { sessionStorage.setItem(DASHBOARD_VIEW_OWNER_KEY, getRequestedSlugEarly()); } catch (_) {}
    }
  });
  addEventListener('rcc:league-context-ready', (event) => {
    if (event?.detail?.league) applySnapshot(event.detail);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply());
  else apply();

  if (document.readyState === 'complete') loadAdminBrandingEditor();
  else addEventListener('load', loadAdminBrandingEditor, { once: true });
})();
