import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

function referenceFor(date: Date) {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  const random = crypto.getRandomValues(new Uint8Array(6));
  const suffix = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `RV-WD-${day}-${suffix}`;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: "Server configuration incomplete" }, 503, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400, origin);
  }

  if (clean(body.website, 200)) return json({ ok: true }, 200, origin);

  const consumerName = clean(body.consumer_name, 160);
  const contractIdentifier = clean(body.contract_identifier, 240);
  const confirmationEmail = clean(body.confirmation_email, 320).toLowerCase();
  const confirmed = body.confirmed === true;

  if (consumerName.length < 2) return json({ error: "Bitte gib deinen vollständigen Namen an." }, 400, origin);
  if (contractIdentifier.length < 3) return json({ error: "Bitte gib eine Vertrags- oder Accountkennung an." }, 400, origin);
  if (!isEmail(confirmationEmail)) return json({ error: "Bitte gib eine gültige E-Mail-Adresse an." }, 400, origin);
  if (!confirmed) return json({ error: "Der Widerruf wurde nicht bestätigt." }, 400, origin);

  const submittedAt = new Date();
  const statement = `Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über die Nutzung von RaceVora. Name: ${consumerName}. Vertrags-/Accountkennung: ${contractIdentifier}. Bestätigung an: ${confirmationEmail}.`;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let record: Record<string, unknown> | null = null;
  let insertError: unknown = null;
  for (let attempt = 0; attempt < 3 && !record; attempt += 1) {
    const reference = referenceFor(submittedAt);
    const response = await supabase
      .from("consumer_withdrawals")
      .insert({
        reference,
        consumer_name: consumerName,
        contract_identifier: contractIdentifier,
        confirmation_email: confirmationEmail,
        statement,
        submitted_at: submittedAt.toISOString(),
      })
      .select("id, reference, statement, submitted_at")
      .single();
    if (!response.error) record = response.data as Record<string, unknown>;
    else insertError = response.error;
  }

  if (!record) {
    console.error("consumer withdrawal insert failed", insertError);
    return json({ error: "Der Widerruf konnte nicht gespeichert werden. Bitte versuche es erneut oder schreibe an kontakt@racevora.com." }, 500, origin);
  }

  const reference = String(record.reference);
  const submittedIso = String(record.submitted_at);
  return json({
    ok: true,
    reference,
    submitted_at: submittedIso,
    statement,
    confirmation_email: confirmationEmail,
    confirmation_sent: false,
    confirmation_error_code: "email_sending_paused",
    confirmation_error: "Der E-Mail-Versand ist vorübergehend pausiert. Dein Widerruf wurde gespeichert; bitte lade den Eingangsbeleg herunter.",
    receipt: {
      operator: "Richard Rewitzer / RaceVora",
      address: "Hohenzollernstr. 9, 72622 Nürtingen, Deutschland",
      reference,
      consumer_name: consumerName,
      contract_identifier: contractIdentifier,
      confirmation_email: confirmationEmail,
      submitted_at: submittedIso,
      statement,
    },
  }, 200, origin);
});
