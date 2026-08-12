(() => {
  if (document.body?.dataset.page !== 'admin') return;

  let checking = false;
  let lastCheckedSlug = null;

  function requestedSlug() {
    return String(new URLSearchParams(window.location.search).get('league') || 'rcc')
      .trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'rcc';
  }

  function removeDuplicateLeagueSwitchers() {
    const switchers = [...document.querySelectorAll('#admin-league-switcher')];
    switchers.slice(1).forEach((node) => node.remove());

    // Defensive cleanup for a race where duplicate switchers were created with duplicated IDs.
    const selects = [...document.querySelectorAll('#admin-league-select')];
    selects.slice(1).forEach((select) => {
      const wrapper = select.closest('#admin-league-switcher, .admin-session-banner');
      if (wrapper && wrapper !== document.querySelector('#admin-league-switcher')) wrapper.remove();
    });
  }

  async function reconcileOnboarding() {
    if (checking) return;
    const client = window.supabaseClient;
    if (!client) return;
    checking = true;
    try {
      const slug = requestedSlug();
      const { data: league, error } = await client
        .from('leagues')
        .select('id, slug, settings')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      if (!league?.id) return;

      const complete = league.settings?.onboarding_complete === true;
      let hasSeason = false;
      if (!complete) {
        const { data: seasons, error: seasonError } = await client
          .from('seasons')
          .select('id')
          .eq('league_id', league.id)
          .limit(1);
        if (seasonError) throw seasonError;
        hasSeason = Boolean(seasons?.length);
      }

      if (complete || hasSeason) {
        document.getElementById('admin-section-league-onboarding')?.remove();
        const url = new URL(window.location.href);
        if (url.searchParams.has('onboarding')) {
          url.searchParams.delete('onboarding');
          window.history.replaceState({}, '', url.toString());
        }
      }
      lastCheckedSlug = slug;
    } catch (error) {
      console.warn('Admin tenant sanity check failed.', error);
    } finally {
      checking = false;
    }
  }

  function reconcile() {
    removeDuplicateLeagueSwitchers();
    reconcileOnboarding();
  }

  const observer = new MutationObserver(() => {
    removeDuplicateLeagueSwitchers();
    if (document.getElementById('admin-section-league-onboarding')) reconcileOnboarding();
  });

  function init() {
    reconcile();
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('rcc:league-context-ready', reconcile);
    window.setTimeout(reconcile, 250);
    window.setTimeout(reconcile, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.RCCAdminTenantSanity = { reconcile };
})();
