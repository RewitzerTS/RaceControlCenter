import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CACHE_KEY = "racevora-f1-news-v1";
const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6500;
const MAX_ITEMS_PER_SOURCE = 8;
const MAX_RESPONSE_ITEMS = 16;

const ALLOWED_ORIGINS = new Set([
  "https://racevora.com",
  "https://www.racevora.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const FEEDS = [
  { name: "Motorsport-Total", url: "https://www.motorsport-total.com/formel-1/rss" },
  { name: "Motorsport-Magazin", url: "https://www.motorsport-magazin.com/formel1/news.xml" },
  { name: "Google News F1", url: "https://news.google.com/rss/search?q=Formel+1+News&hl=de&gl=DE&ceid=DE:de" },
] as const;

type NewsItem = {
  headline: string;
  link: string;
  timestamp: number;
  source: string;
};

type CacheRow = {
  payload: NewsItem[] | null;
  source_status: Record<string, unknown> | null;
  refreshed_at: string;
};

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://racevora.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null, cacheState = "MISS") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=3600",
      "X-RaceVora-News-Cache": cacheState,
    },
  });
}

function normalizeText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function elementText(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return normalizeText(match?.[1] || "");
}

function safeHttpUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function parseFeed(xml: string, source: string): NewsItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return blocks.slice(0, MAX_ITEMS_PER_SOURCE).map((block) => {
    const headline = elementText(block, "title");
    const link = safeHttpUrl(elementText(block, "link"));
    const pubDate = elementText(block, "pubDate") || elementText(block, "published") || elementText(block, "updated");
    const parsedTime = pubDate ? Date.parse(pubDate) : 0;
    return {
      headline,
      link,
      timestamp: Number.isFinite(parsedTime) ? parsedTime : 0,
      source,
    };
  }).filter((item) => item.headline && item.link);
}

async function fetchFeed(feed: typeof FEEDS[number]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
        "User-Agent": "RaceVora-F1-News/1.0 (+https://racevora.com)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error("feed_too_large");
    return { items: parseFeed(text, feed.name), status: "ok" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { items: [] as NewsItem[], status: message.slice(0, 120) || "fetch_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeAndSort(items: NewsItem[]) {
  const seen = new Set<string>();
  return items
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .filter((item) => {
      const key = item.headline.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_RESPONSE_ITEMS);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "origin_not_allowed" }, 403, origin);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: "server_configuration_incomplete" }, 503, origin);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let cached: CacheRow | null = null;
  const cachedQuery = await admin
    .from("f1_news_cache")
    .select("payload, source_status, refreshed_at")
    .eq("cache_key", CACHE_KEY)
    .maybeSingle();
  if (!cachedQuery.error && cachedQuery.data) cached = cachedQuery.data as CacheRow;

  const cachedAgeMs = cached?.refreshed_at ? Date.now() - Date.parse(cached.refreshed_at) : Number.POSITIVE_INFINITY;
  const cachedItems = Array.isArray(cached?.payload) ? cached.payload.filter(Boolean) : [];
  if (cachedItems.length && cachedAgeMs <= CACHE_TTL_MS) {
    return json({ items: cachedItems, refreshedAt: cached?.refreshed_at, stale: false }, 200, origin, "HIT");
  }

  const results = await Promise.all(FEEDS.map((feed) => fetchFeed(feed)));
  const sourceStatus = Object.fromEntries(FEEDS.map((feed, index) => [feed.name, results[index].status]));
  const freshItems = dedupeAndSort(results.flatMap((result) => result.items));

  if (freshItems.length) {
    const refreshedAt = new Date().toISOString();
    const { error: upsertError } = await admin.from("f1_news_cache").upsert({
      cache_key: CACHE_KEY,
      payload: freshItems,
      source_status: sourceStatus,
      refreshed_at: refreshedAt,
    }, { onConflict: "cache_key" });
    if (upsertError) console.error("f1 news cache upsert failed", upsertError.message);
    return json({ items: freshItems, refreshedAt, stale: false }, 200, origin, "MISS");
  }

  if (cachedItems.length && cachedAgeMs <= STALE_MAX_MS) {
    return json({ items: cachedItems, refreshedAt: cached?.refreshed_at, stale: true }, 200, origin, "STALE");
  }

  return json({ items: [], refreshedAt: null, stale: true, sources: sourceStatus }, 502, origin, "EMPTY");
});
