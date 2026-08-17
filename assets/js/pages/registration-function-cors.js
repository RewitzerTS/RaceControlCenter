(() => {
  'use strict';

  // Registration pages are not operating inside an existing tenant yet.
  // The shared Supabase client normally attaches x-rcc-league-slug globally,
  // but finalize-consumer-registration intentionally does not need that header.
  // Removing it here keeps the browser CORS preflight limited to the headers
  // explicitly accepted by the registration Edge Function.
  const headers = window.supabaseClient?.headers;
  if (!headers || typeof headers !== 'object') return;

  Object.keys(headers).forEach((key) => {
    if (String(key).toLowerCase() === 'x-rcc-league-slug') delete headers[key];
  });
})();
