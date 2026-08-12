(() => {
  let initialized = false;

  async function init() {
    if (initialized) return;
    const client = window.supabaseClient;
    const leagueContext = window.RCCLeagueContext;
    if (!client || !leagueContext || client.__rccOnboardingContextGuard) return;

    const requestedSlug = leagueContext.getRequestedLeagueSlug();
    const freshContext = await leagueContext.initialize({ slug: requestedSlug, forceRefresh: true });
    if (!freshContext?.leagueId) throw new Error('Die aktuelle Liga konnte nicht eindeutig aufgelöst werden.');
    if (freshContext.slug !== requestedSlug) throw new Error('Liga-Kontext stimmt nicht mit der aufgerufenen Liga überein.');

    const previousRpc = client.rpc.bind(client);
    client.rpc = (fn, args, options) => {
      if (fn !== 'complete_league_onboarding') return previousRpc(fn, args, options);

      return (async () => {
        const currentSlug = leagueContext.getRequestedLeagueSlug();
        const context = await leagueContext.initialize({ slug: currentSlug, forceRefresh: true });
        if (!context?.leagueId) throw new Error('Die aktuelle Liga konnte nicht eindeutig aufgelöst werden.');
        if (context.slug !== currentSlug) throw new Error('Liga-Kontext stimmt nicht mit der aufgerufenen Liga überein.');

        return previousRpc(fn, {
          ...args,
          p_league_id: context.leagueId
        }, options);
      })();
    };

    client.__rccOnboardingContextGuard = true;
    initialized = true;
  }

  window.RCCOnboardingContextGuard = { init };
})();
