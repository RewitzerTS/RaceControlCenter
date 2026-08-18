import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const PAUSE_MESSAGE = "Der RaceVora-E-Mail-Versand ist vorübergehend pausiert. Die Registrierung wird erst fortgesetzt, wenn der Versand wieder freigegeben ist.";

const allowedOrigins = new Set([
  "https://racevora.com",
  "https://www.racevora.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : "https://racevora.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "origin_not_allowed" }, 403, origin);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "server_configuration_incomplete" }, 503, origin);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized", message: "Keine gültige Sitzung." }, 401, origin);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user?.id) return json({ error: "unauthorized", message: "Keine gültige Sitzung." }, 401, origin);

  return json({
    error: "email_sending_paused",
    message: PAUSE_MESSAGE,
    retryable: true,
  }, 503, origin);
});
