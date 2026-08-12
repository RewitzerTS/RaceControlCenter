(() => {
  if (document.body?.dataset.page !== 'admin') return;

  const roleLabels = { owner: 'Owner', admin: 'Ligaleitung', member: 'Member', steward: 'Steward' };

  async function isPlatformOwner() {
    const { data, error } = await window.supabaseClient.rpc('is_platform_owner');
    if (error) throw error;
    return data === true;
  }

  async function fetchAllActiveLeagues() {
    const { data, error } = await window.supabaseClient
      .from('leagues')
      .select('id, name, slug, status, is_public')
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function fetchOwnRoles(userId) {
    const { data, error } = await window.supabaseClient
      .from('league_members')
      .select('league_id, role')
      .eq('user_id', userId);
    if (error) throw error;
    return new Map((data || []).map((row) => [row.league_id, row.role]));
  }

  async function render() {
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    if (!session?.user?.id || !(await isPlatformOwner())) return;

    const [leagues, roles] = await Promise.all([
      fetchAllActiveLeagues(),
      fetchOwnRoles(session.user.id)
    ]);

    let switcher = document.getElementById('admin-league-switcher');
    if (!switcher) return;

    const currentSlug = window.RCCLeagueContext?.getSlug?.() || 'rcc';
    switcher.innerHTML = `
      <label for="admin-league-select"><strong>Aktive Liga:</strong></label>
      <select id="admin-league-select" aria-label="Aktive Liga auswählen">
        ${leagues.map((league) => {
          const role = roles.get(league.id);
          const accessLabel = role ? (roleLabels[role] || role) : 'Plattform-Owner';
          return `<option value="${league.slug}" ${league.slug === currentSlug ? 'selected' : ''}>${league.name} · ${accessLabel}</option>`;
        }).join('')}
      </select>
      <span class="muted">Globaler Owner-Zugriff · ${leagues.length} aktive Liga${leagues.length === 1 ? '' : 'en'}</span>`;
    switcher.hidden = false;

    switcher.querySelector('#admin-league-select')?.addEventListener('change', (event) => {
      const slug = String(event.target.value || '').trim();
      if (!slug || slug === currentSlug) return;
      if (window.RCCAdminTenant?.navigateToLeague) {
        window.RCCAdminTenant.navigateToLeague(slug);
      } else {
        const url = new URL(window.location.href);
        url.searchParams.set('league', slug);
        window.location.assign(url.toString());
      }
    });
  }

  async function init() {
    try {
      await render();
      window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session && ['SIGNED_IN', 'TOKEN_REFRESHED'].includes(event)) {
          window.setTimeout(() => render().catch(console.warn), 0);
        }
      });
    } catch (error) {
      console.warn('Globaler Owner-Ligawechsel konnte nicht initialisiert werden.', error);
    }
  }

  window.addEventListener('load', init, { once: true });
})();
