(() => {
  const DEFAULT_LEAGUE_SLUG = 'rcc';
  const DEFAULT_LOGO_URL = 'assets/images/logo.png';
  const DEFAULT_SUBTITLE = 'TrackVision Studio';
  const FALLBACK_SUBTITLE = 'Race Control Center';

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

  function releaseBrandingGate() {
    delete document.documentElement.dataset.leagueBrandingPending;
  }

  installBrandingGate();

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

  window.RCCBranding = {
    apply,
    applySnapshot
  };

  document.addEventListener('layout:loaded', () => apply());
  window.addEventListener('rcc:league-context-ready', (event) => {
    if (event?.detail?.league) applySnapshot(event.detail);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply());
  } else {
    apply();
  }
})();
