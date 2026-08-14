// Supabase Edge Function: invite a new staff member by email (admin-only).
//
// Called from the app via supabase.functions.invoke("invite-user", { body: { email, name, role } }), where role is
// one of admin | staff | technician.
// Uses the service-role key to send Supabase's built-in invite email — the recipient clicks
// the link, lands on <APP_URL>/invite, and sets a password (no separate email verification,
// since the invite already proves the address). Token expiry + single-use are handled by
// Supabase's invite links natively.
//
// Required function secrets (supabase secrets set ...):
//   APP_URL                    — deployed app origin, e.g. https://flexachem-workshop-tracker.vercel.app
//   SUPABASE_URL               — provided automatically in the Edge runtime
//   SUPABASE_ANON_KEY          — provided automatically in the Edge runtime
//   SUPABASE_SERVICE_ROLE_KEY  — provided automatically in the Edge runtime
//
// Prerequisites (Dashboard, not code): configure SMTP under Authentication → Emails (the
// default sender is rate-limited to a few/hour) and add <APP_URL>/invite to the Auth
// Redirect URLs allowlist.
//
// Deploy: supabase functions deploy invite-user
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES = ["admin", "staff", "technician"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const APP_URL = Deno.env.get("APP_URL") || "";

  // 1. Identify the caller from their JWT and confirm they are an active admin.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return json({ error: "not authenticated" }, 401);

  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "not authenticated" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: account } = await admin
    .from("accounts")
    .select("role, active")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!account || account.role !== "admin" || account.active === false) {
    return json({ error: "admin only" }, 403);
  }

  // 2. Validate input.
  let body: { email?: string; name?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  // Three roles, whitelisted. `technician` is the Service & Assembly team: assignable to jobs
  // and given an availability calendar. `staff` is sales/managers — signs in, not assignable.
  // Anything unrecognised falls back to `staff`, never `technician`: a malformed request must
  // not be able to grant assignability. The Add-person form always sends an explicit role and
  // defaults to technician, which is where the "usual case" is expressed instead.
  const role = ROLES.includes(String(body.role)) ? String(body.role) : "staff";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "invalid email" }, 400);

  // 3. Send the invite. Metadata drives handle_new_user (name/role/onboarded=false).
  const redirectTo = APP_URL ? `${APP_URL.replace(/\/$/, "")}/invite` : undefined;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name, role, invited: true },
    redirectTo,
  });
  if (error) return json({ error: error.message }, 400);

  // 4. Belt-and-braces: ensure the account carries the chosen role even if the trigger raced.
  if (data?.user?.id) {
    await admin.from("accounts").update({ role, onboarded: false }).eq("id", data.user.id);
  }

  return json({ ok: true, userId: data?.user?.id || null });
});
