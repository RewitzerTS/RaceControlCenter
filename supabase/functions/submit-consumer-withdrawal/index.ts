import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FROM_EMAIL = Deno.env.get("RACEVORA_WITHDRAWAL_FROM") || "RaceVora <widerruf@racevora.com>";
const OPERATOR_EMAIL = Deno.env.get("RACEVORA_CONTACT_EMAIL") || "kontakt@racevora.com";

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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char] || char));
}

function referenceFor(date: Date) {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  const random = crypto.getRandomValues(new Uint8Array(6));
  const suffix = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `RV-WD-${day}-${suffix}`;
}

async function sendResendEmail(payload: Record<string, unknown>) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

  let lastError = "Unknown email error";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return data;
      lastError = `Resend ${response.status}: ${JSON.stringify(data)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
  }
  throw new Error(lastError);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Server configuration incomplete" }, 503, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400, origin);
  }

  // Invisible honeypot. Real users never fill this field.
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
  const receivedIso = String(record.submitted_at);
  const received = new Date(receivedIso);
  const receivedGerman = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
    timeStyle: "long",
    timeZone: "Europe/Berlin",
  }).format(received);

  const safeName = escapeHtml(consumerName);
  const safeContract = escapeHtml(contractIdentifier);
  const safeReference = escapeHtml(reference);
  const safeStatement = escapeHtml(statement);
  const confirmationHtml = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033;line-height:1.55">
      <h1 style="font-size:24px">Eingangsbestätigung deines Widerrufs</h1>
      <p>Hallo ${safeName},</p>
      <p>deine Widerrufserklärung ist bei RaceVora eingegangen.</p>
      <table style="border-collapse:collapse;width:100%;margin:20px 0">
        <tr><td style="padding:8px;border:1px solid #dce3ec"><strong>Referenz</strong></td><td style="padding:8px;border:1px solid #dce3ec">${safeReference}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dce3ec"><strong>Name</strong></td><td style="padding:8px;border:1px solid #dce3ec">${safeName}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dce3ec"><strong>Vertrags-/Accountkennung</strong></td><td style="padding:8px;border:1px solid #dce3ec">${safeContract}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dce3ec"><strong>Eingang</strong></td><td style="padding:8px;border:1px solid #dce3ec">${escapeHtml(receivedGerman)} (${escapeHtml(receivedIso)})</td></tr>
      </table>
      <p><strong>Inhalt deiner Widerrufserklärung:</strong></p>
      <p style="padding:14px;background:#f5f7fa;border-radius:8px">${safeStatement}</p>
      <p>Diese Nachricht bestätigt den Eingang deiner Erklärung. Bewahre sie als Nachweis auf.</p>
      <p>RaceVora · Richard Rewitzer<br>Hohenzollernstr. 9 · 72622 Nürtingen<br><a href="mailto:kontakt@racevora.com">kontakt@racevora.com</a></p>
    </div>`;

  let confirmationSent = false;
  let providerId = "";
  let emailError = "";

  try {
    const emailResult = await sendResendEmail({
      from: FROM_EMAIL,
      to: [confirmationEmail],
      reply_to: OPERATOR_EMAIL,
      subject: `RaceVora · Eingangsbestätigung Widerruf ${reference}`,
      html: confirmationHtml,
      text: `Eingangsbestätigung deines Widerrufs\n\nReferenz: ${reference}\nName: ${consumerName}\nVertrags-/Accountkennung: ${contractIdentifier}\nEingang: ${receivedGerman} (${receivedIso})\n\n${statement}\n\nRaceVora · Richard Rewitzer · kontakt@racevora.com`,
    });
    providerId = String((emailResult as Record<string, unknown>)?.id || "");
    confirmationSent = true;
    await supabase.from("consumer_withdrawals").update({
      confirmation_sent_at: new Date().toISOString(),
      confirmation_provider_id: providerId || null,
    }).eq("id", record.id);
  } catch (error) {
    emailError = error instanceof Error ? error.message : String(error);
    console.error("withdrawal confirmation email failed", emailError);
  }

  // Operator copy is operational only. A failure must never invalidate the consumer's withdrawal.
  if (confirmationSent) {
    try {
      await sendResendEmail({
        from: FROM_EMAIL,
        to: [OPERATOR_EMAIL],
        reply_to: confirmationEmail,
        subject: `RaceVora · Neuer Widerruf ${reference}`,
        html: `<p><strong>Neuer Widerruf</strong></p><p>Referenz: ${safeReference}<br>Name: ${safeName}<br>Vertrags-/Accountkennung: ${safeContract}<br>Eingang: ${escapeHtml(receivedGerman)}</p><p>${safeStatement}</p>`,
        text: `Neuer RaceVora-Widerruf\nReferenz: ${reference}\nName: ${consumerName}\nVertrags-/Accountkennung: ${contractIdentifier}\nEingang: ${receivedGerman}\n${statement}`,
      });
      await supabase.from("consumer_withdrawals").update({ operator_notification_sent_at: new Date().toISOString() }).eq("id", record.id);
    } catch (error) {
      console.error("withdrawal operator notification failed", error);
    }
  }

  return json({
    ok: true,
    reference,
    submitted_at: receivedIso,
    statement,
    confirmation_email: confirmationEmail,
    confirmation_sent: confirmationSent,
    confirmation_error: confirmationSent ? null : "Die Widerrufserklärung wurde gespeichert, aber die E-Mail-Bestätigung konnte noch nicht versendet werden.",
    receipt: {
      operator: "Richard Rewitzer / RaceVora",
      address: "Hohenzollernstr. 9, 72622 Nürtingen, Deutschland",
      reference,
      consumer_name: consumerName,
      contract_identifier: contractIdentifier,
      confirmation_email: confirmationEmail,
      submitted_at: receivedIso,
      statement,
    },
  }, confirmationSent ? 200 : 202, origin);
});
