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

function safeRedirect(raw: unknown, req: Request) {
  if (!raw) return undefined;
  try {
    const target = new URL(String(raw));
    const origin = req.headers.get("Origin");
    const local = target.hostname === "localhost" || target.hostname === "127.0.0.1";
    if (target.protocol !== "https:" && !local) return undefined;
    if (origin && target.origin !== origin) return undefined;
    if (!target.pathname.endsWith("/set-password.html") && !target.pathname.endsWith("set-password.html")) return undefined;
    return target.toString();
  } catch {
    return undefined;
  }
}

async function findUserByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  let page = 1;
  const perPage = 1000;
  while (page <= 100) {
    const { data: usersPage, error: listError } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (listError) throw listError;
    const user = usersPage.users.find((candidate) => String(candidate.email || "").toLowerCase() === email) || null;
    if (user || usersPage.users.length < perPage) return user;
    page += 1;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const actor = userData?.user;
    if (userError || !actor?.id) return json({ error: "unauthorized", message: "Keine gültige Sitzung." }, 401);

    const payload = await req.json().catch(() => ({}));
    const leagueId = String(payload?.leagueId || "").trim();
    const email = String(payload?.email || "").trim().toLowerCase();
    const role = String(payload?.role || "member").trim().toLowerCase();
    const action = String(payload?.action || "add").trim().toLowerCase();

    if (!leagueId || !email || !email.includes("@")) {
      return json({ error: "invalid_input", message: "Bitte gültige Liga und E-Mail angeben." }, 400);
    }
    if (!["add", "check"].includes(action)) {
      return json({ error: "invalid_action", message: "Ungültige Aktion." }, 400);
    }
    if (action === "add" && !["owner", "admin", "member"].includes(role)) {
      return json({ error: "invalid_role", message: "Ungültige Rolle." }, 400);
    }

    const { data: platformOwnerRow, error: platformOwnerError } = await adminClient
      .from("platform_owners")
      .select("user_id")
      .eq("user_id", actor.id)
      .maybeSingle();
    if (platformOwnerError) throw platformOwnerError;
    const platformOwner = Boolean(platformOwnerRow);

    const { data: actorMembership, error: membershipError } = await adminClient
      .from("league_members")
      .select("role")
      .eq("league_id", leagueId)
      .eq("user_id", actor.id)
      .maybeSingle();
    if (membershipError) throw membershipError;

    const canManage = platformOwner || Boolean(actorMembership && ["owner", "admin"].includes(actorMembership.role));
    if (!canManage) return json({ error: "forbidden", message: "Keine Berechtigung für diese Liga." }, 403);
    if (action === "add" && role === "owner" && !platformOwner) {
      return json({ error: "only_platform_owner_can_add_owner", message: "Nur der Plattform-Owner kann Owner vergeben." }, 403);
    }

    let targetUser = await findUserByEmail(adminClient, email);

    if (action === "check") {
      if (!targetUser?.id) {
        return json({ ok: true, accountExists: false, alreadyMember: false });
      }
      const { data: targetMembership, error: targetMembershipError } = await adminClient
        .from("league_members")
        .select("role")
        .eq("league_id", leagueId)
        .eq("user_id", targetUser.id)
        .maybeSingle();
      if (targetMembershipError) throw targetMembershipError;
      return json({
        ok: true,
        accountExists: true,
        alreadyMember: Boolean(targetMembership),
        currentRole: targetMembership?.role || null,
      });
    }

    let invited = false;
    const accountExisted = Boolean(targetUser);
    if (!targetUser) {
      const redirectTo = safeRedirect(payload?.redirectTo, req);
      if (payload?.redirectTo && !redirectTo) {
        return json({ error: "invalid_redirect", message: "Die Einladungs-Zieladresse ist nicht zulässig." }, 400);
      }

      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { invited_to_league_id: leagueId },
      });
      if (inviteError) {
        const message = String(inviteError.message || "");
        const status = Number((inviteError as { status?: number })?.status || 0);
        if (status === 429 || /rate limit/i.test(message)) {
          return json({
            error: "email_rate_limit_exceeded",
            message: "Das E-Mail-Limit von Supabase ist aktuell erreicht. Bitte später erneut versuchen oder eigenes SMTP konfigurieren.",
          }, 429);
        }
        throw inviteError;
      }
      targetUser = inviteData.user;
      invited = true;
    }

    if (!targetUser?.id) return json({ error: "user_resolution_failed", message: "Benutzer konnte nicht aufgelöst werden." }, 500);

    const { data: existingTargetMembership, error: existingTargetError } = await adminClient
      .from("league_members")
      .select("role")
      .eq("league_id", leagueId)
      .eq("user_id", targetUser.id)
      .maybeSingle();
    if (existingTargetError) throw existingTargetError;

    // service_role bypasses RLS. Mirror the database owner-protection rule here
    // so a league admin cannot demote/replace an existing owner by email.
    if (existingTargetMembership?.role === "owner" && !platformOwner) {
      return json({
        error: "only_platform_owner_can_modify_owner",
        message: "Nur der Plattform-Owner kann bestehende Owner ändern.",
      }, 403);
    }

    const { error: upsertError } = await adminClient
      .from("league_members")
      .upsert({ league_id: leagueId, user_id: targetUser.id, role }, { onConflict: "league_id,user_id" });
    if (upsertError) throw upsertError;

    return json({ ok: true, invited, accountExisted, member: { userId: targetUser.id, email, role } });
  } catch (error) {
    console.error(error);
    return json({ error: "internal_error", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
