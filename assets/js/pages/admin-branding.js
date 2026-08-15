(() => {
  const PANEL_ID = 'admin-section-branding';
  const LOGO_BUCKET = 'league-brand-assets';

  function value(id) {
    return String(document.getElementById(id)?.value || '').trim();
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
    if (url) {
      preview.src = url;
      preview.hidden = false;
    } else {
      preview.removeAttribute('src');
      preview.hidden = true;
    }
  }

  function mountPanel() {
    if (document.getElementById(PANEL_ID)) return document.getElementById(PANEL_ID);
    const layout = document.querySelector('.admin-layout');
    if (!layout) return null;

    const panel = document.createElement('details');
    panel.className = 'panel admin-panel-wide';
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <summary><strong>Liga-Branding & öffentlicher Auftritt</strong></summary>
      <section class="panel admin-panel-accent">
        <h3>Öffentlicher Auftritt</h3>
        <div class="notice">Diese Einstellungen gelten nur für die aktuell ausgewählte Liga.</div>
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
          <div class="field full">
            <img id="league-brand-logo-preview" alt="Logo-Vorschau" hidden style="max-width:220px;max-height:110px;object-fit:contain;margin:.5rem 0">
          </div>
          <div class="field full">
            <label for="league-brand-logo-url">Logo-URL</label>
            <input id="league-brand-logo-url" type="url" placeholder="Wird beim Upload automatisch eingetragen">
          </div>
          <div class="field">
            <label for="league-brand-background">Hintergrundfarbe</label>
            <input id="league-brand-background" type="color" value="#021B34">
          </div>
          <div class="field">
            <label for="league-brand-primary">Primärfarbe</label>
            <input id="league-brand-primary" type="color" value="#35246A">
          </div>
          <div class="field">
            <label for="league-brand-secondary">Sekundärfarbe</label>
            <input id="league-brand-secondary" type="color" value="#5A32A3">
          </div>
          <div class="field">
            <label for="league-brand-accent">Akzentfarbe</label>
            <input id="league-brand-accent" type="color" value="#2C8FA6">
          </div>
        </div>
        <div class="card-actions">
          <button type="button" class="button-primary" id="save-league-branding-btn">Auftritt speichern</button>
        </div>
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

    document.getElementById('league-brand-background').value = settings.background_color || '#021B34';
    document.getElementById('league-brand-primary').value = settings.primary_color || '#35246A';
    document.getElementById('league-brand-secondary').value = settings.secondary_color || '#5A32A3';
    document.getElementById('league-brand-accent').value = settings.accent_color || '#2C8FA6';
  }

  async function uploadSelectedLogo(context) {
    const file = document.getElementById('league-brand-logo-file')?.files?.[0];
    if (!file) return value('league-brand-logo-url');
    if (file.size > 2 * 1024 * 1024) throw new Error('Das Logo darf maximal 2 MB groß sein.');

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      throw new Error(`Dateityp ${file.type || 'unbekannt'} ist nicht erlaubt. Bitte PNG, JPG, WebP oder SVG verwenden.`);
    }

    const extMap = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };
    const path = `${context.league.slug}/logo-${Date.now()}.${extMap[file.type] || 'png'}`;
    feedback('Logo wird hochgeladen …');

    const { error } = await window.supabaseClient.storage
      .from(LOGO_BUCKET)
      .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
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
      if (!['owner', 'admin'].includes(context?.role)) {
        throw new Error('Nur Owner und Admins dürfen den öffentlichen Liga-Auftritt ändern.');
      }

      const league = context.league;
      const name = value('league-brand-name') || league.name;
      const logoUrl = await uploadSelectedLogo(context);
      const settings = {
        ...(league.settings || {}),
        brand_name: name,
        brand_subtitle: value('league-brand-subtitle'),
        public_description: value('league-profile-description').slice(0, 500),
        public_website: value('league-profile-website'),
        public_discord: value('league-profile-discord'),
        brand_logo_url: logoUrl,
        background_color: value('league-brand-background'),
        primary_color: value('league-brand-primary'),
        secondary_color: value('league-brand-secondary'),
        accent_color: value('league-brand-accent')
      };

      feedback('Öffentlicher Auftritt wird gespeichert …');
      const { error } = await window.supabaseClient
        .from('leagues')
        .update({ name, settings })
        .eq('id', league.id);
      if (error) throw error;

      await window.RCCLeagueContext.initialize({ slug: league.slug, forceRefresh: true });
      await window.RCCBranding?.apply?.({ forceRefresh: true });
      feedback('Liga-Auftritt wurde gespeichert und öffentlich aktualisiert.');
    } catch (error) {
      console.error(error);
      feedback(`Liga-Auftritt konnte nicht gespeichert werden: ${error.message}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function init() {
    const panel = mountPanel();
    if (!panel || panel.dataset.initialized === 'true') return;
    panel.dataset.initialized = 'true';

    document.getElementById('league-brand-logo-file')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) updatePreview(URL.createObjectURL(file));
    });
    document.getElementById('save-league-branding-btn')?.addEventListener('click', save);

    try {
      await load();
    } catch (error) {
      console.error('Liga-Auftritt konnte nicht geladen werden:', error);
    }
  }

  window.RCCAdminBranding = { init, load, save };
})();
