(() => {
  const PANEL_ID = 'admin-section-branding';

  function value(id) {
    return String(document.getElementById(id)?.value || '').trim();
  }

  function feedback(message, error = false) {
    const el = document.getElementById('league-branding-feedback');
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.classList.toggle('notice-error', error);
  }

  function mountPanel() {
    if (document.getElementById(PANEL_ID)) return document.getElementById(PANEL_ID);
    const layout = document.querySelector('.admin-layout');
    if (!layout) return null;

    const panel = document.createElement('details');
    panel.className = 'panel admin-panel-wide';
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <summary><strong>Liga-Branding</strong></summary>
      <section class="panel admin-panel-accent">
        <h3>Öffentlicher Auftritt</h3>
        <div class="notice">Diese Einstellungen gelten nur für die aktuell ausgewählte Liga.</div>
        <div class="form-grid section-spacer-top">
          <div class="field"><label for="league-brand-name">Anzeigename</label><input id="league-brand-name" placeholder="z. B. German Racing League"></div>
          <div class="field"><label for="league-brand-subtitle">Untertitel</label><input id="league-brand-subtitle" placeholder="z. B. Sim Racing Championship"></div>
          <div class="field full"><label for="league-brand-logo-url">Logo-URL</label><input id="league-brand-logo-url" type="url" placeholder="https://…/logo.png"></div>
          <div class="field"><label for="league-brand-primary">Primärfarbe</label><input id="league-brand-primary" type="color" value="#35246A"></div>
          <div class="field"><label for="league-brand-secondary">Sekundärfarbe</label><input id="league-brand-secondary" type="color" value="#5A32A3"></div>
          <div class="field"><label for="league-brand-accent">Akzentfarbe</label><input id="league-brand-accent" type="color" value="#2C8FA6"></div>
        </div>
        <div class="card-actions"><button type="button" class="button-primary" id="save-league-branding-btn">Branding speichern</button></div>
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
    document.getElementById('league-brand-logo-url').value = settings.brand_logo_url || league.logo_url || '';
    document.getElementById('league-brand-primary').value = settings.primary_color || '#35246A';
    document.getElementById('league-brand-secondary').value = settings.secondary_color || '#5A32A3';
    document.getElementById('league-brand-accent').value = settings.accent_color || '#2C8FA6';
  }

  async function save() {
    try {
      await window.requireAdminSession();
      const context = await window.RCCData.getLeagueContext({ forceRefresh: true });
      if (!['owner', 'admin'].includes(context?.role)) throw new Error('Nur Owner und Admins dürfen das Liga-Branding ändern.');
      const league = context.league;
      const settings = { ...(league.settings || {}) };
      settings.brand_name = value('league-brand-name') || league.name;
      settings.brand_subtitle = value('league-brand-subtitle');
      settings.brand_logo_url = value('league-brand-logo-url');
      settings.primary_color = value('league-brand-primary');
      settings.secondary_color = value('league-brand-secondary');
      settings.accent_color = value('league-brand-accent');

      const { data, error } = await window.supabaseClient
        .from('leagues')
        .update({ settings })
        .eq('id', league.id)
        .select('id, name, slug, logo_url, status, is_public, settings')
        .single();
      if (error) throw error;

      await window.RCCLeagueContext.initialize({ slug: league.slug, forceRefresh: true });
      await window.RCCBranding?.apply?.({ forceRefresh: true });
      feedback('Liga-Branding wurde gespeichert. Die öffentliche Darstellung wurde aktualisiert.');
      return data;
    } catch (error) {
      console.error(error);
      feedback(`Branding konnte nicht gespeichert werden: ${error.message}`, true);
    }
  }

  async function init() {
    const panel = mountPanel();
    if (!panel || panel.dataset.initialized === 'true') return;
    panel.dataset.initialized = 'true';
    document.getElementById('save-league-branding-btn')?.addEventListener('click', save);
    try { await load(); } catch (error) { console.error('Liga-Branding konnte nicht geladen werden:', error); }
  }

  function boot() {
    init();
    const observer = new MutationObserver(() => {
      if (document.querySelector('.admin-layout')) {
        init();
        observer.disconnect();
      }
    });
    if (!document.querySelector('.admin-layout')) observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.RCCAdminBranding = { init, load, save };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
