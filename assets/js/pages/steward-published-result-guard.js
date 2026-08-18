(() => {
  if (document.body?.dataset?.page !== 'stewards') return;
  const client = window.supabaseClient;
  if (!client?.from || client.__rccPublishedImportGuard === true) return;

  const originalFrom = client.from.bind(client);
  client.from = (table) => {
    const builder = originalFrom(table);
    if (table !== 'race_result_imports' || !builder?.select) return builder;

    const originalSelect = builder.select.bind(builder);
    builder.select = (...args) => {
      const query = originalSelect(...args);
      return typeof query?.eq === 'function' ? query.eq('status', 'published') : query;
    };
    return builder;
  };
  client.__rccPublishedImportGuard = true;
})();