(() => {
  const CACHE_KEY = 'rcc.brand.theme.v2';
  const STANDARD_SETTINGS = Object.freeze({
    theme_id: '0',
    background_color: '#021B34',
    primary_color: '#35246A',
    secondary_color: '#5A32A3',
    accent_color: '#2C8FA6',
    accent_2_color: '#2F6F8A',
    surface_color: '#0A1F37',
    text_color: '#FFFFFF',
    text_on_primary_color: '#FFFFFF'
  });

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

  // Authentication is not known during prepaint. Start every request in the
  // public RaceVora palette so a cached tenant theme can never leak into a
  // logged-out or demo view. Authenticated tenant branding is applied later by
  // rcc-branding.js after Supabase has confirmed the session.
  apply(STANDARD_SETTINGS);
  try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
})();
