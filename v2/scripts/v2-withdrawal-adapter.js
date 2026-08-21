(() => {
  const config = window.RACEVORA_V2_WITHDRAWAL_CONFIG;
  if (!config?.endpoint || !config?.publishableKey) return;

  window.supabaseClient = {
    functions: {
      async invoke(name, options = {}) {
        if (name !== 'submit-consumer-withdrawal') {
          return { data: null, error: new Error('Unbekannte Serverfunktion.') };
        }

        try {
          const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
              apikey: config.publishableKey,
              Authorization: `Bearer ${config.publishableKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(options.body ?? {}),
          });
          const data = await response.json().catch(() => null);
          if (!response.ok && !data?.ok) {
            return { data, error: new Error(data?.error || `Serverantwort ${response.status}`) };
          }
          return { data, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
    },
  };
})();
