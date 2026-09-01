import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const allowedOrigins = new Set([
  "https://racevora.com",
  "https://www.racevora.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
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

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "service_unavailable" }, 503, origin);
  }

  const authorization = request.headers.get("Authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return json({ error: "authentication_required" }, 401, origin);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  const user = userData.user;
  if (userError || !user?.id || !user.email) return json({ error: "authentication_required" }, 401, origin);

  let payload: { confirmation_email?: unknown } = {};
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400, origin);
  }

  const confirmationEmail = typeof payload.confirmation_email === "string" ? payload.confirmation_email.trim().toLowerCase() : "";
  if (!confirmationEmail || confirmationEmail !== user.email.trim().toLowerCase()) {
    return json({ error: "confirmation_mismatch" }, 400, origin);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: preparationError } = await adminClient.rpc("prepare_self_account_deletion", { p_user_id: user.id });
  if (preparationError) {
    console.error("Account deletion preparation failed", preparationError.code);
    return json({ error: "deletion_failed" }, 500, origin);
  }

  // Supabase soft deletion is irreversible and anonymizes the Auth account while
  // keeping the stable UUID required by immutable racing and stewarding history.
  const { error: deletionError } = await adminClient.auth.admin.deleteUser(user.id, true);
  if (deletionError) {
    console.error("Auth account deletion failed", deletionError.name);
    return json({ error: "deletion_failed" }, 500, origin);
  }

  return json({ deleted: true }, 200, origin);
});
