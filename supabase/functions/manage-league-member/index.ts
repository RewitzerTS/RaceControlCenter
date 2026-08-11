import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    if (userError || !actor?.id) return json({ error: "unauthorized" }, 401);

    const payload = await req.json().catch(() => ({}));
    const leagueId = String(payload?.leagueId || "").trim();
    const email = String(payload?.email || "").trim().toLowerCase();
    const role = String(payload?.role || "member").trim().toLowerCase();

    if (!leagueId || !email || !email.includes("@")) return json({ error: "invalid_input" }, 400);
    if (!["owner", "admin", "steward", "member"].includes(role)) return json({ error: "invalid_role" }, 400);

    const { data: actorMembership, error: membershipError } = await adminClient
      .from("league_members")
      .select("role")
      .eq("league_id", leagueId)
      .eq("user_id", actor.id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!actorMembership || !["owner", "admin"].includes(actorMembership.role)) return json({ error: "forbidden" }, 403);
    if (role === "owner" && actorMembership.role !== "owner") return json({ error: "only_owner_can_add_owner" }, 403);

    let targetUser = null as { id: string; email?: string | null } | null;
    let page = 1;
    const perPage = 1000;
    while (!targetUser && page <= 100) {
      const { data: usersPage, error: listError } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (listError) throw listError;
      targetUser = usersPage.users.find((user) => String(user.email || "").toLowerCase() === email) || null;
      if (targetUser || usersPage.users.length < perPage) break;
      page += 1;
    }

    let invited = false;
    if (!targetUser) {
      const redirectTo = payload?.redirectTo ? String(payload.redirectTo) : undefined;
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { invited_to_league_id: leagueId },
      });
      if (inviteError) throw inviteError;
      targetUser = inviteData.user;
      invited = true;
    }

    if (!targetUser?.id) return json({ error: "user_resolution_failed" }, 500);

    const { error: upsertError } = await adminClient
      .from("league_members")
      .upsert({ league_id: leagueId, user_id: targetUser.id, role }, { onConflict: "league_id,user_id" });
    if (upsertError) throw upsertError;

    return json({ ok: true, invited, member: { userId: targetUser.id, email, role } });
  } catch (error) {
    console.error(error);
    return json({ error: "internal_error", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
