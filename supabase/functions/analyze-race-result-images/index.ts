import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rcc-league-slug",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
          grid_position: { type: ["integer", "null"] },
          pit_stops: { type: ["integer", "null"] },
          fastest_lap: { type: ["string", "null"] },
          race_time: { type: ["string", "null"] },
          confidence: { type: "number" }
        },
        required: ["position", "driver", "grid_position", "pit_stops", "fastest_lap", "race_time", "confidence"]
      }
    },
    warnings: { type: "array", items: { type: "string" } }
  },
  required: ["race_name", "rows", "warnings"]
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const startedAt = Date.now();
  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured for this Edge Function." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const images = Array.isArray(body?.images) ? body.images.filter((x: unknown) => typeof x === "string") : [];
    if (!images.length || images.length > 8) {
      return new Response(JSON.stringify({ error: "Bitte 1 bis 8 Ergebnisbilder senden." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const knownDrivers = Array.isArray(body?.drivers) ? body.drivers.slice(0, 40) : [];
    const raceName = typeof body?.race_name === "string" ? body.race_name : "";
    const model = "gpt-4.1-mini";
    const driverReference = knownDrivers
      .map((d: any) => {
        const parts = [d.gamertag, d.ai_driver_reference, d.display_name].filter(Boolean);
        return [...new Set(parts)].join(" / ");
      })
      .filter(Boolean)
      .join(", ");

    const instruction = [
      "Extrahiere die sichtbare Rennergebnis-Tabelle aus F1-Spiel-Screenshots für Race Control Center.",
      "Lies nur sichtbare Werte. Nichts erfinden.",
      "Fahrer exakt so ausgeben, wie er im Screenshot steht. Gamertag und KI-Fahrername nicht miteinander vertauschen.",
      "position = Zielposition; grid_position = Startposition; pit_stops = Boxenstopps.",
      "fastest_lap und race_time IMMER als mm:ss,mmm ausgeben. Dezimalpunkt in Komma umwandeln. Einstellige Minuten auf zwei Stellen auffüllen. Stunden in Gesamtminuten umrechnen, z.B. 1:02:03.456 -> 62:03,456.",
      "Bei sichtbaren Zeitabständen Vorzeichen beibehalten und ebenfalls mm:ss,mmm verwenden, z.B. +5.123 -> +00:05,123.",
      "Wenn eine Zeit nicht sichtbar ist, null ausgeben.",
      "Mehrere Screenshots können überlappende Teile derselben Tabelle zeigen: Duplikate zusammenführen.",
      "Tabellenspalten strikt voneinander trennen. Zahlen aus Grid/Stopps/Zeit niemals an Fahrer- oder Teamnamen anhängen.",
      "confidence zwischen 0 und 1. Unsicherheiten zusätzlich in warnings nennen.",
      raceName ? `Ausgewähltes Rennen: ${raceName}.` : "",
      driverReference ? `Bekannte RCC Fahrerzuordnungen (Gamertag / KI-Fahrer / Anzeigename): ${driverReference}.` : ""
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
            name: "rcc_race_results",
            strict: true,
            schema
          }
        }
      })
    });

    const raw = await response.json();
    const openAiMs = Date.now() - openAiStartedAt;
    console.log(JSON.stringify({ event: "race_image_analysis", model, images: images.length, openai_ms: openAiMs, total_ms: Date.now() - startedAt, status: response.status }));

    if (!response.ok) {
      return new Response(JSON.stringify({ error: raw?.error?.message || "OpenAI request failed", details: raw?.error || null }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const outputText = raw?.output
      ?.flatMap((item: any) => item?.content || [])
      .find((item: any) => item?.type === "output_text")?.text || raw?.output_text || "";
    if (!outputText) throw new Error("Die KI hat keine auswertbaren Ergebnisdaten zurückgegeben.");

    return new Response(JSON.stringify(JSON.parse(outputText)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "race_image_analysis_error", total_ms: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) }));
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
