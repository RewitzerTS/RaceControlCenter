(() => {
  'use strict';

  if (window.RCCF1NewsBackend?.installed) return;

  const ENDPOINT = 'https://kjccstcbqygxuqkvdaqw.supabase.co/functions/v1/f1-news';
  const LEGACY_PROXY_HOSTS = new Set([
    'api.rss2json.com',
    'api.rss2json.io',
    'api.allorigins.win'
  ]);
  const MEMORY_TTL_MS = 60 * 1000;
  const nativeFetch = window.fetch.bind(window);
  let inFlight = null;
  let memoryItems = [];
  let memoryFetchedAt = 0;

  function isLegacyNewsProxy(input) {
    try {
      const raw = input instanceof Request ? input.url : String(input || '');
      return LEGACY_PROXY_HOSTS.has(new URL(raw, window.location.href).hostname);
    } catch (_error) {
      return false;
    }
  }

  async function loadItems() {
    if (memoryItems.length && (Date.now() - memoryFetchedAt) < MEMORY_TTL_MS) return memoryItems;
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const anonKey = typeof SUPABASE_ANON_KEY === 'string' ? SUPABASE_ANON_KEY : '';
        const response = await nativeFetch(ENDPOINT, {
          method: 'GET',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`
          }
        });
        if (!response.ok) return [];
        const payload = await response.json();
        const items = Array.isArray(payload?.items) ? payload.items : [];
        memoryItems = items
          .filter((entry) => entry?.headline)
          .map((entry) => ({
            headline: String(entry.headline || '').trim(),
            link: String(entry.link || '').trim(),
            timestamp: Number(entry.timestamp || 0),
            source: String(entry.source || '').trim()
          }))
          .filter((entry) => entry.headline && /^https?:\/\//i.test(entry.link));
        memoryFetchedAt = Date.now();
        return memoryItems;
      } catch (error) {
        console.debug('RaceVora F1-News Backend nicht erreichbar', error);
        return [];
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  }

  function jsonGatewayResponse(items) {
    const body = {
      status: 'ok',
      feed: { title: 'RaceVora F1 News' },
      items: items.map((entry) => ({
        title: entry.headline,
        link: entry.link,
        pubDate: entry.timestamp ? new Date(entry.timestamp).toISOString() : '',
        author: entry.source || ''
      }))
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  function emptyXmlResponse() {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel></channel></rss>', {
      status: 200,
      headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
    });
  }

  window.fetch = async function raceVoraFetch(input, init) {
    if (!isLegacyNewsProxy(input)) return nativeFetch(input, init);

    let url;
    try {
      url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    } catch (_error) {
      return nativeFetch(input, init);
    }

    const items = await loadItems();
    if (url.hostname === 'api.allorigins.win') return emptyXmlResponse();
    return jsonGatewayResponse(items);
  };

  window.RCCF1NewsBackend = Object.freeze({
    installed: true,
    endpoint: ENDPOINT,
    refresh: loadItems
  });
})();
