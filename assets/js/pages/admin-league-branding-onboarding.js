(() => {
  if (window.RCCLeagueBrandingOnboarding) return;

  const PANEL_ID = 'admin-section-league-onboarding';
  const LAUNCHER_ID = 'admin-onboarding-resume-launcher';
  const LOGO_BUCKET = 'league-brand-assets';
  const THEME_STYLESHEET = 'assets/css/components/rcc-branding-themes.css';
  const CHECK_ICON = '<svg class="rcc-icon--check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6"/></svg>';
  let initialized = false;
  let panel = null;
  let selectedThemeId = '0';

  function ensureThemeStylesheet() {
    if (document.querySelector('link[data-rcc-branding-themes="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = THEME_STYLESHEET;
    link.dataset.rccBrandingThemes = 'true';
    document.head.appendChild(link);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function value(id) { return String(document.getElementById(id)?.value || '').trim(); }

  function storageLeagueSlug(value) {
    const slug = String(value || '').trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Ungültiger Liga-Speicherpfad.');
    return slug;
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
    if (url) { preview.src = url; preview.hidden = false; }
    else { preview.removeAttribute('src'); preview.hidden = true; }
  }

  function normalizeUrl(raw) {
    const input = String(raw || '').trim();
    if (!input) return '';
    try {
      const url = new URL(input);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }

  function getThemes() { return window.RCCThemePresets?.all?.() || []; }
  function getTheme(themeId) { return window.RCCThemePresets?.get?.(themeId) || null; }

  function themePickerMarkup(selectedId) {
    return getThemes().map((theme) => {
      const swatches = [theme.primary, theme.secondary, theme.accent1, theme.accent2, theme.background, theme.surface, theme.text, theme.textOnPrimary]
        .map((color) => `<i class="rcc-theme-swatch" style="background:${escapeHtml(color)}" title="${escapeHtml(color)}"></i>`)
        .join('');
      return `
        <label class="rcc-theme-option">
          <input type="radio" name="onboarding-brand-theme" value="${escapeHtml(theme.id)}" ${theme.id === selectedId ? 'checked' : ''}>
          <span class="rcc-theme-option__top">
            <span><strong>${escapeHtml(theme.id)}. ${escapeHtml(theme.name)}</strong><small>${escapeHtml(theme.subtitle)}</small></span>
            <span class="rcc-theme-option__check" aria-hidden="true">${CHECK_ICON}</span>
          </span>
          <span class="rcc-theme-swatches">${swatches}</span>
        </label>`;
    }).join('');
  }

  function applyThemePreview(theme) {
    const preview = document.getElementById('onboarding-theme-preview');
    if (!preview || !theme) return;
    const variables = {
      '--preview-bg': theme.background,
      '--preview-surface': theme.surface,
      '--preview-primary': theme.primary,
      '--preview-secondary': theme.secondary,
      '--preview-accent-1': theme.accent1,
      '--preview-accent-2': theme.accent2,
      '--preview-text': theme.text,
      '--preview-text-on-primary': theme.textOnPrimary
    };
    Object.entries(variables).forEach(([key, val]) => preview.style.setProperty(key, val));
    const title = preview.querySelector('[data-theme-preview-title]');
    if (title) title.textContent = `${theme.id}. ${theme.name}`;
  }

  function renderThemePicker(themeId) {
    const picker = document.getElementById('onboarding-theme-picker');
    if (!picker) return;
    selectedThemeId = getTheme(themeId)?.id || '0';
    picker.innerHTML = themePickerMarkup(selectedThemeId);
    picker.querySelectorAll('input[name="onboarding-brand-theme"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        selectedThemeId = input.value;
        applyThemePreview(getTheme(selectedThemeId));
      });
    });
    applyThemePreview(getTheme(selectedThemeId));
  }

  function payloadFromForm() {
    return {
      name: value('onboarding-brand-name'),
      subtitle: value('onboarding-brand-subtitle'),
      description: value('onboarding-brand-description').slice(0, 500),
      website: value('onboarding-brand-website'),
      discord: value('onboarding-brand-discord'),
      theme_id: selectedThemeId,
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
    set('onboarding-brand-logo-url', payload.logo_url || '');
    updateLogoPreview(payload.logo_url || '');
    const matched = getTheme(payload.theme_id) || window.RCCThemePresets?.match?.(payload) || getTheme('0');
    renderThemePicker(matched?.id || '0');
  }

  function payloadFromLeague(league) {
    const settings = league?.settings && typeof league.settings === 'object' ? league.settings : {};
    const matched = window.RCCThemePresets?.match?.(settings) || getTheme('0');
    return {
      name: settings.brand_name || league?.name || '',
      subtitle: settings.brand_subtitle || '',
      description: settings.public_description || '',
      website: settings.public_website || '',
      discord: settings.public_discord || '',
      logo_url: settings.brand_logo_url || league?.logo_url || '',
      theme_id: matched?.id || '0'
    };
  }

  function validatePayload(payload) {
    if (payload.name.length < 3) return 'Bitte einen Liganamen mit mindestens 3 Zeichen eintragen.';
    if (payload.website && !normalizeUrl(payload.website)) return 'Bitte eine gültige Website-URL eintragen.';
    if (payload.discord && !normalizeUrl(payload.discord)) return 'Bitte eine gültige Discord-URL eintragen.';
    if (!getTheme(payload.theme_id)) return 'Bitte ein RCC-Farbschema auswählen.';
    return '';
  }

  async function uploadSelectedLogo(context) {
    const file = document.getElementById('onboarding-brand-logo-file')?.files?.[0];
    if (!file) return value('onboarding-brand-logo-url');
    if (file.size > 2 * 1024 * 1024) throw new Error('Das Logo darf maximal 2 MB groß sein.');
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) throw new Error('Bitte ein Logo als PNG, JPG, WebP oder SVG hochladen.');
    const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
    const path = `${storageLeagueSlug(context.league.slug)}/logo-${Date.now()}.${extMap[file.type]}`;
    showFeedback('Logo wird hochgeladen …');
    const { error } = await window.supabaseClient.storage.from(LOGO_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
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
  function removeLauncher() { document.getElementById(LAUNCHER_ID)?.remove(); }

  function ensureLauncher() {
    if (!panel || document.getElementById(LAUNCHER_ID)) return;
    const launcher = document.createElement('section');
    launcher.id = LAUNCHER_ID;
    launcher.className = 'container admin-session-banner admin-onboarding-resume-launcher';
    launcher.innerHTML = `
      <div><strong>Ligabranding noch nicht abgeschlossen</strong><span class="muted">Name, Links, Farbschema und Logo der neuen Liga können jetzt eingerichtet werden.</span></div>
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
    document.getElementById(PANEL_ID)?.remove();
    panel = document.createElement('section');
    panel.className = 'panel admin-panel-wide admin-panel-accent';
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <h2>Liga Branding einrichten</h2>
      <div class="notice">Richte hier nur den öffentlichen Auftritt deiner Liga ein. Rennkalender, Saison, Fahrer und Teams werden anschließend in den jeweiligen Admin-Bereichen verwaltet.</div>

      <div class="form-grid section-spacer-top">
        <div class="field"><label for="onboarding-brand-name">Liganame</label><input id="onboarding-brand-name" maxlength="80" placeholder="z. B. German Racing League"></div>
        <div class="field"><label for="onboarding-brand-subtitle">Untertitel</label><input id="onboarding-brand-subtitle" maxlength="120" placeholder="z. B. Sim Racing Championship"></div>
        <div class="field full"><label for="onboarding-brand-description">Beschreibung</label><textarea id="onboarding-brand-description" rows="4" maxlength="500" placeholder="Kurze Beschreibung der Liga oder Community"></textarea></div>
        <div class="field"><label for="onboarding-brand-website">Website</label><input id="onboarding-brand-website" type="url" placeholder="https://example.com"></div>
        <div class="field"><label for="onboarding-brand-discord">Discord</label><input id="onboarding-brand-discord" type="url" placeholder="https://discord.gg/…"></div>
        <div class="field full"><label for="onboarding-brand-logo-file">Logo hochladen</label><input id="onboarding-brand-logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"><small>PNG, JPG, WebP oder SVG · maximal 2 MB.</small><input id="onboarding-brand-logo-url" type="hidden"></div>
        <div class="field full"><img id="onboarding-brand-logo-preview" alt="Logo-Vorschau" hidden style="max-width:240px;max-height:120px;object-fit:contain;margin:.5rem 0"></div>
      </div>

      <div class="rcc-theme-picker-wrap">
        <div><span class="eyebrow">Farbschema</span><h3>Design auswählen</h3><p class="muted">Alle Schemen sind für gute Lesbarkeit abgestimmt und steuern die komplette Oberfläche – inklusive Header, Footer, Cards, Buttons und Scrollindikatoren.</p></div>
        <div id="onboarding-theme-picker" class="rcc-theme-picker" role="radiogroup" aria-label="Farbschema auswählen"></div>
        <div id="onboarding-theme-preview" class="rcc-theme-preview" aria-label="Live-Vorschau des Farbschemas">
          <div class="rcc-theme-preview__progress"></div>
          <div class="rcc-theme-preview__header"><div class="rcc-theme-preview__brand"><i class="rcc-theme-preview__logo"></i><div><strong>Deine Rennliga</strong><span>Header & Navigation</span></div></div><span data-theme-preview-title>RCC Standard</span></div>
          <div class="rcc-theme-preview__body"><div class="rcc-theme-preview__card"><span>Race Hub / Admin Card</span><strong>Season 1 · Round 01</strong></div><span class="rcc-theme-preview__button">Primäraktion</span></div>
          <div class="rcc-theme-preview__footer"><span>Footer & sekundäre Elemente</span><i></i></div>
        </div>
      </div>

      <div class="card-actions section-spacer-top"><button type="button" class="button-primary" id="onboarding-finish">Branding speichern & Einrichtung abschließen</button></div>
      <div id="league-onboarding-feedback" class="notice section-spacer-top" hidden></div>`;

    document.querySelector('.admin-layout')?.appendChild(panel);
    restorePayload(payloadFromLeague(context.league));
    panel.querySelector('#onboarding-brand-logo-file')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) updateLogoPreview(URL.createObjectURL(file));
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
      const themeSettings = window.RCCThemePresets?.toSettings?.(payload.theme_id) || {};
      const settings = {
        ...(league.settings || {}),
        ...themeSettings,
        brand_name: payload.name,
        brand_subtitle: payload.subtitle,
        public_description: payload.description,
        public_website: normalizeUrl(payload.website),
        public_discord: normalizeUrl(payload.discord),
        brand_logo_url: logoUrl,
        onboarding_complete: true
      };

      showFeedback('Ligabranding wird gespeichert …');
      const { error } = await window.supabaseClient.from('leagues').update({ name: payload.name, settings }).eq('id', league.id);
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
    if (!window.RCCWizardDialog?.open) { panel.hidden = false; return true; }
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
    ensureThemeStylesheet();
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

  window.RCCLeagueBrandingOnboarding = { init, open, finishOnboarding, payloadFromForm, restorePayload };
})();
