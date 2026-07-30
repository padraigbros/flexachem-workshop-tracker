// Supabase Edge Function: email an alert when a job is created, or when a write fails.
//
// Two callers, distinguished by the `source` field in the body:
//
//   source: "db_trigger"  — the AFTER INSERT trigger on public.jobs (see
//                           supabase/alerts-setup.sql). Fires on EVERY created job,
//                           including ones made outside the app.
//   source: "client"      — the app reporting a write it made that the database
//                           rejected. A failed insert leaves no row behind, so the
//                           database cannot detect this on its own.
//
// AUTH: deployed with --no-verify-jwt, because the platform's built-in check expects a JWT
// and this project uses the newer sb_publishable_/sb_secret_ key format, which are not JWTs.
// Rather than depend on how the gateway treats those, the function authorises callers itself:
//
//   - the database trigger sends `x-alert-secret`, matched against ALERT_WEBHOOK_SECRET
//   - the app sends the signed-in user's JWT, which is verified against auth
//
// A request with neither is rejected. Without this, the trigger's call could be silently
// refused and success emails would simply never arrive — a broken feature that looks like a
// quiet one.
//
// Required function secrets (supabase secrets set ...):
//   RESEND_API_KEY        — from resend.com. Free tier: 100 emails/day, 3,000/month.
//   ALERT_EMAIL_TO        — where alerts go, e.g. padraigbrosnan@gmail.com
//   ALERT_WEBHOOK_SECRET  — any long random string; also stored in Vault for the trigger
//   ALERT_EMAIL_FROM — optional. Defaults to Resend's shared sender, which can only
//                      deliver to the address that owns the Resend account. Set this to
//                      something on a verified domain to send anywhere.
//   APP_URL          — optional, for deep links in the email.
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — provided by the Edge runtime.
//
// Deploy: supabase functions deploy notify-job-event
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Per-job emails were chosen deliberately, but a retry loop or a bulk import could turn
// that into hundreds of messages. Above this many alerts in the trailing hour we log and
// stop sending, then send ONE notice that we have gone quiet. Failures are capped
// separately and more generously — those are the ones worth reading.
const HOURLY_CAP = { created: 25, failed: 40 };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmail(subject: string, html: string): Promise<string | null> {
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("ALERT_EMAIL_TO");
  if (!key || !to) return "RESEND_API_KEY or ALERT_EMAIL_TO is not set";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("ALERT_EMAIL_FROM") || "Flexachem Tracker <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) return `Resend returned ${res.status}: ${(await res.text()).slice(0, 300)}`;
  return null;
}

function createdEmail(job: Record<string, unknown>, appUrl: string) {
  const label = String(job.asm || `#${job.id}`);
  const link = appUrl ? `${appUrl.replace(/\/$/, "")}/schedule?job=${encodeURIComponent(String(job.id))}` : "";
  const rows: Array<[string, unknown]> = [
    ["Assembly", job.asm], ["Sales order", job.so], ["Customer", job.cust],
    ["Job type", job.type], ["Assigned to", job.alloc], ["Due", job.due_date],
    ["Status", job.status],
  ];
  return {
    subject: `Job created: ${label}${job.cust ? ` — ${job.cust}` : ""}`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px">
        <p style="font-size:15px;margin:0 0 14px">
          <strong style="color:#15803d">&#10003; Saved to the database.</strong>
        </p>
        <table style="border-collapse:collapse;font-size:14px">
          ${rows.filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => `<tr>
              <td style="padding:3px 14px 3px 0;color:#64748b">${esc(k)}</td>
              <td style="padding:3px 0"><strong>${esc(v)}</strong></td>
            </tr>`).join("")}
        </table>
        ${link ? `<p style="margin:16px 0 0"><a href="${esc(link)}" style="font-size:14px">Open this job</a></p>` : ""}
      </div>`,
  };
}

function failedEmail(payload: Record<string, unknown>) {
  const label = String(payload.jobLabel || "a job");
  const retryable = payload.retryable === true;
  return {
    subject: `NOT SAVED: ${payload.action || "change"} to ${label}`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px">
        <p style="font-size:15px;margin:0 0 12px">
          <strong style="color:#b91c1c">&#9888; A change did not reach the database.</strong>
        </p>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:3px 14px 3px 0;color:#64748b">What</td><td style="padding:3px 0"><strong>${esc(payload.action || "write")}</strong></td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#64748b">Job</td><td style="padding:3px 0"><strong>${esc(label)}</strong></td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#64748b">User</td><td style="padding:3px 0">${esc(payload.user || "unknown")}</td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#64748b">Postgres code</td><td style="padding:3px 0"><code>${esc(payload.code || "—")}</code></td></tr>
        </table>
        <p style="font-size:14px;background:#fef2f2;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;margin:14px 0">
          ${esc(payload.message)}
        </p>
        <p style="font-size:13px;color:#64748b;margin:0">
          ${retryable
            ? "This looks transient — the user was shown a Reload option and their work was kept on screen."
            : "<strong>This will not fix itself.</strong> It is a schema, constraint or permission problem: retrying cannot succeed until the database is changed."}
        </p>
      </div>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "body must be JSON" }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // --- authorise the caller (see the header note) ---------------------------
  const sharedSecret = Deno.env.get("ALERT_WEBHOOK_SECRET") || "";
  const presented = req.headers.get("x-alert-secret") || "";
  let authorised = Boolean(sharedSecret) && presented === sharedSecret;

  if (!authorised) {
    // Fall back to a signed-in user (the client-reported failure path).
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token) {
      const { data } = await admin.auth.getUser(token);
      authorised = Boolean(data?.user);
    }
  }
  if (!authorised) return json({ error: "not authorised" }, 401);

  const kind = body.kind === "failed" ? "failed" : "created";

  // Rate cap. Count what we have already emailed in the trailing hour for this kind.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("job_alerts")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("emailed", true)
    .gte("created_at", since);

  const sentThisHour = count ?? 0;
  const cap = HOURLY_CAP[kind];
  const job = (body.job || {}) as Record<string, unknown>;
  const label = kind === "created"
    ? String(job.asm || `#${job.id ?? "?"}`)
    : String(body.jobLabel || "unknown");
  const detail = kind === "created" ? String(job.cust ?? "") : String(body.message ?? "");

  if (sentThisHour >= cap) {
    await admin.from("job_alerts").insert({ kind, job_label: label, detail, emailed: false, suppressed: true });
    // Announce the cap exactly once, on the alert that crosses it.
    if (sentThisHour === cap) {
      await sendEmail(
        `Flexachem alerts paused — over ${cap} ${kind} emails this hour`,
        `<div style="font-family:system-ui,sans-serif">
           <p>More than ${cap} "${kind}" alerts fired in the last hour, so further emails are
           being held back to avoid flooding your inbox. Nothing is lost — every alert is still
           recorded in the <code>job_alerts</code> table.</p>
           <p>Alerts resume automatically once the rate drops.</p>
         </div>`,
      );
    }
    return json({ ok: true, suppressed: true });
  }

  const { subject, html } = kind === "created"
    ? createdEmail(job, Deno.env.get("APP_URL") || "")
    : failedEmail(body);

  const error = await sendEmail(subject, html);
  await admin.from("job_alerts").insert({
    kind,
    job_label: label,
    detail: error ? `${detail} [email failed: ${error}]` : detail,
    emailed: !error,
  });

  // A 200 even when the email failed: the caller is a database trigger or a
  // fire-and-forget client call, and neither can do anything useful with a 500.
  // The failure is recorded in job_alerts.detail instead.
  return json({ ok: !error, emailError: error });
});
