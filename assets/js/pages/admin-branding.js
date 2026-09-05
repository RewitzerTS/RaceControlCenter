(() => {
  const PANEL_ID = 'admin-section-branding';
  const LOGO_BUCKET = 'league-brand-assets';
  const THEME_STYLESHEET = 'assets/css/components/rcc-branding-themes.css';
  const CHECK_ICON = '<svg class="rcc-icon--check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6"/></svg>';
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

  function feedback(message, error = false) {
    const el = document.getElementById('league-branding-feedback');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message;
    el.classList.toggle('notice-error', error);
  }

  function updatePreview(url) {
    const preview = document.getElementById('league-brand-logo-preview');
    if (!preview) return;
    if (url) { preview.src = url; preview.hidden = false; }
    else { preview.removeAttribute('src'); preview.hidden = true; }
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
          <input type="radio" name="league-brand-theme" value="${escapeHtml(theme.id)}" ${theme.id === selectedId ? 'checked' : ''}>
          <span class="rcc-theme-option__top">
            <span><strong>${escapeHtml(theme.id)}. ${escapeHtml(theme.name)}</strong><small>${escapeHtml(theme.subtitle)}</small></span>
            <span class="rcc-theme-option__check" aria-hidden="true">${CHECK_ICON}</span>
          </span>
          <span class="rcc-theme-swatches" aria-label="Farben des Schemas">${swatches}</span>
        </label>`;
    }).join('');
  }

  function applyThemePreview(theme) {
    const preview = document.getElementById('league-theme-preview');
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

  function renderThemePicker(selectedId, hasLegacyColors = false) {
    const picker = document.getElementById('league-theme-picker');
    if (!picker) return;
    selectedThemeId = getTheme(selectedId)?.id || '0';
    picker.innerHTML = themePickerMarkup(selectedThemeId);
    const legacyNote = document.getElementById('league-branding-legacy-theme-note');
    if (legacyNote) legacyNote.hidden = !hasLegacyColors;
    picker.querySelectorAll('input[name="league-brand-theme"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        selectedThemeId = input.value;
        applyThemePreview(getTheme(selectedThemeId));
      });
    });
    applyThemePreview(getTheme(selectedThemeId));
  }

  function mountPanel() {
    if (document.getElementById(PANEL_ID)) {
      panel = document.getElementById(PANEL_ID);
      return panel;
    }
    const layout = document.querySelector('.admin-layout');
    if (!layout) return null;

    panel = document.createElement('details');
    panel.className = 'panel admin-panel-wide';
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <summary><strong>Liga-Branding & öffentlicher Auftritt</strong></summary>
      <section class="panel admin-panel-accent">
        <h3>Branding bearbeiten</h3>
        <div class="notice">Diese Einstellungen gelten nur für die aktuell ausgewählte Liga. Farben werden aus geprüften RCC-Farbschemata gewählt, damit Kontrast und Lesbarkeit erhalten bleiben.</div>
        <div class="form-grid section-spacer-top">
          <div class="field">
            <label for="league-brand-name">Liganame</label>
            <input id="league-brand-name" placeholder="z. B. German Racing League">
          </div>
          <div class="field">
            <label for="league-brand-subtitle">Untertitel</label>
            <input id="league-brand-subtitle" placeholder="z. B. Sim Racing Championship">
          </div>
          <div class="field full">
            <label for="league-profile-description">Liga-Beschreibung</label>
            <textarea id="league-profile-description" rows="4" maxlength="500" placeholder="Kurze Beschreibung der Liga, Rennserie oder Community"></textarea>
            <small>Maximal 500 Zeichen.</small>
          </div>
          <div class="field">
            <label for="league-profile-website">Website</label>
            <input id="league-profile-website" type="url" placeholder="https://example.com">
          </div>
          <div class="field">
            <label for="league-profile-discord">Discord</label>
            <input id="league-profile-discord" type="url" placeholder="https://discord.gg/…">
          </div>
          <div class="field full">
            <label for="league-brand-logo-file">Logo auswählen</label>
            <input id="league-brand-logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
            <small>PNG, JPG, WebP oder SVG · maximal 2 MB. Beim Speichern wird die Datei automatisch hochgeladen.</small>
          </div>
          <div class="field full"><img id="league-brand-logo-preview" alt="Logo-Vorschau" hidden style="max-width:220px;max-height:110px;object-fit:contain;margin:.5rem 0"></div>
          <div class="field full">
            <label for="league-brand-logo-url">Logo-URL</label>
            <input id="league-brand-logo-url" type="url" placeholder="Wird beim Upload automatisch eingetragen">
          </div>
        </div>

        <div class="rcc-theme-picker-wrap">
          <div>
            <span class="eyebrow">Farbschema</span>
            <h4>Design auswählen</h4>
            <p class="muted">Das gewählte Schema steuert Hintergrund, Cards, Header, Footer, Buttons, Schriftfarben sowie Lade- und Scrollindikatoren.</p>
          </div>
          <div id="league-branding-legacy-theme-note" class="notice rcc-theme-legacy-note" hidden>Diese Liga verwendet noch ein früheres individuelles Farbschema. Es bleibt aktiv, bis du speicherst. Beim Speichern wird das ausgewählte RCC-Schema übernommen.</div>
          <div id="league-theme-picker" class="rcc-theme-picker" role="radiogroup" aria-label="Farbschema auswählen"></div>

          <div id="league-theme-preview" class="rcc-theme-preview" aria-label="Live-Vorschau des Farbschemas">
            <div class="rcc-theme-preview__progress"></div>
            <div class="rcc-theme-preview__header">
              <div class="rcc-theme-preview__brand"><i class="rcc-theme-preview__logo"></i><div><strong>Race Control Center</strong><span>Header & Navigation</span></div></div>
              <span data-theme-preview-title>RCC Standard</span>
            </div>
            <div class="rcc-theme-preview__body">
              <div class="rcc-theme-preview__card"><span>Race Hub / Admin Card</span><strong>Nächstes Rennen · 20:00</strong></div>
              <span class="rcc-theme-preview__button">Primäraktion</span>
            </div>
            <div class="rcc-theme-preview__footer"><span>Footer & sekundäre Elemente</span><i></i></div>
          </div>
        </div>

        <div class="card-actions section-spacer-top"><button type="button" class="button-primary" id="save-league-branding-btn">Branding speichern</button></div>
        <div id="league-branding-feedback" class="notice" hidden></div>
      </section>`;

    const auth = document.getElementById('admin-section-auth');
    if (auth?.nextSibling) layout.insertBefore(panel, auth.nextSibling);
    else layout.prepend(panel);
    return panel;
  }

  async function load() {
    const context = await window.RCCData.getLeagueContext({ forceRefresh: true });
    const league = context?.league;
    if (!league) return;
    const settings = league.settings && typeof league.settings === 'object' ? league.settings : {};
    document.getElementById('league-brand-name').value = settings.brand_name || league.name || '';
    document.getElementById('league-brand-subtitle').value = settings.brand_subtitle || '';
    document.getElementById('league-profile-description').value = settings.public_description || '';
    document.getElementById('league-profile-website').value = settings.public_website || '';
    document.getElementById('league-profile-discord').value = settings.public_discord || '';
    const logoUrl = settings.brand_logo_url || league.logo_url || '';
    document.getElementById('league-brand-logo-url').value = logoUrl;
    updatePreview(logoUrl);

    const matchedTheme = window.RCCThemePresets?.match?.(settings) || null;
    const hasLegacyColors = !matchedTheme && Boolean(settings.background_color || settings.primary_color || settings.secondary_color || settings.accent_color);
    renderThemePicker(matchedTheme?.id || '0', hasLegacyColors);
  }

  async function uploadSelectedLogo(context) {
    const file = document.getElementById('league-brand-logo-file')?.files?.[0];
    if (!file) return value('league-brand-logo-url');
    if (file.size > 2 * 1024 * 1024) throw new Error('Das Logo darf maximal 2 MB groß sein.');
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) throw new Error(`Dateityp ${file.type || 'unbekannt'} ist nicht erlaubt. Bitte PNG, JPG, WebP oder SVG verwenden.`);
    const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
    const path = `${storageLeagueSlug(context.league.slug)}/logo-${Date.now()}.${extMap[file.type]}`;
    feedback('Logo wird hochgeladen …');
    const { error } = await window.supabaseClient.storage.from(LOGO_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
    if (error) throw new Error(`Storage-Upload fehlgeschlagen: ${error.message}`);
    const { data } = window.supabaseClient.storage.from(LOGO_BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) throw new Error('Öffentliche Logo-URL konnte nicht erzeugt werden.');
    document.getElementById('league-brand-logo-url').value = publicUrl;
    updatePreview(publicUrl);
    return publicUrl;
  }

  async function save() {
    const button = document.getElementById('save-league-branding-btn');
    if (button) button.disabled = true;
    try {
      await window.requireAdminSession();
      const context = await window.RCCData.getLeagueContext({ forceRefresh: true });
      if (!['owner', 'admin'].includes(context?.role)) throw new Error('Nur Owner und Admins dürfen den öffentlichen Liga-Auftritt ändern.');
      const theme = getTheme(selectedThemeId);
      if (!theme) throw new Error('Bitte ein gültiges RCC-Farbschema auswählen.');
      const league = context.league;
      const name = value('league-brand-name') || league.name;
      const logoUrl = await uploadSelectedLogo(context);
      const settings = {
        ...(league.settings || {}),
        ...window.RCCThemePresets.toSettings(theme.id),
        brand_name: name,
        brand_subtitle: value('league-brand-subtitle'),
        public_description: value('league-profile-description').slice(0, 500),
        public_website: value('league-profile-website'),
        public_discord: value('league-profile-discord'),
        brand_logo_url: logoUrl
      };

      feedback('Branding wird gespeichert …');
      const { error } = await window.supabaseClient.from('leagues').update({ name, settings }).eq('id', league.id);
      if (error) throw error;
      await window.RCCLeagueContext.initialize({ slug: league.slug, forceRefresh: true });
      await window.RCCBranding?.apply?.({ forceRefresh: true });
      feedback(`Branding gespeichert · Schema ${theme.id}. ${theme.name}.`);
    } catch (error) {
      console.error(error);
      feedback(`Liga-Auftritt konnte nicht gespeichert werden: ${error.message}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function open() {
    const target = mountPanel();
    if (!target) return false;
    try { await load(); } catch (error) { console.error('Liga-Auftritt konnte nicht geladen werden:', error); }
    if (!window.RCCWizardDialog?.open) { target.hidden = false; target.open = true; return true; }
    return window.RCCWizardDialog.open(target, {
      title: 'Liga-Branding bearbeiten',
      headerActionLabel: 'Schließen',
      onHeaderAction: () => window.RCCWizardDialog.close?.()
    });
  }

  async function init() {
    ensureThemeStylesheet();
    const target = mountPanel();
    if (!target || target.dataset.initialized === 'true') return;
    target.dataset.initialized = 'true';
    document.getElementById('league-brand-logo-file')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) updatePreview(URL.createObjectURL(file));
    });
    document.getElementById('save-league-branding-btn')?.addEventListener('click', save);
    try { await load(); } catch (error) { console.error('Liga-Auftritt konnte nicht geladen werden:', error); }
  }

  window.RCCAdminBranding = { init, load, save, open };
})();
