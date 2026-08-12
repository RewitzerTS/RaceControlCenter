(() => {
  let initialized = false;
  let observer = null;
  let reconcileRunning = false;
  let leagueIsComplete = false;

  function requestedSlug() {
    return String(new URLSearchParams(window.location.search).get('league') || 'rcc')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') || 'rcc';
  }

  function removeDuplicateLeagueSwitchers() {
    const switchers = [...document.querySelectorAll('#admin-league-switcher')];
    if (switchers.length <= 1) return;
    switchers.slice(1).forEach((node) => node.remove());
  }

  function removeCompletedOnboardingPanel() {
    if (!leagueIsComplete) return;
    document.getElementById('admin-section-league-onboarding')?.remove();

    const url = new URL(window.location.href);
    if (url.searchParams.has('onboarding')) {
      url.searchParams.delete('onboarding');
      window.history.replaceState({}, '', url.toString());
    }
  }

  async function reconcileLeagueState() {
    if (reconcileRunning) return;
    const client = window.supabaseClient;
    const leagueContext = window.RCCLeagueContext;
    if (!client || !leagueContext) return;

    reconcileRunning = true;
    try {
      const slug = requestedSlug();

      // Resolve the context from the URL itself instead of trusting an older
      // in-memory league left behind by a previous league switch.
      await leagueContext.initialize({ slug, forceRefresh: true });

      const { data: league, error } = await client
        .from('leagues')
        .select('id, slug, settings')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      if (!league?.id) return;

      leagueIsComplete = league.settings?.onboarding_complete === true;

      if (!leagueIsComplete) {
        const { data: seasons, error: seasonError } = await client
          .from('seasons')
          .select('id')
          .eq('league_id', league.id)
          .limit(1);
        if (seasonError) throw seasonError;
        leagueIsComplete = Boolean(seasons?.length);
      }

      removeCompletedOnboardingPanel();
      removeDuplicateLeagueSwitchers();
    } catch (error) {
      console.warn('RCC onboarding context reconciliation failed.', error);
    } finally {
      reconcileRunning = false;
    }
  }

  function installRpcGuard() {
    const client = window.supabaseClient;
    const leagueContext = window.RCCLeagueContext;
    if (!client || !leagueContext || client.__rccOnboardingContextGuard) return;

    const previousRpc = client.rpc.bind(client);
    client.rpc = (fn, args, options) => {
      if (fn !== 'complete_league_onboarding') return previousRpc(fn, args, options);

      return (async () => {
        const slug = requestedSlug();
        const context = await leagueContext.initialize({ slug, forceRefresh: true });
        if (!context?.leagueId) throw new Error('Die aktuelle Liga konnte nicht eindeutig aufgelöst werden.');
        if (context.slug !== slug) throw new Error('Liga-Kontext stimmt nicht mit der aufgerufenen Liga überein.');

        return previousRpc(fn, {
          ...args,
          p_league_id: context.leagueId
        }, options);
      })();
    };

    client.__rccOnboardingContextGuard = true;
  }

  function installDomGuard() {
    if (observer) return;
    observer = new MutationObserver(() => {
      removeDuplicateLeagueSwitchers();
      if (leagueIsComplete) {
        removeCompletedOnboardingPanel();
      } else if (document.getElementById('admin-section-league-onboarding')) {
        reconcileLeagueState();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function init() {
    if (initialized) return;
    const client = window.supabaseClient;
    const leagueContext = window.RCCLeagueContext;
    if (!client || !leagueContext) return;

    installRpcGuard();
    installDomGuard();
    await reconcileLeagueState();

    window.addEventListener('rcc:league-context-ready', () => {
      removeDuplicateLeagueSwitchers();
      reconcileLeagueState();
    });

    initialized = true;
  }

  window.RCCOnboardingContextGuard = {
    init,
    reconcile: reconcileLeagueState
  };
})();
