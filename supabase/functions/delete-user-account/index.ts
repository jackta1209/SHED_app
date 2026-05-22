// Securely deletes the authenticated user's Supabase Auth user, then cleans up
// any user-owned rows not covered by ON DELETE CASCADE. The service role key
// never leaves this server-side function.
//
// Ordering rationale (fixes M-7): we MUST delete the Auth user first. If we
// wiped app rows first and auth.admin.deleteUser then failed, the user would
// remain signed-in with their data already gone — an unrecoverable half-state.
//
// FK cascade coverage (verified):
//   profiles, user_settings, practice_sessions, practice_categories,
//   repertoire_items, journal_entries, session_exit_attempts
// NOT covered (manual post-delete cleanup required):
//   ai_usage_events, practice_tool_usage
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Missing auth" });
    }

    // Derive user id ONLY from the verified JWT — never from request body.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json(401, { error: "Invalid session" });
    }
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Delete the Auth user first. ON DELETE CASCADE on FK constraints to
    //    auth.users(id) automatically removes rows from profiles,
    //    user_settings, practice_sessions, practice_categories,
    //    repertoire_items, journal_entries, and session_exit_attempts.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("auth.admin.deleteUser failed:", delErr.message);
      return json(500, {
        error: "Failed to delete account. No data was removed. Please try again.",
      });
    }

    // 2) Manual cleanup for tables without a FK cascade to auth.users.
    const orphanTables = ["ai_usage_events", "practice_tool_usage"];
    const failures: string[] = [];
    for (const t of orphanTables) {
      const { error } = await admin.from(t).delete().eq("user_id", userId);
      if (error) {
        console.error(`Post-delete cleanup of ${t} failed:`, error.message);
        failures.push(t);
      }
    }
    if (failures.length > 0) {
      return json(200, {
        ok: true,
        warning: `Account deleted, but residual rows remain in: ${failures.join(", ")}.`,
      });
    }

    return json(200, { ok: true });
  } catch (e) {
    console.error("delete-user-account unexpected error:", e);
    return json(500, { error: "Account deletion failed. Please try again." });
  }
});
