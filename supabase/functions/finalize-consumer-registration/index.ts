import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("RACEVORA_CONTRACT_FROM") || "RaceVora <noreply@racevora.com>";
const CONTACT_EMAIL = Deno.env.get("RACEVORA_CONTACT_EMAIL") || "kontakt@racevora.com";
const SUPPORT_EMAIL = Deno.env.get("RACEVORA_SUPPORT_EMAIL") || "support@racevora.com";

const CONTRACT_VERSION = "racevora-beta-2026-08-17-v1";
const TERMS_VERSION = "agb-2026-08-17";
const WITHDRAWAL_VERSION = "widerruf-2026-08-17";

const META_NAME = "rcc_pending_league_name";
const META_SLUG = "rcc_pending_league_slug";
const META_PUBLIC = "rcc_pending_league_public";

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

function slugify(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
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
  return `RV-CT-${day}-${suffix}`;
}

function classifyMailError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("RESEND_API_KEY is not configured")) return "resend_secret_missing";
  if (message.includes("Resend 401") || message.includes("Resend 403")) return "resend_auth_rejected";
  if (message.includes("Resend 409")) return "resend_idempotency_conflict";
  if (message.includes("Resend 422")) return "resend_sender_rejected";
  return "resend_delivery_failed";
}

async function sendResendEmail(payload: Record<string, unknown>, idempotencyKey: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

  let lastError = "Unknown email error";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return data as Record<string, unknown>;
      lastError = `Resend ${response.status}: ${JSON.stringify(data)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
  }
  throw new Error(lastError);
}

function formatGerman(iso: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
    timeStyle: "long",
    timeZone: "Europe/Berlin",
  }).format(new Date(iso));
}

const terms: Array<[string, string]> = [
  ["1. Anbieter und Geltungsbereich", "Diese Nutzungsbedingungen gelten für die Nutzung der Webplattform RaceVora durch private und gewerbliche Nutzer. Anbieter ist Richard Rewitzer, Hohenzollernstr. 9, 72622 Nürtingen, Deutschland, E-Mail: kontakt@racevora.com."],
  ["2. Beta-Phase und Kosten", "RaceVora wird derzeit als kostenlose Beta-Version bereitgestellt. Für die aktuelle Beta werden keine Nutzungsentgelte erhoben. Ein späteres kostenpflichtiges Angebot wird nicht automatisch Bestandteil dieses kostenlosen Nutzungsverhältnisses; ein entgeltlicher Vertrag erfordert eine gesonderte Vereinbarung."],
  ["3. Registrierung und Vertragsschluss", "Für Funktionen der Ligaleitung ist ein persönlicher Account erforderlich. Das Nutzungsverhältnis kommt zustande, wenn nach Bestätigung der E-Mail-Adresse die Registrierung erfolgreich abgeschlossen, die Vertragsbestätigung versendet und der Zugang zum Liga-Onboarding bereitgestellt wird. Nutzer müssen zu den erforderlichen Erklärungen berechtigt sein; bei Minderjährigen gelten die gesetzlichen Anforderungen."],
  ["4. Leistungsumfang", "RaceVora stellt während der Beta Funktionen zur Organisation und Darstellung von Rennligen bereit. Dazu können insbesondere Liga- und Saisonverwaltung, Fahrer und Teams, Rennkalender, Ergebnisverwaltung, KI-gestützter Ergebnisimport, Stewarding, Rollen und Berechtigungen, öffentliche oder private Race-Hubs sowie Meisterschaftsauswertungen gehören. Die Beta wird fortlaufend weiterentwickelt; zwingende gesetzliche Rechte bleiben unberührt."],
  ["5. Pflichten der Nutzer", "RaceVora darf nur rechtmäßig verwendet werden. Unzulässig sind insbesondere unberechtigte Zugriffe auf fremde Accounts, Ligen oder Daten, die Umgehung von Schutzmechanismen oder Mandantentrennung, Schadsoftware oder automatisierte Angriffe sowie rechtswidrige oder Rechte Dritter verletzende Inhalte."],
  ["6. Liga-, Fahrer- und sonstige Inhalte", "Die jeweilige Ligaleitung entscheidet, welche Liga- und Renninhalte sie einträgt und veröffentlicht und muss die hierfür erforderlichen Rechte besitzen. Nutzer behalten ihre Rechte an eigenen Inhalten und räumen RaceVora für die Dauer des Nutzungsverhältnisses die technisch erforderlichen, nicht ausschließlichen Rechte zur Speicherung, Verarbeitung, Vervielfältigung und Bereitstellung innerhalb der gewählten Sichtbarkeit ein."],
  ["7. KI-Ergebnisimport", "Der KI-Ergebnisimport unterstützt die Erfassung von Rennergebnissen. KI-Ausgaben können unvollständig oder fehlerhaft sein und sind als Entwurf zu prüfen. Es dürfen nur Bilder und Daten übermittelt werden, deren Verarbeitung rechtlich zulässig und erforderlich ist."],
  ["8. Verfügbarkeit und Beta-Risiken", "RaceVora wird mit dem Ziel einer möglichst zuverlässigen Verfügbarkeit betrieben. Während der Beta können Wartungen, Fehler, Funktionsänderungen oder Unterbrechungen auftreten. Zwingende gesetzliche Rechte, insbesondere für digitale Produkte, bleiben unberührt."],
  ["9. Sperrung bei Missbrauch", "Bei konkreten Anhaltspunkten für Sicherheitsangriffe, rechtswidrige Nutzung oder erhebliche Verstöße kann ein Zugang verhältnismäßig eingeschränkt oder gesperrt werden. Gesetzliche Rechte bleiben unberührt."],
  ["10. Laufzeit und Beendigung", "Das kostenlose Beta-Nutzungsverhältnis läuft auf unbestimmte Zeit und kann vom Nutzer jederzeit ohne Einhaltung einer Frist beendet werden. Eine Nachricht an kontakt@racevora.com genügt. RaceVora kann die Beta insgesamt oder ein Nutzungsverhältnis aus sachlichem Grund beenden; soweit gesetzlich erforderlich, erfolgt eine angemessene Vorankündigung."],
  ["11. Daten nach Vertragsende", "Nach Beendigung werden personenbezogene Daten nach Maßgabe der Datenschutzerklärung und gesetzlicher Pflichten gelöscht oder anonymisiert. Gesetzliche Ansprüche auf Bereitstellung bestimmter vom Nutzer erzeugter nicht personenbezogener Inhalte bleiben unberührt."],
  ["12. Haftung", "Für Vorsatz und grobe Fahrlässigkeit sowie Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit haftet der Anbieter nach den gesetzlichen Vorschriften. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung, soweit gesetzlich zulässig, auf den vertragstypischen vorhersehbaren Schaden beschränkt. Zwingende Gewährleistungs- und Verbraucherrechte werden nicht eingeschränkt."],
  ["13. Verbraucher und Widerruf", "Verbraucher können bei einem im Fernabsatz geschlossenen Nutzungsverhältnis gesetzliche Widerrufsrechte haben. Die Widerrufsbelehrung und das Muster-Widerrufsformular sind Bestandteil dieser Vertragsbestätigung. Zusätzlich steht die elektronische Widerrufsfunktion unter https://racevora.com/widerruf.html zur Verfügung."],
  ["14. Streitbeilegung", "RaceVora ist derzeit nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."],
  ["15. Schlussbestimmungen", "Es gilt deutsches Recht unter Wahrung zwingender Verbraucherschutzvorschriften. Die Unwirksamkeit einzelner Bestimmungen lässt die übrigen gesetzlichen und vertraglichen Regelungen unberührt."],
];

function buildMail(args: {
  email: string;
  reference: string;
  contractStartedAt: string;
  leagueName: string;
  leagueSlug: string;
  isPublic: boolean;
}) {
  const { email, reference, contractStartedAt, leagueName, leagueSlug, isPublic } = args;
  const startedGerman = formatGerman(contractStartedAt);
  const visibility = isPublic ? "Öffentlich – nach Veröffentlichung sichtbar" : "Privat – nur eingeloggte Mitglieder";
  const safe = {
    email: escapeHtml(email),
    reference: escapeHtml(reference),
    started: escapeHtml(startedGerman),
    iso: escapeHtml(contractStartedAt),
    leagueName: escapeHtml(leagueName),
    leagueSlug: escapeHtml(leagueSlug),
    visibility: escapeHtml(visibility),
  };

  const termsHtml = terms.map(([title, text]) => `<h3 style="margin:22px 0 6px;font-size:16px;color:#f4f7fb">${escapeHtml(title)}</h3><p style="margin:0;color:#c4cfdb">${escapeHtml(text)}</p>`).join("");
  const termsText = terms.map(([title, text]) => `${title}\n${text}`).join("\n\n");

  const withdrawalText = `WIDERRUFSBELEHRUNG\n\nWiderrufsrecht\nWenn du Verbraucher bist und das Nutzungsverhältnis im Fernabsatz abschließt, hast du grundsätzlich das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.\n\nUm dein Widerrufsrecht auszuüben, musst du Richard Rewitzer, Hohenzollernstr. 9, 72622 Nürtingen, Deutschland, E-Mail: kontakt@racevora.com, mittels einer eindeutigen Erklärung über deinen Entschluss informieren. Zur Wahrung der Frist reicht es aus, dass du die Erklärung vor Ablauf der Widerrufsfrist absendest. Du kannst außerdem die elektronische Widerrufsfunktion unter https://racevora.com/widerruf.html nutzen.\n\nFolgen des Widerrufs\nDa die aktuelle RaceVora-Beta kostenlos angeboten wird, sind grundsätzlich keine Nutzungsentgelte zurückzuzahlen. Nach wirksamem Widerruf wird das Nutzungsverhältnis beendet. Personenbezogene Daten werden anschließend nach der Datenschutzerklärung und den gesetzlichen Vorgaben behandelt.\n\nMUSTER-WIDERRUFSFORMULAR\n(Wenn du den Vertrag widerrufen willst, kannst du dieses Formular verwenden.)\nAn: Richard Rewitzer, Hohenzollernstr. 9, 72622 Nürtingen, Deutschland, E-Mail: kontakt@racevora.com\nHiermit widerrufe ich den von mir abgeschlossenen Vertrag über die Nutzung der RaceVora Beta.\nAbgeschlossen am: ____________________\nName des Verbrauchers: ____________________\nAnschrift des Verbrauchers: ____________________\nUnterschrift des Verbrauchers (nur bei Mitteilung auf Papier): ____________________\nDatum: ____________________`;

  const infoText = `VERTRAGSINFORMATIONEN\n\nProdukt: RaceVora – kostenlose Beta der webbasierten Race Management Platform\nPreis: 0,00 EUR. Keine wiederkehrenden Nutzungsentgelte in der aktuellen Beta.\nVertragsreferenz: ${reference}\nAccount: ${email}\nLiga: ${leagueName}\nLiga-URL: https://racevora.com/?league=${encodeURIComponent(leagueSlug)}\nStartsichtbarkeit: ${visibility}\nVertragsbeginn: ${startedGerman} (${contractStartedAt})\nLaufzeit: unbefristet\nKündigung: jederzeit ohne Frist per E-Mail an ${CONTACT_EMAIL}\nSupport/Beschwerden: ${SUPPORT_EMAIL} oder ${CONTACT_EMAIL}\nVertragssprache: Deutsch\nTechnische Voraussetzungen: aktueller Webbrowser mit JavaScript, Internetzugang und E-Mail-Zugang für Authentifizierung. Es ist keine besondere Hardware erforderlich.\nFunktionalität/Kompatibilität: browserbasierte Verwaltung von Rennligen; die konkrete Funktionsausstattung ergibt sich aus dem Leistungsumfang der Beta. Schutzmechanismen umfassen insbesondere Anmeldung, Rollen/Berechtigungen und Mandantentrennung.\nGesetzliche Mängelrechte: Gesetzliche Rechte bei Mängeln digitaler Produkte bleiben unberührt.\nWeitere Kosten/Sicherheiten: RaceVora erhebt für die aktuelle Beta keine zusätzlichen Nutzungsentgelte, verlangt keine Kaution und keine sonstige finanzielle Sicherheit. Übliche Kosten deines Internet-/E-Mail-Anbieters bleiben unberührt.\nMindestlaufzeit: keine.\nAutomatisierte personalisierte Preisbildung: keine.\nVerhaltenskodex/Garantie: kein besonderer Verhaltenskodex und keine zusätzliche Garantie über gesetzliche Rechte hinaus.\nDatenschutzinformationen: https://racevora.com/datenschutz.html`;

  const html = `<!doctype html><html><body style="margin:0;background:#07111f;color:#eaf0f6;font-family:Arial,sans-serif"><div style="max-width:720px;margin:0 auto;padding:32px 20px"><div style="padding:28px;border:1px solid #24364b;border-radius:18px;background:#0c1827"><p style="margin:0 0 6px;color:#77e0d1;font-weight:700;letter-spacing:.08em">RACEVORA</p><h1 style="margin:0 0 12px;font-size:28px;color:#fff">Deine Vertragsbestätigung</h1><p style="margin:0;color:#c4cfdb">Diese E-Mail bestätigt den Abschluss deiner kostenlosen RaceVora-Beta-Registrierung und enthält die Vertragsinformationen in dauerhaft speicherbarer Form. Bitte bewahre sie auf.</p>
  <table style="width:100%;border-collapse:collapse;margin:24px 0;color:#eaf0f6"><tr><td style="padding:8px;border:1px solid #24364b"><strong>Referenz</strong></td><td style="padding:8px;border:1px solid #24364b">${safe.reference}</td></tr><tr><td style="padding:8px;border:1px solid #24364b"><strong>Account</strong></td><td style="padding:8px;border:1px solid #24364b">${safe.email}</td></tr><tr><td style="padding:8px;border:1px solid #24364b"><strong>Rennliga</strong></td><td style="padding:8px;border:1px solid #24364b">${safe.leagueName} (${safe.leagueSlug})</td></tr><tr><td style="padding:8px;border:1px solid #24364b"><strong>Startsichtbarkeit</strong></td><td style="padding:8px;border:1px solid #24364b">${safe.visibility}</td></tr><tr><td style="padding:8px;border:1px solid #24364b"><strong>Preis</strong></td><td style="padding:8px;border:1px solid #24364b">0,00 EUR · kostenlose Beta</td></tr><tr><td style="padding:8px;border:1px solid #24364b"><strong>Vertragsbeginn</strong></td><td style="padding:8px;border:1px solid #24364b">${safe.started} (${safe.iso})</td></tr><tr><td style="padding:8px;border:1px solid #24364b"><strong>Laufzeit</strong></td><td style="padding:8px;border:1px solid #24364b">Unbefristet · jederzeit ohne Frist kündbar</td></tr></table>
  <h2 style="margin:30px 0 10px;color:#fff;font-size:21px">Wesentliche Vertragsinformationen</h2><p style="color:#c4cfdb"><strong>Produkt:</strong> RaceVora – kostenlose Beta der webbasierten Race Management Platform.<br><strong>Support/Beschwerden:</strong> <a style="color:#77e0d1" href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a> oder <a style="color:#77e0d1" href="mailto:${escapeHtml(CONTACT_EMAIL)}">${escapeHtml(CONTACT_EMAIL)}</a>.<br><strong>Technische Voraussetzungen:</strong> aktueller Webbrowser mit JavaScript, Internetzugang und E-Mail-Zugang. Keine besondere Hardware erforderlich.<br><strong>Gesetzliche Mängelrechte:</strong> Gesetzliche Rechte bei Mängeln digitaler Produkte bleiben unberührt.<br><strong>Weitere Kosten:</strong> keine RaceVora-Nutzungsentgelte, keine Kaution, keine Mindestlaufzeit; nur gegebenenfalls übliche Kosten deines Internet-/E-Mail-Anbieters.<br><strong>Vertragssprache:</strong> Deutsch.</p>
  <h2 style="margin:30px 0 8px;color:#fff;font-size:21px">Allgemeine Nutzungsbedingungen · Stand 17. August 2026</h2>${termsHtml}
  <h2 style="margin:30px 0 8px;color:#fff;font-size:21px">Widerrufsbelehrung</h2><p style="color:#c4cfdb">Wenn du Verbraucher bist und das Nutzungsverhältnis im Fernabsatz abschließt, hast du grundsätzlich das Recht, binnen vierzehn Tagen ab Vertragsabschluss ohne Angabe von Gründen zu widerrufen. Informiere hierzu Richard Rewitzer, Hohenzollernstr. 9, 72622 Nürtingen, Deutschland, E-Mail <a style="color:#77e0d1" href="mailto:${escapeHtml(CONTACT_EMAIL)}">${escapeHtml(CONTACT_EMAIL)}</a>, mittels einer eindeutigen Erklärung. Zur Fristwahrung genügt die rechtzeitige Absendung. Du kannst auch die <a style="color:#77e0d1" href="https://racevora.com/widerruf.html">elektronische Widerrufsfunktion</a> verwenden.</p><p style="color:#c4cfdb"><strong>Folgen:</strong> Da die Beta kostenlos ist, sind grundsätzlich keine Nutzungsentgelte zurückzuzahlen. Nach wirksamem Widerruf wird das Nutzungsverhältnis beendet; personenbezogene Daten werden anschließend nach Datenschutzerklärung und Gesetz behandelt.</p>
  <h3 style="margin:22px 0 6px;color:#fff">Muster-Widerrufsformular</h3><div style="padding:16px;border:1px solid #24364b;border-radius:12px;color:#c4cfdb">Wenn du den Vertrag widerrufen willst, kannst du dieses Formular verwenden.<br><br>An: Richard Rewitzer, Hohenzollernstr. 9, 72622 Nürtingen, Deutschland, E-Mail: ${escapeHtml(CONTACT_EMAIL)}<br><br>Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über die Nutzung der RaceVora Beta.<br><br>Abgeschlossen am: ____________________<br>Name des Verbrauchers: ____________________<br>Anschrift des Verbrauchers: ____________________<br>Unterschrift (nur bei Mitteilung auf Papier): ____________________<br>Datum: ____________________</div>
  <h2 style="margin:30px 0 8px;color:#fff;font-size:21px">Anbieter</h2><p style="color:#c4cfdb">Richard Rewitzer<br>Hohenzollernstr. 9<br>72622 Nürtingen<br>Deutschland<br><a style="color:#77e0d1" href="mailto:${escapeHtml(CONTACT_EMAIL)}">${escapeHtml(CONTACT_EMAIL)}</a></p><p style="margin-top:28px;color:#8295aa;font-size:13px">Aktuelle Online-Fassungen: <a style="color:#77e0d1" href="https://racevora.com/agb.html">AGB</a> · <a style="color:#77e0d1" href="https://racevora.com/widerruf.html">Widerruf</a> · <a style="color:#77e0d1" href="https://racevora.com/datenschutz.html">Datenschutz</a>. Maßgeblich für diese Bestätigung ist der in dieser E-Mail wiedergegebene Vertragsstand.</p></div></div></body></html>`;

  const text = `RaceVora – Deine Vertragsbestätigung\n\nDiese E-Mail bestätigt den Abschluss deiner kostenlosen RaceVora-Beta-Registrierung. Bitte bewahre sie auf.\n\n${infoText}\n\nALLGEMEINE NUTZUNGSBEDINGUNGEN · STAND 17. AUGUST 2026\n\n${termsText}\n\n${withdrawalText}\n\nANBIETER\nRichard Rewitzer\nHohenzollernstr. 9\n72622 Nürtingen\nDeutschland\n${CONTACT_EMAIL}\n\nAktuelle Online-Fassungen: https://racevora.com/agb.html · https://racevora.com/widerruf.html · https://racevora.com/datenschutz.html\nMaßgeblich für diese Bestätigung ist der in dieser E-Mail wiedergegebene Vertragsstand.`;

  return { html, text };
}

async function findExistingRegistrationLeague(adminClient: ReturnType<typeof createClient>, userId: string, slug: string) {
  const { data: memberships, error: membershipError } = await adminClient
    .from("league_members")
    .select("league_id, role")
    .eq("user_id", userId);
  if (membershipError) throw membershipError;
  if (!memberships?.length) return null;

  const ids = memberships.map((row) => row.league_id).filter(Boolean);
  const { data: leagues, error: leagueError } = await adminClient
    .from("leagues")
    .select("id, name, slug, is_public, created_by, created_at")
    .in("id", ids)
    .eq("slug", slug);
  if (leagueError) throw leagueError;

  const league = leagues?.[0];
  if (!league) return null;
  const membership = memberships.find((row) => row.league_id === league.id);
  return { ...league, role: membership?.role || "member" };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "origin_not_allowed" }, 403, origin);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "server_configuration_incomplete" }, 503, origin);
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized", message: "Keine gültige Sitzung." }, 401, origin);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const actor = userData?.user;
    if (userError || !actor?.id || !actor.email) return json({ error: "unauthorized", message: "Keine gültige Sitzung." }, 401, origin);
    if (!actor.email_confirmed_at) return json({ error: "email_not_confirmed", message: "Bitte bestätige zuerst deine E-Mail-Adresse." }, 409, origin);

    const payload = await req.json().catch(() => ({}));
    const leagueName = clean(payload?.leagueName, 80);
    const leagueSlug = slugify(payload?.leagueSlug);
    const isPublic = payload?.isPublic === true;

    if (leagueName.length < 3 || /[<>]/.test(leagueName)) return json({ error: "invalid_league_name", message: "Bitte gib einen gültigen Liganamen an." }, 400, origin);
    if (leagueSlug.length < 3) return json({ error: "invalid_league_slug", message: "Bitte gib eine gültige Liga-URL an." }, 400, origin);

    const metadata = actor.user_metadata || {};
    const pendingName = clean(metadata[META_NAME], 80);
    const pendingSlug = slugify(metadata[META_SLUG]);
    const pendingPublic = metadata[META_PUBLIC] === true || metadata[META_PUBLIC] === "true";
    if (pendingName !== leagueName || pendingSlug !== leagueSlug || pendingPublic !== isPublic) {
      return json({ error: "registration_metadata_mismatch", message: "Die bestätigte Registrierung passt nicht zu den begonnenen Liga-Daten." }, 409, origin);
    }

    let league = await findExistingRegistrationLeague(adminClient, actor.id, leagueSlug);
    if (league && league.created_by !== actor.id) {
      return json({ error: "existing_membership_not_registration", message: "Diese Liga-Mitgliedschaft stammt nicht aus dieser Registrierung." }, 409, origin);
    }

    if (!league) {
      const { data: createdData, error: createError } = await userClient.rpc("create_league", {
        p_name: leagueName,
        p_slug: leagueSlug,
        p_is_public: isPublic,
      });
      if (createError) throw createError;
      const created = Array.isArray(createdData) ? createdData[0] : createdData;
      if (!created?.id || !created?.slug) throw new Error("League creation returned no valid league.");
      league = {
        id: created.id,
        name: created.name,
        slug: created.slug,
        is_public: created.is_public,
        role: created.role,
        created_by: actor.id,
        created_at: new Date().toISOString(),
      };
    }

    const email = String(actor.email).trim().toLowerCase();
    const contractStartedAt = String(league.created_at || new Date().toISOString());

    let { data: confirmation, error: confirmationError } = await adminClient
      .from("contract_confirmations")
      .select("id, reference, status, confirmation_sent_at, confirmation_provider_id, send_attempts, contract_started_at, league_slug")
      .eq("user_id", actor.id)
      .eq("league_id", league.id)
      .eq("contract_version", CONTRACT_VERSION)
      .maybeSingle();
    if (confirmationError) throw confirmationError;

    if (!confirmation) {
      const insertPayload = {
        reference: referenceFor(new Date(contractStartedAt)),
        user_id: actor.id,
        league_id: league.id,
        account_email: email,
        league_name: String(league.name || leagueName),
        league_slug: String(league.slug || leagueSlug),
        price_cents: 0,
        currency: "EUR",
        contract_version: CONTRACT_VERSION,
        terms_version: TERMS_VERSION,
        withdrawal_version: WITHDRAWAL_VERSION,
        contract_started_at: contractStartedAt,
        status: "pending",
      };
      const inserted = await adminClient
        .from("contract_confirmations")
        .insert(insertPayload)
        .select("id, reference, status, confirmation_sent_at, confirmation_provider_id, send_attempts, contract_started_at, league_slug")
        .single();
      if (inserted.error) {
        if (inserted.error.code !== "23505") throw inserted.error;
        const retry = await adminClient
          .from("contract_confirmations")
          .select("id, reference, status, confirmation_sent_at, confirmation_provider_id, send_attempts, contract_started_at, league_slug")
          .eq("user_id", actor.id)
          .eq("league_id", league.id)
          .eq("contract_version", CONTRACT_VERSION)
          .single();
        if (retry.error) throw retry.error;
        confirmation = retry.data;
      } else {
        confirmation = inserted.data;
      }
    }

    if (!confirmation?.id || !confirmation.reference) throw new Error("Contract confirmation record could not be resolved.");
    if (confirmation.league_slug !== leagueSlug) return json({ error: "confirmation_scope_mismatch" }, 409, origin);

    if (confirmation.confirmation_sent_at) {
      return json({
        ok: true,
        league: { id: league.id, name: league.name, slug: league.slug, is_public: league.is_public, role: league.role },
        confirmation: { reference: confirmation.reference, sent_at: confirmation.confirmation_sent_at, already_sent: true },
      }, 200, origin);
    }

    const attempts = Number(confirmation.send_attempts || 0) + 1;
    await adminClient.from("contract_confirmations").update({
      status: "pending",
      send_attempts: attempts,
      last_error_code: null,
      updated_at: new Date().toISOString(),
    }).eq("id", confirmation.id);

    const mail = buildMail({
      email,
      reference: String(confirmation.reference),
      contractStartedAt: String(confirmation.contract_started_at || contractStartedAt),
      leagueName: String(league.name || leagueName),
      leagueSlug: String(league.slug || leagueSlug),
      isPublic: Boolean(league.is_public),
    });

    let emailResult: Record<string, unknown>;
    try {
      emailResult = await sendResendEmail({
        from: FROM_EMAIL,
        to: [email],
        reply_to: CONTACT_EMAIL,
        subject: `RaceVora · Vertragsbestätigung ${confirmation.reference}`,
        html: mail.html,
        text: mail.text,
      }, `contract-confirmation/${confirmation.reference}`);
    } catch (error) {
      const errorCode = classifyMailError(error);
      await adminClient.from("contract_confirmations").update({
        status: "failed",
        last_error_code: errorCode,
        updated_at: new Date().toISOString(),
      }).eq("id", confirmation.id);
      console.error("contract confirmation email failed", errorCode, error);
      return json({
        error: "contract_confirmation_delivery_failed",
        error_code: errorCode,
        message: "Die Rennliga wurde vorbereitet, aber die Vertragsbestätigung konnte noch nicht per E-Mail zugestellt werden. Bitte versuche es erneut.",
      }, 502, origin);
    }

    const sentAt = new Date().toISOString();
    const providerId = String(emailResult?.id || "");
    const { error: updateError } = await adminClient.from("contract_confirmations").update({
      status: "sent",
      confirmation_sent_at: sentAt,
      confirmation_provider_id: providerId || null,
      last_error_code: null,
      updated_at: sentAt,
    }).eq("id", confirmation.id);
    if (updateError) throw updateError;

    return json({
      ok: true,
      league: { id: league.id, name: league.name, slug: league.slug, is_public: league.is_public, role: league.role },
      confirmation: { reference: confirmation.reference, sent_at: sentAt, already_sent: false },
    }, 200, origin);
  } catch (error) {
    console.error("finalize consumer registration failed", error);
    const message = error instanceof Error ? error.message : String(error);
    const status = /already assigned to a league|already exists|reserved|between 3 and|invalid/i.test(message) ? 409 : 500;
    return json({ error: "registration_finalize_failed", message }, status, origin);
  }
});
