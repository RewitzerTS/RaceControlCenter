(() => {
  if (window.RCCLeagueBrandingOnboarding) return;

  const PANEL_ID = 'admin-section-league-onboarding';
  const LAUNCHER_ID = 'admin-onboarding-resume-launcher';
  const LOGO_BUCKET = 'league-brand-assets';
  const DEFAULTS = {
    background_color: '#021B34',
    primary_color: '#35246A',
    secondary_color: '#5A32A3',
    accent_color: '#2C8FA6'
  };

  let initialized = false;
  let panel = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function value(id) {
    return String(document.getElementById(id)?.value || '').trim();
  }

  function showFeedback(message = '', isError = false) {
    const el = document.getElementById('league-onboarding-feedback');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message;
    el.classList.toggle('notice-error', Boolean(isError));
  }

  function updateLogoPreview(url) {
    const preview = document.getElementById('onboarding-brand-logo-preview');
    if (!preview) return;
    if (url) {
      preview.src = url;
      preview.hidden = false;
    } else {
      preview.removeAttribute('src');
      preview.hidden = true;
    }
  }

  function normalizeUrl(raw) {
    const input = String(raw || '').trim();
    if (!input) return '';
    try {
      const url = new URL(input);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function payloadFromForm() {
    return {
      name: value('onboarding-brand-name'),
      subtitle: value('onboarding-brand-subtitle'),
      description: value('onboarding-brand-description').slice(0, 500),
      website: value('onboarding-brand-website'),
      discord: value('onboarding-brand-discord'),
      background_color: value('onboarding-brand-background') || DEFAULTS.background_color,
      primary_color: value('onboarding-brand-primary') || DEFAULTS.primary_color,
      secondary_color: value('onboarding-brand-secondary') || DEFAULTS.secondary_color,
      accent_color: value('onboarding-brand-accent') || DEFAULTS.accent_color,
      logo_url: value('onboarding-brand-logo-url')
    };
  }

  function restorePayload(payload = {}) {
    const set = (id, next) => {
      const input = document.getElementById(id);
      if (input && next !== undefined && next !== null) input.value = String(next);
    };
    set('onboarding-brand-name', payload.name);
    set('onboarding-brand-subtitle', payload.subtitle);
    set('onboarding-brand-description', payload.description);
    set('onboarding-brand-website', payload.website);
    set('onboarding-brand-discord', payload.discord);
    set('onboarding-brand-background', payload.background_color || DEFAULTS.background_color);
    set('onboarding-brand-primary', payload.primary_color || DEFAULTS.primary_color);
    set('onboarding-brand-secondary', payload.secondary_color || DEFAULTS.secondary_color);
    set('onboarding-brand-accent', payload.accent_color || DEFAULTS.accent_color);
    set('onboarding-brand-logo-url', payload.logo_url || '');
    updateLogoPreview(payload.logo_url || '');
  }

  function payloadFromLeague(league) {
    const settings = league?.settings && typeof league.settings === 'object' ? league.settings : {};
    return {
      name: settings.brand_name || league?.name || '',
      subtitle: settings.brand_subtitle || '',
      description: settings.public_description || '',
      website: settings.public_website || '',
      discord: settings.public_discord || '',
      logo_url: settings.brand_logo_url || league?.logo_url || '',
      background_color: settings.background_color || DEFAULTS.background_color,
      primary_color: settings.primary_color || DEFAULTS.primary_color,
      secondary_color: settings.secondary_color || DEFAULTS.secondary_color,
      accent_color: settings.accent_color || DEFAULTS.accent_color
    };
  }

  function validatePayload(payload) {
    if (payload.name.length < 3) return 'Bitte einen Liganamen mit mindestens 3 Zeichen eintragen.';
    if (payload.website && !normalizeUrl(payload.website)) return 'Bitte eine gültige Website-URL eintragen.';
    if (payload.discord && !normalizeUrl(payload.discord)) return 'Bitte eine gültige Discord-URL eintragen.';
    return '';
  }

  async function uploadSelectedLogo(context) {
    const file = document.getElementById('onboarding-brand-logo-file')?.files?.[0];
    if (!file) return value('onboarding-brand-logo-url');
    if (file.size > 2 * 1024 * 1024) throw new Error('Das Logo darf maximal 2 MB groß sein.');

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      throw new Error('Bitte ein Logo als PNG, JPG, WebP oder SVG hochladen.');
    }

    const extMap = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };
    const path = `${context.league.slug}/logo-${Date.now()}.${extMap[file.type] || 'png'}`;
    showFeedback('Logo wird hochgeladen …');

    const { error } = await window.supabaseClient.storage
      .from(LOGO_BUCKET)
      .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
    if (error) throw new Error(`Logo-Upload fehlgeschlagen: ${error.message}`);

    const { data } = window.supabaseClient.storage.from(LOGO_BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) throw new Error('Öffentliche Logo-URL konnte nicht erzeugt werden.');

    const hidden = document.getElementById('onboarding-brand-logo-url');
    if (hidden) hidden.value = publicUrl;
    updateLogoPreview(publicUrl);
    return publicUrl;
  }

  function removeOnboardingFlag() {
    const url = new URL(window.location.href);
    url.searchParams.delete('onboarding');
    window.history.replaceState({}, '', url.toString());
  }

  function removeLauncher() {
    document.getElementById(LAUNCHER_ID)?.remove();
  }

  function ensureLauncher() {
    if (!panel || document.getElementById(LAUNCHER_ID)) return;
    const launcher = document.createElement('section');
    launcher.id = LAUNCHER_ID;
    launcher.className = 'container admin-session-banner admin-onboarding-resume-launcher';
    launcher.innerHTML = `
      <div>
        <strong>Ligabranding noch nicht abgeschlossen</strong>
        <span class="muted">Name, Links, Farben und Logo der neuen Liga können jetzt eingerichtet werden.</span>
      </div>
      <button type="button" class="button-primary" data-rcc-resume-branding>Branding einrichten</button>`;

    const createLauncher = document.getElementById('admin-create-league-launcher');
    const tabs = document.getElementById('admin-mobile-tabs');
    const anchor = createLauncher?.nextSibling || tabs;
    if (anchor?.parentNode) anchor.parentNode.insertBefore(launcher, anchor);
    else document.querySelector('main')?.prepend(launcher);

    launcher.querySelector('[data-rcc-resume-branding]')?.addEventListener('click', () => open());
  }

  function buildPanel(context) {
    if (panel) return panel;
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();

    panel = document.createElement('section');
    panel.className = 'panel admin-panel-wide admin-panel-accent';
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <h2>Liga Branding einrichten</h2>
      <div class="notice">
        Richte hier nur den öffentlichen Auftritt deiner Liga ein. Rennkalender, Saison, Fahrer und Teams werden anschließend in den jeweiligen Admin-Bereichen verwaltet.
      </div>

      <div class="form-grid section-spacer-top">
        <div class="field">
          <label for="onboarding-brand-name">Liganame</label>
          <input id="onboarding-brand-name" maxlength="80" placeholder="z. B. German Racing League">
        </div>
        <div class="field">
          <label for="onboarding-brand-subtitle">Untertitel</label>
          <input id="onboarding-brand-subtitle" maxlength="120" placeholder="z. B. Sim Racing Championship">
        </div>
        <div class="field full">
          <label for="onboarding-brand-description">Beschreibung</label>
          <textarea id="onboarding-brand-description" rows="4" maxlength="500" placeholder="Kurze Beschreibung der Liga oder Community"></textarea>
        </div>
        <div class="field">
          <label for="onboarding-brand-website">Website</label>
          <input id="onboarding-brand-website" type="url" placeholder="https://example.com">
        </div>
        <div class="field">
          <label for="onboarding-brand-discord">Discord</label>
          <input id="onboarding-brand-discord" type="url" placeholder="https://discord.gg/…">
        </div>

        <div class="field full">
          <label for="onboarding-brand-logo-file">Logo hochladen</label>
          <input id="onboarding-brand-logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
          <small>PNG, JPG, WebP oder SVG · maximal 2 MB.</small>
          <input id="onboarding-brand-logo-url" type="hidden">
        </div>
        <div class="field full">
          <img id="onboarding-brand-logo-preview" alt="Logo-Vorschau" hidden style="max-width:240px;max-height:120px;object-fit:contain;margin:.5rem 0">
        </div>

        <div class="field">
          <label for="onboarding-brand-background">Hintergrundfarbe</label>
          <input id="onboarding-brand-background" type="color" value="${DEFAULTS.background_color}">
        </div>
        <div class="field">
          <label for="onboarding-brand-primary">Primärfarbe</label>
          <input id="onboarding-brand-primary" type="color" value="${DEFAULTS.primary_color}">
        </div>
        <div class="field">
          <label for="onboarding-brand-secondary">Sekundärfarbe</label>
          <input id="onboarding-brand-secondary" type="color" value="${DEFAULTS.secondary_color}">
        </div>
        <div class="field">
          <label for="onboarding-brand-accent">Akzentfarbe</label>
          <input id="onboarding-brand-accent" type="color" value="${DEFAULTS.accent_color}">
        </div>
      </div>

      <div class="card-actions section-spacer-top">
        <button type="button" class="button-primary" id="onboarding-finish">Branding speichern & Einrichtung abschließen</button>
      </div>
      <div id="league-onboarding-feedback" class="notice section-spacer-top" hidden></div>`;

    const layout = document.querySelector('.admin-layout');
    layout?.appendChild(panel);

    restorePayload(payloadFromLeague(context.league));

    panel.querySelector('#onboarding-brand-logo-file')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      updateLogoPreview(URL.createObjectURL(file));
    });
    panel.querySelector('#onboarding-finish')?.addEventListener('click', finishOnboarding);
    return panel;
  }

  async function finishOnboarding() {
    const button = document.getElementById('onboarding-finish');
    if (button) button.disabled = true;

    try {
      await window.requireAdminSession();
      const context = await window.RCCData.getLeagueContext({ forceRefresh: true });
      if (!context?.league?.id) throw new Error('Keine aktive Liga gefunden.');
      if (!['owner', 'admin'].includes(context.role)) throw new Error('Nur Owner und Ligaleitung dürfen das Branding ändern.');

      const payload = payloadFromForm();
      const validationError = validatePayload(payload);
      if (validationError) throw new Error(validationError);

      const logoUrl = await uploadSelectedLogo(context);
      const league = context.league;
      const settings = {
        ...(league.settings || {}),
        brand_name: payload.name,
        brand_subtitle: payload.subtitle,
        public_description: payload.description,
        public_website: normalizeUrl(payload.website),
        public_discord: normalizeUrl(payload.discord),
        brand_logo_url: logoUrl,
        background_color: payload.background_color,
        primary_color: payload.primary_color,
        secondary_color: payload.secondary_color,
        accent_color: payload.accent_color,
        onboarding_complete: true
      };

      showFeedback('Ligabranding wird gespeichert …');
      const { error } = await window.supabaseClient
        .from('leagues')
        .update({ name: payload.name, settings })
        .eq('id', league.id);
      if (error) throw error;

      await window.RCCLeagueContext?.initialize?.({ slug: league.slug, forceRefresh: true });
      await window.RCCBranding?.apply?.({ forceRefresh: true });
      await window.RCCAdminBranding?.load?.().catch?.(() => null);

      showFeedback('Ligabranding gespeichert. Rennkalender, Fahrer, Teams und Saison kannst du jetzt in den jeweiligen Admin-Bereichen einrichten.');
      removeOnboardingFlag();
      removeLauncher();

      window.setTimeout(() => {
        window.RCCWizardDialog?.close?.();
        panel?.remove();
        panel = null;
      }, 450);
    } catch (error) {
      console.error(error);
      showFeedback(error.message || 'Ligabranding konnte nicht gespeichert werden.', true);
      if (button) button.disabled = false;
    }
  }

  function open() {
    if (!panel) return false;
    removeLauncher();
    if (!window.RCCWizardDialog?.open) {
      panel.hidden = false;
      return true;
    }
    return window.RCCWizardDialog.open(panel, {
      title: 'Liga Branding einrichten',
      headerActionLabel: 'Später einrichten',
      onHeaderAction: () => {
        window.RCCWizardDialog.close?.();
        ensureLauncher();
        removeOnboardingFlag();
      }
    });
  }

  async function init() {
    if (initialized) return;
    const context = await window.RCCData?.getLeagueContext?.({ forceRefresh: true }).catch(() => null);
    if (!context?.league?.id || !['owner', 'admin'].includes(context.role)) return;

    if (context.league.settings?.onboarding_complete === true) {
      document.getElementById(PANEL_ID)?.remove();
      removeLauncher();
      initialized = true;
      return;
    }

    buildPanel(context);
    const explicitlyRequested = new URLSearchParams(window.location.search).get('onboarding') === '1';
    if (explicitlyRequested) open();
    else ensureLauncher();
    initialized = true;
  }

  window.RCCLeagueBrandingOnboarding = {
    init,
    open,
    finishOnboarding,
    payloadFromForm,
    restorePayload
  };
})();
