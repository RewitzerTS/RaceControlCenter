import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CACHE_KEY = "racevora-f1-news-v1";
const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4000;
const MAX_ITEMS_PER_SOURCE = 8;
const MAX_RESPONSE_ITEMS = 16;
const MAX_FEED_BYTES = 2_000_000;

const ALLOWED_ORIGINS = new Set([
  "https://racevora.com",
  "https://www.racevora.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const FEEDS = [
  { name: "Motorsport.com DE", url: "https://de.motorsport.com/rss/f1/news/" },
  { name: "Motorsport-Total", url: "https://www.motorsport-total.com/rss/rss_formel-1.xml" },
  { name: "Sportschau Formel 1", url: "https://www.sportschau.de/motorsport/formel1/index~rss2.xml" },
  { name: "Autosport", url: "https://www.autosport.com/rss/f1/news/" },
] as const;

type NewsItem = {
  headline: string;
  link: string;
  timestamp: number;
  source: string;
};

type SourceStatus = {
  ok: boolean;
  httpStatus?: number;
  contentType?: string;
  bytes?: number;
  parsedItems: number;
  format?: string;
  finalUrl?: string;
  error?: string;
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
  return String(value || "")
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
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
  return normalizeText(match?.[1] || "");
}

function elementHref(block: string, tag = "link") {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escapedTag}\\b[^>]*\\bhref=["']([^"']+)["'][^>]*>`, "i"));
  return normalizeText(match?.[1] || "");
}

function safeHttpUrl(raw: string) {
  try {
    const url = new URL(String(raw || "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function parseFeed(xml: string, source: string) {
  const rssBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const atomBlocks = rssBlocks.length ? [] : (xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || []);
  const blocks = rssBlocks.length ? rssBlocks : atomBlocks;
  const format = rssBlocks.length ? "rss" : atomBlocks.length ? "atom" : "unknown";

  const items = blocks.slice(0, MAX_ITEMS_PER_SOURCE).map((block) => {
    const headline = elementText(block, "title");
    const link = safeHttpUrl(elementText(block, "link"))
      || safeHttpUrl(elementHref(block, "link"))
      || safeHttpUrl(elementText(block, "guid"));
    const pubDate = elementText(block, "pubDate")
      || elementText(block, "published")
      || elementText(block, "updated")
      || elementText(block, "dc:date");
    const parsedTime = pubDate ? Date.parse(pubDate) : 0;
    return {
      headline,
      link,
      timestamp: Number.isFinite(parsedTime) ? parsedTime : 0,
      source,
    } satisfies NewsItem;
  }).filter((item) => item.headline && item.link);

  return { items, format, blockCount: blocks.length };
}

async function fetchFeed(feed: typeof FEEDS[number]): Promise<{ items: NewsItem[]; status: SourceStatus }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
        "User-Agent": "RaceVora-F1-News/3.0 (+https://racevora.com)",
      },
    });

    const contentType = String(response.headers.get("content-type") || "").slice(0, 120);
    if (!response.ok) {
      return {
        items: [],
        status: {
          ok: false,
          httpStatus: response.status,
          contentType,
          parsedItems: 0,
          finalUrl: response.url,
          error: `HTTP ${response.status}`,
        },
      };
    }

    const text = await response.text();
    if (text.length > MAX_FEED_BYTES) {
      return {
        items: [],
        status: {
          ok: false,
          httpStatus: response.status,
          contentType,
          bytes: text.length,
          parsedItems: 0,
          finalUrl: response.url,
          error: "feed_too_large",
        },
      };
    }

    const parsed = parseFeed(text, feed.name);
    return {
      items: parsed.items,
      status: {
        ok: parsed.items.length > 0,
        httpStatus: response.status,
        contentType,
        bytes: text.length,
        parsedItems: parsed.items.length,
        format: parsed.format,
        finalUrl: response.url,
        ...(parsed.items.length ? {} : { error: parsed.blockCount ? "no_valid_items" : "no_feed_entries" }),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      items: [],
      status: {
        ok: false,
        parsedItems: 0,
        error: message.slice(0, 160) || "fetch_failed",
      },
    };
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

  for (const [source, status] of Object.entries(sourceStatus)) {
    console.info("f1 news source", source, JSON.stringify(status));
  }

  if (freshItems.length) {
    const refreshedAt = new Date().toISOString();
    const { error: upsertError } = await admin.from("f1_news_cache").upsert({
      cache_key: CACHE_KEY,
      payload: freshItems,
      source_status: sourceStatus,
      refreshed_at: refreshedAt,
    }, { onConflict: "cache_key" });
    if (upsertError) console.error("f1 news cache upsert failed", upsertError.message);
    return json({ items: freshItems, refreshedAt, stale: false, sources: sourceStatus }, 200, origin, "MISS");
  }

  if (cachedItems.length && cachedAgeMs <= STALE_MAX_MS) {
    await admin.from("f1_news_cache")
      .update({ source_status: sourceStatus })
      .eq("cache_key", CACHE_KEY);
    return json({ items: cachedItems, refreshedAt: cached?.refreshed_at, stale: true, sources: sourceStatus }, 200, origin, "STALE");
  }

  const attemptedAt = new Date().toISOString();
  await admin.from("f1_news_cache").upsert({
    cache_key: CACHE_KEY,
    payload: [],
    source_status: sourceStatus,
    refreshed_at: attemptedAt,
  }, { onConflict: "cache_key" });

  return json({ items: [], refreshedAt: null, stale: true, sources: sourceStatus }, 502, origin, "EMPTY");
});