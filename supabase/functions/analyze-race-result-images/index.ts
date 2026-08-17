import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rcc-league-slug",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeLeagueSlug(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    race_name: { type: ["string", "null"] },
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          position: { type: ["integer", "null"] },
          driver: { type: "string" },
          team: { type: ["string", "null"] },
          grid_position: { type: ["integer", "null"] },
          pit_stops: { type: ["integer", "null"] },
          fastest_lap: { type: ["string", "null"] },
          race_time: { type: ["string", "null"] },
          confidence: { type: "number" }
        },
        required: ["position", "driver", "team", "grid_position", "pit_stops", "fastest_lap", "race_time", "confidence"]
      }
    },
    warnings: { type: "array", items: { type: "string" } }
  },
  required: ["race_name", "rows", "warnings"]
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const startedAt = Date.now();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const requestedSlug = normalizeLeagueSlug(req.headers.get("x-rcc-league-slug"));

    if (!authHeader) return json({ error: "unauthorized", message: "Keine gültige Sitzung." }, 401);
    if (!requestedSlug) return json({ error: "missing_league_context", message: "Der Liga-Kontext fehlt." }, 400);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
          "x-rcc-league-slug": requestedSlug,
        },
      },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const actor = userData?.user;
    if (userError || !actor?.id) return json({ error: "unauthorized", message: "Keine gültige Sitzung." }, 401);

    const { data: league, error: leagueError } = await userClient
      .from("leagues")
      .select("id, slug")
      .eq("slug", requestedSlug)
      .maybeSingle();
    if (leagueError) throw leagueError;
    if (!league?.id) return json({ error: "forbidden", message: "Kein Zugriff auf diese Liga." }, 403);

    const [membershipResponse, platformOwnerResponse] = await Promise.all([
      userClient
        .from("league_members")
        .select("role")
        .eq("league_id", league.id)
        .eq("user_id", actor.id)
        .maybeSingle(),
      userClient.rpc("is_platform_owner"),
    ]);

    if (membershipResponse.error) throw membershipResponse.error;
    if (platformOwnerResponse.error) throw platformOwnerResponse.error;

    const role = String(membershipResponse.data?.role || "").toLowerCase();
    const allowed = platformOwnerResponse.data === true || ["owner", "admin"].includes(role);
    if (!allowed) {
      return json({
        error: "forbidden",
        message: "Nur Ligaleitung oder Plattform-Owner dürfen die KI-Ergebnisanalyse verwenden.",
      }, 403);
    }

    // Only resolve the paid OpenAI credential after authentication, tenant and
    // role authorization have all succeeded.
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return json({ error: "OPENAI_API_KEY is not configured for this Edge Function." }, 503);
    }

    const body = await req.json();
    const images = Array.isArray(body?.images) ? body.images.filter((x: unknown) => typeof x === "string") : [];
    if (!images.length || images.length > 8) return json({ error: "Bitte 1 bis 8 Ergebnisbilder senden." }, 400);

    // Every successful quota reservation is counted before the paid OpenAI call.
    // This intentionally also counts downstream failures so repeated retries cannot
    // be used to bypass the cost cap.
    const { data: quota, error: quotaError } = await userClient.rpc("consume_ai_analysis_quota", {
      p_league_id: league.id,
      p_image_count: images.length,
    });
    if (quotaError) throw quotaError;
    if (!quota?.allowed) {
      return json({
        error: "rate_limited",
        message: "Das KI-Analyse-Limit ist erreicht. Bitte versuche es später erneut.",
        scope: quota?.scope || "unknown",
        retry_after_seconds: Number(quota?.retry_after_seconds || 600),
      }, 429);
    }

    const knownDrivers = Array.isArray(body?.drivers) ? body.drivers.slice(0, 40) : [];
    const raceName = typeof body?.race_name === "string" ? body.race_name : "";
    const model = "gpt-4.1-mini";
    const driverReference = knownDrivers
      .map((d: any) => {
        const identities = [d.gamertag, d.ai_driver_reference, d.display_name].filter(Boolean);
        const identityText = [...new Set(identities)].join(" / ");
        const team = typeof d.team === "string" && d.team.trim() ? ` → Team: ${d.team.trim()}` : "";
        return identityText ? `${identityText}${team}` : "";
      })
      .filter(Boolean)
      .join(", ");

    const instruction = [
      "Extrahiere die sichtbare Rennergebnis-Tabelle aus F1-Spiel-Screenshots für RaceVora.",
      "Lies nur sichtbare Werte. Nichts erfinden.",
      "Jede Ergebniszeile hat semantisch diese getrennten Spalten: position | driver | team | grid_position | pit_stops | fastest_lap | race_time.",
      "Nutze die räumliche Ausrichtung und sichtbaren Spaltenüberschriften des Screenshots, nicht nur die Reihenfolge einzelner OCR-Wörter.",
      "Fahrer exakt so ausgeben, wie er im Screenshot steht. Gamertag und KI-Fahrername nicht miteinander vertauschen.",
      "team ist ausschließlich der sichtbare Team-/Konstrukteursname. Lange Teamnamen vollständig zusammenhalten, auch mit Leerzeichen, Bindestrichen oder mehreren Wörtern.",
      "Beispiele für EINEN vollständigen Teamnamen sind: 'Visa Cash App Racing Bulls' und 'Mercedes-AMG Petronas'. Eine direkt danach stehende Zahl gehört zur nächsten numerischen Spalte und NIEMALS zum Teamnamen.",
      "Wenn ein Teamname visuell über mehrere Textfragmente oder Zeilen umbricht, die Fragmente zum Teamnamen zusammenführen. Grid-/Stopps-Zahlen dabei strikt getrennt lassen.",
      "Wenn der Teamname nicht sichtbar oder nicht sicher lesbar ist, team = null statt einen Teamnamen zu erfinden.",
      "position = Zielposition; grid_position = Startposition; pit_stops = Boxenstopps. Diese Zahlen niemals an Fahrer- oder Teamnamen anhängen.",
      "fastest_lap ist eine echte Rundenzeit: falls sichtbar immer als mm:ss,mmm ausgeben. Dezimalpunkt in Komma umwandeln. Wenn keine schnellste Runde sichtbar ist, null ausgeben.",
      "race_time ist entweder eine Zeit/ein Zeitabstand ODER sichtbarer Rennstatus. Zeiten immer als mm:ss,mmm ausgeben; Dezimalpunkt in Komma umwandeln; einstellige Minuten auf zwei Stellen auffüllen; Stunden in Gesamtminuten umrechnen, z.B. 1:02:03.456 -> 62:03,456.",
      "Bei sichtbaren Zeitabständen Vorzeichen beibehalten und ebenfalls mm:ss,mmm verwenden, z.B. +5.123 -> +00:05,123.",
      "Wenn im race_time-Feld statt einer Zeit ein Status steht, diesen Status übernehmen, z.B. DNF, DNS, DSQ, DNQ, RET oder + 1 Runde / + 2 Runden. Solchen Text NICHT in eine Zeit umwandeln.",
      "Mehrere Screenshots können überlappende Teile derselben Tabelle zeigen: Duplikate zusammenführen.",
      "Prüfe vor der Ausgabe jede Zeile nochmals spaltenweise: Fahrer enthält keine Grid-Zahl; Team enthält keine Grid-/Stopps-Zahl; Grid und Stopps sind eigenständige Integer.",
      "confidence zwischen 0 und 1. Unsicherheiten zusätzlich in warnings nennen.",
      raceName ? `Ausgewähltes Rennen: ${raceName}.` : "",
      driverReference ? `Bekannte RaceVora-Fahrerzuordnungen (Gamertag / KI-Fahrer / Anzeigename → Team) nur als Zuordnungshilfe, nicht zum Erfinden unsichtbarer Werte: ${driverReference}.` : ""
    ].filter(Boolean).join("\n");

    const content: any[] = [{ type: "input_text", text: instruction }];
    for (const image of images) content.push({ type: "input_image", image_url: image, detail: "auto" });

    const openAiStartedAt = Date.now();
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content }],
        max_output_tokens: 3500,
        text: {
          format: {
            type: "json_schema",
            name: "racevora_race_results",
            strict: true,
            schema
          }
        }
      })
    });

    const raw = await response.json();
    const openAiMs = Date.now() - openAiStartedAt;
    console.log(JSON.stringify({
      event: "race_image_analysis",
      model,
      league_slug: requestedSlug,
      actor_id: actor.id,
      images: images.length,
      quota_remaining_image_units: Number(quota?.remaining_image_units ?? -1),
      openai_ms: openAiMs,
      total_ms: Date.now() - startedAt,
      status: response.status,
    }));

    if (!response.ok) {
      return json({ error: raw?.error?.message || "OpenAI request failed", details: raw?.error || null }, response.status);
    }

    const outputText = raw?.output
      ?.flatMap((item: any) => item?.content || [])
      .find((item: any) => item?.type === "output_text")?.text || raw?.output_text || "";
    if (!outputText) throw new Error("Die KI hat keine auswertbaren Ergebnisdaten zurückgegeben.");

    return json(JSON.parse(outputText));
  } catch (error) {
    console.error(JSON.stringify({
      event: "race_image_analysis_error",
      total_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }));
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});