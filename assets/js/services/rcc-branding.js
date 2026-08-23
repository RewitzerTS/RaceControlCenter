(() => {
  const DEFAULT_LEAGUE_SLUG = 'rcc';
  const DEFAULT_LOGO_URL = 'assets/images/logo.png';
  const DEFAULT_SUBTITLE = 'TrackVision Studio';
  const FALLBACK_SUBTITLE = 'Race Control Center';
  const DASHBOARD_VIEW_CACHE_KEY = 'rcc.dashboard.view.v1';
  const DASHBOARD_VIEW_OWNER_KEY = 'rcc.dashboard.view.owner.v1';
  const DASHBOARD_VIEW_MAX_AGE_MS = 1000 * 60 * 30;
  const BRAND_THEME_CACHE_KEY = 'rcc.brand.theme.v2';
  let applyPromise = null;
  let tenantBrandingAllowed = false;

  const THEME_PRESETS = [
    {
      id: '0', name: 'RCC Standard', subtitle: 'RCC Violett & Teal',
      primary: '#35246A', secondary: '#5A32A3', accent1: '#2C8FA6', accent2: '#2F6F8A',
      background: '#021B34', surface: '#0A1F37', text: '#FFFFFF', textOnPrimary: '#FFFFFF'
    },
    {
      id: '1', name: 'Turquoise Carbon', subtitle: 'Türkis · Schwarz · Silber',
      primary: '#27F4D2', secondary: '#0B0D10', accent1: '#C5C7C9', accent2: '#FFFFFF',
      background: '#060809', surface: '#15181B', text: '#F4F7F8', textOnPrimary: '#08110F'
    },
    {
      id: '2', name: 'Papaya Grid', subtitle: 'Papaya · Anthrazit · Blau',
      primary: '#FF8000', secondary: '#2B2D31', accent1: '#00AEEF', accent2: '#F5F5F5',
      background: '#0D0F12', surface: '#1A1D21', text: '#F6F6F6', textOnPrimary: '#101010'
    },
    {
      id: '3', name: 'Rosso Corse', subtitle: 'Rot · Weiß · Gelb',
      primary: '#E8002D', secondary: '#FFFFFF', accent1: '#FFD500', accent2: '#111111',
      background: '#100003', surface: '#240007', text: '#FFFFFF', textOnPrimary: '#FFFFFF'
    },
    {
      id: '4', name: 'Alpine Neon', subtitle: 'Blau · Pink · Dunkelblau',
      primary: '#00A1E8', secondary: '#FF87BC', accent1: '#0057B8', accent2: '#FFFFFF',
      background: '#07131A', surface: '#0E2530', text: '#FFFFFF', textOnPrimary: '#081015'
    },
    {
      id: '5', name: 'Grand Prix Blue', subtitle: 'Blau · Weiß · Rot · Gelb',
      primary: '#3671C6', secondary: '#FFFFFF', accent1: '#E10600', accent2: '#FFD100',
      background: '#071322', surface: '#10243D', text: '#FFFFFF', textOnPrimary: '#FFFFFF'
    },
    {
      id: '6', name: 'Racing Green', subtitle: 'Racing Green · Lime · Silber',
      primary: '#229971', secondary: '#00352F', accent1: '#C7FF00', accent2: '#D6D2C4',
      background: '#061A16', surface: '#0D2A24', text: '#FFFFFF', textOnPrimary: '#08100D'
    },
    {
      id: '7', name: 'Audi Carbon', subtitle: 'Audi Red · Carbon · Titanium',
      primary: '#FF2D00', secondary: '#111111', accent1: '#A6A6A6', accent2: '#FFFFFF',
      background: '#090909', surface: '#1A1A1A', text: '#FFFFFF', textOnPrimary: '#111111'
    }
  ];

  const THEME_BY_ID = new Map(THEME_PRESETS.map((theme) => [theme.id, Object.freeze({ ...theme })]));

  function normalizeHexColor(value) {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : '';
  }

  function getTheme(themeId) {
    return THEME_BY_ID.get(String(themeId ?? '').trim()) || null;
  }

  function themeToSettings(themeOrId) {
    const theme = typeof themeOrId === 'object' ? themeOrId : getTheme(themeOrId);
    if (!theme) return {};
    return {
      theme_id: theme.id,
      background_color: theme.background,
      primary_color: theme.primary,
      secondary_color: theme.secondary,
      accent_color: theme.accent1,
      accent_2_color: theme.accent2,
      surface_color: theme.surface,
      text_color: theme.text,
      text_on_primary_color: theme.textOnPrimary
    };
  }

  function findMatchingTheme(settings = {}) {
    const explicit = getTheme(settings.theme_id);
    if (explicit) return explicit;
    const legacy = {
      background: normalizeHexColor(settings.background_color),
      primary: normalizeHexColor(settings.primary_color),
      secondary: normalizeHexColor(settings.secondary_color),
      accent1: normalizeHexColor(settings.accent_color)
    };
    if (!legacy.background && !legacy.primary && !legacy.secondary && !legacy.accent1) return getTheme('0');
    return THEME_PRESETS.find((theme) => (
      (!legacy.background || legacy.background === theme.background)
      && (!legacy.primary || legacy.primary === theme.primary)
      && (!legacy.secondary || legacy.secondary === theme.secondary)
      && (!legacy.accent1 || legacy.accent1 === theme.accent1)
    )) || null;
  }

  function resolveThemeSettings(settings = {}) {
    const preset = getTheme(settings.theme_id);
    if (preset) return { ...settings, ...themeToSettings(preset) };
    return settings;
  }

  window.RCCThemePresets = {
    all: () => THEME_PRESETS.map((theme) => ({ ...theme })),
    get: (themeId) => {
      const theme = getTheme(themeId);
      return theme ? { ...theme } : null;
    },
    match: (settings) => {
      const theme = findMatchingTheme(settings);
      return theme ? { ...theme } : null;
    },
    toSettings: (themeOrId) => ({ ...themeToSettings(themeOrId) }),
    defaultId: '0'
  };

  function getRequestedSlugEarly() {
    const params = new URLSearchParams(location.search);
    const querySlug = params.get('league');
    if (querySlug) return String(querySlug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const match = location.pathname.match(/(?:^|\/)l\/([a-z0-9-]+)(?:\/|$)/i);
    return match?.[1] ? String(match[1]).toLowerCase() : DEFAULT_LEAGUE_SLUG;
  }

  function isDemoView() {
    const params = new URLSearchParams(location.search);
    const slug = getRequestedSlugEarly();
    return params.get('demo') === '1'
      || slug === 'demo'
      || slug === 'racevora-demo'
      || location.pathname === '/owner/demo';
  }

  async function refreshTenantBrandingPermission() {
    if (isDemoView()) {
      tenantBrandingAllowed = false;
      return false;
    }
    try {
      const { data, error } = await window.supabaseClient?.auth?.getSession?.() || { data: null, error: null };
      tenantBrandingAllowed = !error && Boolean(data?.session?.user?.id);
    } catch (_) {
      tenantBrandingAllowed = false;
    }
    return tenantBrandingAllowed;
  }

  function setThemeColor(rawSettings = {}) {
    const settings = resolveThemeSettings(rawSettings);
    const background = normalizeHexColor(settings.background_color);
    const primary = normalizeHexColor(settings.primary_color);
    const secondary = normalizeHexColor(settings.secondary_color);
    const accent = normalizeHexColor(settings.accent_color);
    const accent2 = normalizeHexColor(settings.accent_2_color);
    const surface = normalizeHexColor(settings.surface_color);
    const text = normalizeHexColor(settings.text_color);
    const textOnPrimary = normalizeHexColor(settings.text_on_primary_color);
    const root = document.documentElement;

    if (background) {
      root.style.setProperty('--bg-main', background);
      root.style.setProperty('--bg-deep', `color-mix(in srgb, ${background} 72%, #000000)`);
      root.style.backgroundColor = background;
    }
    if (surface) {
      root.style.setProperty('--surface', surface);
      root.style.setProperty('--surface-2', `color-mix(in srgb, ${surface} 78%, ${secondary || primary || '#ffffff'})`);
    }
    if (primary) root.style.setProperty('--primary', primary);
    if (secondary) root.style.setProperty('--secondary', secondary);
    if (accent) root.style.setProperty('--accent', accent);
    if (accent2) {
      root.style.setProperty('--accent-2', accent2);
      root.style.setProperty('--accent-dark', accent2);
    }
    if (text) {
      root.style.setProperty('--text', text);
      root.style.setProperty('--text-muted', `color-mix(in srgb, ${text} 72%, ${surface || background || '#000000'})`);
    }
    if (textOnPrimary) root.style.setProperty('--text-on-primary', textOnPrimary);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && background) meta.setAttribute('content', surface || background);
  }

  function applyCachedThemeEarly() {
    setThemeColor(themeToSettings('0'));
    document.documentElement.dataset.leagueBrandingApplied = 'true';
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
      html[data-league-branding-applied="true"]{scrollbar-color:var(--accent) var(--bg-main)}
      html[data-league-branding-applied="true"]::-webkit-scrollbar-track{background:var(--bg-main)}
      html[data-league-branding-applied="true"]::-webkit-scrollbar-thumb{background:linear-gradient(var(--primary),var(--accent));border-radius:999px}
      html[data-league-branding-applied="true"] body{
        color:var(--text)!important;
        background:radial-gradient(circle at top left,color-mix(in srgb,var(--primary) 16%,transparent),transparent 30%),radial-gradient(circle at top right,color-mix(in srgb,var(--accent) 13%,transparent),transparent 24%),linear-gradient(180deg,var(--bg-main),var(--bg-deep))!important
      }
      html[data-league-branding-applied="true"] .site-safe-top,
      html[data-league-branding-applied="true"] .site-header{background:color-mix(in srgb,var(--surface) 92%,var(--bg-main))!important;color:var(--text)!important;border-color:color-mix(in srgb,var(--text) 10%,transparent)!important}
      html[data-league-branding-applied="true"] .footer{background:color-mix(in srgb,var(--surface) 94%,var(--bg-main))!important;color:var(--text)!important;border-color:color-mix(in srgb,var(--text) 10%,transparent)!important}
      html[data-league-branding-applied="true"] .brand-subtitle{color:var(--accent)!important}
      html[data-league-branding-applied="true"] .site-scroll-progress{background:linear-gradient(90deg,var(--primary),var(--accent),var(--accent-2,var(--secondary)))!important;box-shadow:0 0 22px color-mix(in srgb,var(--accent) 62%,transparent)!important}
      html[data-league-branding-applied="true"] .f1-loader-overlay{background:color-mix(in srgb,var(--bg-main) 94%,#000)!important;color:var(--text)!important}
      html .f1-loader-lights span.is-red{background:#ff2b2b!important;border-color:rgba(255,214,214,.88)!important;box-shadow:0 0 16px rgba(255,50,50,.9),inset 0 0 10px rgba(255,255,255,.24)!important}
      html .f1-loader-lights span.is-green{background:#1fef75!important;border-color:rgba(218,255,232,.9)!important;box-shadow:0 0 16px rgba(46,255,131,.92),inset 0 0 10px rgba(255,255,255,.24)!important}
      html[data-league-branding-applied="true"] .panel,
      html[data-league-branding-applied="true"] .table-card,
      html[data-league-branding-applied="true"] .modal-card,
      html[data-league-branding-applied="true"] .race-card,
      html[data-league-branding-applied="true"] .stat,
      html[data-league-branding-applied="true"] .leader-item,
      html[data-league-branding-applied="true"] .list-card,
      html[data-league-branding-applied="true"] .result-item,
      html[data-league-branding-applied="true"] .incident-item,
      html[data-league-branding-applied="true"] .rcc-results-workflow__card,
      html[data-league-branding-applied="true"] .rcc-admin-home__status-card{background:var(--surface)!important;color:var(--text)!important;border-color:color-mix(in srgb,var(--accent) 22%,transparent)!important}
      html[data-league-branding-applied="true"] input,
      html[data-league-branding-applied="true"] textarea,
      html[data-league-branding-applied="true"] select{background:color-mix(in srgb,var(--surface) 84%,var(--bg-main))!important;color:var(--text)!important;border-color:color-mix(in srgb,var(--text) 18%,transparent)!important}
      html[data-league-branding-applied="true"] .button-primary,
      html[data-league-branding-applied="true"] .btn.primary,
      html[data-league-branding-applied="true"] .btn-primary-glow{background:var(--primary)!important;color:var(--text-on-primary,#fff)!important;border-color:color-mix(in srgb,var(--primary) 78%,var(--text))!important;box-shadow:0 10px 28px color-mix(in srgb,var(--primary) 28%,transparent)!important}
      html[data-league-branding-applied="true"] .button-secondary,
      html[data-league-branding-applied="true"] .btn-secondary-ghost,
      html[data-league-branding-applied="true"] .btn{color:var(--text)!important;border-color:color-mix(in srgb,var(--accent) 36%,var(--line))!important;background:color-mix(in srgb,var(--surface) 88%,transparent)!important}
      html[data-league-branding-applied="true"] .btn-secondary-ghost:hover,
      html[data-league-branding-applied="true"] .button-secondary:hover,
      html[data-league-branding-applied="true"] .btn:hover,
      html[data-league-branding-applied="true"] .main-nav a:hover,
      html[data-league-branding-applied="true"] .main-nav a.active,
      html[data-league-branding-applied="true"] .nav-more-toggle:hover,
      html[data-league-branding-applied="true"] .nav-more.open .nav-more-toggle{border-color:var(--accent)!important;background:color-mix(in srgb,var(--accent) 18%,var(--surface))!important;color:var(--text)!important}
      html[data-league-branding-applied="true"] .next-race-item,
      html[data-league-branding-applied="true"] .accent-outline{border-color:color-mix(in srgb,var(--accent) 34%,transparent)!important;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 14%,transparent),var(--surface))!important}
      html[data-league-branding-applied="true"] .violet-outline,
      html[data-league-branding-applied="true"] .countdown-box{border-color:color-mix(in srgb,var(--secondary) 32%,transparent)!important;background:linear-gradient(180deg,color-mix(in srgb,var(--secondary) 18%,transparent),var(--surface))!important}
      html[data-league-branding-applied="true"] .status-dot{background:var(--accent)!important;box-shadow:0 0 12px color-mix(in srgb,var(--accent) 65%,transparent)!important}
      html[data-league-branding-applied="true"] .status-dot.violet{background:var(--secondary)!important;box-shadow:0 0 12px color-mix(in srgb,var(--secondary) 65%,transparent)!important}
      html[data-league-branding-applied="true"] .hero-main{background:radial-gradient(circle at top right,color-mix(in srgb,var(--accent) 18%,transparent),transparent 25%),radial-gradient(circle at bottom right,color-mix(in srgb,var(--primary) 22%,transparent),transparent 28%),var(--surface)!important}
      html[data-league-branding-applied="true"] .hero-main::before{background:radial-gradient(circle,color-mix(in srgb,var(--primary) 30%,transparent),transparent 68%)!important}
      html[data-league-branding-applied="true"] .live-badge{border-color:color-mix(in srgb,var(--accent) 30%,transparent)!important;background:color-mix(in srgb,var(--accent) 13%,var(--surface))!important}
      html[data-league-branding-applied="true"] .race-card:hover,
      html[data-league-branding-applied="true"] .race-card-link-highlight .race-card{border-color:var(--accent)!important}
      html[data-league-branding-applied="true"] .position-badge,
      html[data-league-branding-applied="true"] .number-box{background:linear-gradient(180deg,color-mix(in srgb,var(--primary) 38%,var(--surface)),color-mix(in srgb,var(--accent) 20%,var(--surface)))!important;border-color:color-mix(in srgb,var(--primary) 48%,transparent)!important;color:var(--text)!important}
      .league-public-profile{width:min(var(--max),calc(100% - 28px));margin:18px auto 0;padding:22px;border:1px solid color-mix(in srgb,var(--accent) 28%,var(--line));border-radius:24px;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 12%,transparent),color-mix(in srgb,var(--accent) 8%,transparent)),var(--surface);box-shadow:var(--shadow)}
      .league-public-profile h2{margin:.2rem 0 .7rem}.league-public-profile p{margin:0;color:var(--text-muted);line-height:1.65;white-space:pre-line}.league-public-profile__links{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}`;
    document.head.appendChild(style);
  }

  function releaseBrandingGate() { delete document.documentElement.dataset.leagueBrandingPending; }
  installBrandingGate();
  installWarmDashboardLoaderGate();
  ensureTenantThemeOverrides();

  function normalizeLogoUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, location.href);
      return ['http:', 'https:'].includes(url.protocol) ? raw : '';
    } catch (_) { return ''; }
  }

  function normalizePublicUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
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

    if (!description && !website && !discord) { section?.remove(); return; }
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
        anchor.className = 'btn-primary-glow'; anchor.href = website; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = 'Website';
        links.appendChild(anchor);
      }
      if (discord) {
        const anchor = document.createElement('a');
        anchor.className = 'btn-secondary-ghost'; anchor.href = discord; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = 'Discord';
        links.appendChild(anchor);
      }
      section.appendChild(links);
    }
  }

  function applySnapshot(snapshot) {
    const league = snapshot?.league;
    if (!league) return false;
    const rawSettings = league.settings && typeof league.settings === 'object' ? league.settings : {};
    const settings = tenantBrandingAllowed
      ? resolveThemeSettings(rawSettings)
      : { ...rawSettings, ...themeToSettings('0') };
    const name = String(settings.brand_name || league.name || 'Race Control Center').trim();
    const subtitle = String(settings.brand_subtitle || (league.slug === DEFAULT_LEAGUE_SLUG ? DEFAULT_SUBTITLE : FALLBACK_SUBTITLE)).trim();
    const logo = normalizeLogoUrl(settings.brand_logo_url || league.logo_url) || DEFAULT_LOGO_URL;

    document.documentElement.dataset.leagueSlug = league.slug || '';
    document.documentElement.dataset.leagueBrandingApplied = 'true';
    document.querySelectorAll('.brand-title').forEach((element) => { element.textContent = name; });
    document.querySelectorAll('.brand-subtitle').forEach((element) => { element.textContent = subtitle; });
    document.querySelectorAll('.brand-logo,#app-launch-splash img').forEach((image) => { image.src = logo; image.alt = `${name} Logo`; });
    document.querySelectorAll('.league-brand-footer').forEach((element) => { element.textContent = subtitle ? `${name} · ${subtitle}` : name; });

    renderPublicProfile(settings);
    const label = getPageLabel();
    document.title = label ? `${name} · ${label}` : name;
    setThemeColor(settings);

    try {
      sessionStorage.setItem(BRAND_THEME_CACHE_KEY, JSON.stringify({
        slug: league.slug,
        settings: {
          theme_id: settings.theme_id,
          background_color: settings.background_color,
          primary_color: settings.primary_color,
          secondary_color: settings.secondary_color,
          accent_color: settings.accent_color,
          accent_2_color: settings.accent_2_color,
          surface_color: settings.surface_color,
          text_color: settings.text_color,
          text_on_primary_color: settings.text_on_primary_color
        }
      }));
    } catch (_) {}

    releaseBrandingGate();
    dispatchEvent(new CustomEvent('rcc:league-branding-applied', { detail: { leagueId: league.id, slug: league.slug, name, subtitle, logoUrl: logo, themeId: settings.theme_id || null } }));
    return true;
  }

  async function apply(options = {}) {
    if (applyPromise && options.forceRefresh !== true) return applyPromise;
    applyPromise = (async () => {
      const api = window.RCCLeagueContext;
      if (!api?.initialize) return false;
      await refreshTenantBrandingPermission();
      let snapshot = api.snapshot?.();
      if (!snapshot?.league || options.forceRefresh === true) snapshot = await api.initialize({ forceRefresh: options.forceRefresh === true });
      return applySnapshot(snapshot);
    })().catch((error) => {
      console.warn('RCC Branding: league branding could not be applied.', error);
      releaseBrandingGate();
      return false;
    }).finally(() => { applyPromise = null; });
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

  window.RCCBranding = { apply, applySnapshot };
  document.addEventListener('layout:loaded', () => apply());
  document.addEventListener('dashboard:content-ready', () => {
    if (document.body?.dataset.page === 'index') {
      try { sessionStorage.setItem(DASHBOARD_VIEW_OWNER_KEY, getRequestedSlugEarly()); } catch (_) {}
    }
  });
  addEventListener('rcc:league-context-ready', (event) => {
    if (!event?.detail?.league) return;
    void refreshTenantBrandingPermission().then(() => applySnapshot(event.detail));
  });
  window.supabaseClient?.auth?.onAuthStateChange?.((_event, session) => {
    const nextAllowed = !isDemoView() && Boolean(session?.user?.id);
    if (nextAllowed === tenantBrandingAllowed) return;
    tenantBrandingAllowed = nextAllowed;
    setTimeout(() => {
      const snapshot = window.RCCLeagueContext?.snapshot?.();
      if (snapshot?.league) applySnapshot(snapshot);
      else void apply({ forceRefresh: true });
    }, 0);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply());
  else apply();
  if (document.readyState === 'complete') loadAdminBrandingEditor();
  else addEventListener('load', loadAdminBrandingEditor, { once: true });
})();
