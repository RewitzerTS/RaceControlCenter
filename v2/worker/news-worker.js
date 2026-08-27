const FEEDS = [
  ['Motorsport.com DE', 'https://de.motorsport.com/rss/f1/news/'],
  ['Motorsport-Total', 'https://www.motorsport-total.com/rss/rss_formel-1.xml'],
  ['Sportschau Formel 1', 'https://www.sportschau.de/motorsport/formel1/index~rss2.xml'],
  ['Autosport', 'https://www.autosport.com/rss/f1/news/'],
];

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600',
  'X-Content-Type-Options': 'nosniff',
};

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function elementText(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return decodeXml(block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'))?.[1]);
}

function elementHref(block) {
  return decodeXml(block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1]);
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function parseFeed(xml, source) {
  const rss = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const blocks = rss.length ? rss : (xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || []);
  return blocks.slice(0, 8).map((block) => {
    const headline = elementText(block, 'title');
    const link = safeUrl(elementText(block, 'link')) || safeUrl(elementHref(block)) || safeUrl(elementText(block, 'guid'));
    const published = elementText(block, 'pubDate') || elementText(block, 'published') || elementText(block, 'updated') || elementText(block, 'dc:date');
    const parsedTime = published ? Date.parse(published) : 0;
    return { headline, link, timestamp: Number.isFinite(parsedTime) ? parsedTime : 0, source };
  }).filter((item) => item.headline && item.link);
}

async function fetchFeed([source, url]) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(4500),
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
        'User-Agent': 'RaceVora-F1-News/4.0 (+https://racevora.com)',
      },
    });
    if (!response.ok) return [];
    const xml = await response.text();
    if (xml.length > 2_000_000) return [];
    return parseFeed(xml, source);
  } catch {
    return [];
  }
}

async function newsResponse(request, context) {
  const url = new URL(request.url);
  const cacheKey = new Request(`${url.origin}/api/f1-news`, { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const items = (await Promise.all(FEEDS.map(fetchFeed)))
    .flat()
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.headline.toLocaleLowerCase('de-DE') === item.headline.toLocaleLowerCase('de-DE')) === index)
    .slice(0, 16);
  const response = new Response(JSON.stringify({ items, refreshedAt: new Date().toISOString() }), {
    status: 200,
    headers: RESPONSE_HEADERS,
  });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export default {
  async fetch(request, environment, context) {
    const url = new URL(request.url);
    if (url.hostname.toLowerCase() === 'www.racevora.com') {
      return Response.redirect('https://racevora.com/', 308);
    }
    if (url.pathname === '/') {
      // Cloudflare Assets canonicalizes *.html to extensionless URLs. Fetch the
      // canonical asset internally so the public root stays at racevora.com/.
      const landingUrl = new URL('/landing', url);
      return environment.ASSETS.fetch(new Request(landingUrl, request));
    }
    if (url.pathname === '/api/f1-news') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: RESPONSE_HEADERS });
      if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: RESPONSE_HEADERS });
      return newsResponse(request, context);
    }
    return environment.ASSETS.fetch(request);
  },
};
