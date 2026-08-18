(() => {
  if (document.body?.dataset?.page !== 'admin') return;
  if (window.__RCC_ADMIN_PUBLISHED_RECALC_GUARD === true) return;

  const client = window.supabaseClient;
  const originalRecalculate = window.recalculateOfficialRaceResults;
  if (!client?.from || typeof originalRecalculate !== 'function') return;

  const originalFrom = client.from.bind(client);
  let recalcQueryConstruction = false;

  client.from = (table) => {
    const builder = originalFrom(table);
    if (!recalcQueryConstruction || table !== 'race_result_imports' || !builder?.select) return builder;

    const originalSelect = builder.select.bind(builder);
    builder.select = (...args) => {
      const query = originalSelect(...args);
      return typeof query?.eq === 'function' ? query.eq('status', 'published') : query;
    };
    return builder;
  };

  const guardedRecalculate = function (...args) {
    recalcQueryConstruction = true;
    try {
      // Async functions construct their Supabase queries synchronously until the first await.
      // The flag can therefore be released immediately after invoking the original function.
      return originalRecalculate.apply(this, args);
    } finally {
      recalcQueryConstruction = false;
    }
  };
  guardedRecalculate.__rccPublishedOnly = true;
  window.recalculateOfficialRaceResults = guardedRecalculate;
  window.__RCC_ADMIN_PUBLISHED_RECALC_GUARD = true;
})();