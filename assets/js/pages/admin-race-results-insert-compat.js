(() => {
  const install = () => {
    const client = window.supabaseClient;
    if (!client || client.__rccRaceResultsInsertCompat) return;
    const originalFrom = client.from.bind(client);
    client.from = (table) => {
      const builder = originalFrom(table);
      if (table === 'race_results' && typeof builder.upsert === 'function' && typeof builder.insert === 'function') {
        builder.upsert = (payload) => builder.insert(payload);
      }
      return builder;
    };
    client.__rccRaceResultsInsertCompat = true;
  };
  install();
  document.addEventListener('DOMContentLoaded', install, { once: true });
})();
