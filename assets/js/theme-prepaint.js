(() => {
  const CACHE_KEY = 'rcc.brand.theme.v2';
  const DEFAULT_SLUG = 'rcc';

  function requestedSlug() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('league');
    if (query) return String(query).trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || DEFAULT_SLUG;
    const path = window.location.pathname.match(/(?:^|\/)l\/([a-z0-9-]+)(?:\/|$)/i);
    return path?.[1] ? String(path[1]).toLowerCase() : DEFAULT_SLUG;
  }

  function validHex(value) {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : '';
  }

  function apply(settings = {}) {
    const root = document.documentElement;
    const background = validHex(settings.background_color);
    const primary = validHex(settings.primary_color);
    const secondary = validHex(settings.secondary_color);
    const accent = validHex(settings.accent_color);
    const accent2 = validHex(settings.accent_2_color);
    const surface = validHex(settings.surface_color);
    const text = validHex(settings.text_color);
    const textOnPrimary = validHex(settings.text_on_primary_color);

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
    if (background) {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', surface || background);
    }
    root.dataset.leagueBrandingApplied = 'true';
    root.dataset.leagueThemePrepaint = 'true';
  }

  try {
    const raw = localStorage.getItem(CACHE_KEY) || sessionStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const cached = JSON.parse(raw);
    if (!cached || cached.slug !== requestedSlug() || !cached.settings) return;
    apply(cached.settings);
  } catch (_) {}
})();
