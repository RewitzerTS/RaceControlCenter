(() => {
  // RCCLeagueContext is created centrally by supabase-client.js.
  // Keep this file as a compatibility target for older dynamic loaders only;
  // duplicating the tenant/session implementation here previously caused
  // divergent caches and duplicate Supabase requests.
  if (!window.RCCLeagueContext?.initialize) {
    console.error('RCC LeagueContext is unavailable. Load supabase-client.js before rcc-data.js.');
  }
})();
