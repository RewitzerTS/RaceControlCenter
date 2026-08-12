(() => {
  function value(id) { return String(document.getElementById(id)?.value || '').trim(); }
  function feedback(message, error = false) {
    const el = document.getElementById('league-branding-feedback');
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.classList.toggle('notice-error', error);
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
    const panel = document.getElementById('admin-section-branding');
    if (!panel || panel.dataset.initialized === 'true') return;
    panel.dataset.initialized = 'true';
    document.getElementById('save-league-branding-btn')?.addEventListener('click', save);
    await load();
  }

  window.RCCAdminBranding = { init, load, save };
})();
