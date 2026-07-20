// Supabase Edge Function: send an Android FCM push when a notification row is inserted.
//
// Trigger: a Database Webhook (Dashboard → Database → Webhooks) on INSERT into
// public.notifications, POSTing to this function with a shared secret header.
//
// Required function secrets (supabase secrets set ...):
//   PUSH_WEBHOOK_SECRET   — matches the header the webhook sends (X-Webhook-Secret)
//   FCM_SERVICE_ACCOUNT   — the Firebase service-account JSON (as a single-line string)
//   SUPABASE_URL          — provided automatically in the Edge runtime
//   SUPABASE_SERVICE_ROLE_KEY — provided automatically in the Edge runtime
//
// Deploy: supabase functions deploy notify-push
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface NotificationRow {
  user_id: string;
  actor: string;
  job_id: string | null;
  job_label: string | null;
  excerpt: string;
}

// Mint a short-lived OAuth access token for FCM HTTP v1 from the service-account JSON.
async function getAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsigned = `${enc(header)}.${enc(claim)}`;

  const pem = serviceAccount.private_key.replace(/\\n/g, "\n");
  const der = pemToArrayBuffer(pem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`token exchange failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

Deno.serve(async (req) => {
  if (req.headers.get("X-Webhook-Secret") !== Deno.env.get("PUSH_WEBHOOK_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const record: NotificationRow | undefined = payload?.record;
  if (!record?.user_id) return new Response("no record", { status: 200 });

  const serviceAccount = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT") || "{}");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", record.user_id);
  if (!tokens?.length) return new Response("no tokens", { status: 200 });

  const accessToken = await getAccessToken(serviceAccount);
  const projectId = serviceAccount.project_id;

  await Promise.all(tokens.map(async ({ token }) => {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: record.actor ? `${record.actor} mentioned you` : "You were mentioned",
            body: record.job_label || record.excerpt || "Open Flexachem Workshop",
          },
          data: { job_id: record.job_id ? String(record.job_id) : "" },
        },
      }),
    });
    // Prune tokens FCM reports as dead so the table doesn't grow stale.
    if (res.status === 404 || res.status === 400) {
      await supabase.from("push_tokens").delete().eq("token", token);
    }
  }));

  return new Response("ok", { status: 200 });
});
