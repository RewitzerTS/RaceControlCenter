(() => {
  let initialized = false;

  async function init() {
    if (initialized) return;
    const client = window.supabaseClient;
    const leagueContext = window.RCCLeagueContext;
    if (!client || !leagueContext || client.__rccOnboardingContextGuard) return;

    const previousRpc = client.rpc.bind(client);
    client.rpc = (fn, args, options) => {
      if (fn !== 'complete_league_onboarding') return previousRpc(fn, args, options);

      return (async () => {
        const requestedSlug = leagueContext.getRequestedLeagueSlug();
        const context = await leagueContext.initialize({ slug: requestedSlug, forceRefresh: true });
        if (!context?.leagueId) throw new Error('Die aktuelle Liga konnte nicht eindeutig aufgelöst werden.');
        if (context.slug !== requestedSlug) throw new Error('Liga-Kontext stimmt nicht mit der aufgerufenen Liga überein.');

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
