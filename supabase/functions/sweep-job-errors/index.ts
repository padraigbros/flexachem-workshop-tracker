// Supabase Edge Function: sweep the Postgres logs for write errors nobody reported.
//
// The second net. notify-job-event covers the two normal cases:
//   - a job saved     -> the AFTER INSERT trigger fires
//   - a write failed  -> the app reports it
//
// Neither covers a failure where the browser dies before it can report: the tab is closed,
// the laptop sleeps, JS throws first. Nothing is left behind except a line in the Postgres
// log. On 29 Jul 2026 those lines sat there for hours with nobody looking. This looks.
//
// Runs on a schedule (see docs/JOB-ALERTS.md). Queries the Management API for error-severity
// Postgres events in the trailing window, ignores anything already covered by an alert in
// job_alerts, and emails whatever is left.
//
// Required function secrets:
//   SUPABASE_MGMT_TOKEN   — personal access token, supabase.com/dashboard/account/tokens
//   SUPABASE_PROJECT_REF  — e.g. pxekejsjwxlrnaufmjxo
//   RESEND_API_KEY, ALERT_EMAIL_TO  — as for notify-job-event
//   SWEEP_WINDOW_MINUTES  — optional, default 60. Match this to your cron interval.
//
// Deploy: supabase functions deploy sweep-job-errors
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function esc(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Postgres error codes worth waking someone for. These are the "a write was rejected"
// classes — 23xxx integrity violations and 42501 insufficient privilege. Deliberately narrow:
// a sweep that cries wolf gets muted, and then it is worth nothing.
const INTERESTING = /\b(23502|23503|23505|23514|42501|42703|42P01)\b/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const token = Deno.env.get("SUPABASE_MGMT_TOKEN");
  const ref = Deno.env.get("SUPABASE_PROJECT_REF");
  if (!token || !ref) return json({ error: "SUPABASE_MGMT_TOKEN / SUPABASE_PROJECT_REF not set" }, 500);

  const windowMinutes = Number(Deno.env.get("SWEEP_WINDOW_MINUTES") || 60);
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  // The analytics endpoint takes a BigQuery-flavoured SQL string over the log stream.
  const sql = `
    select cast(timestamp as string) as ts, event_message
    from postgres_logs
    where cast(timestamp as string) >= '${since.toISOString()}'
    order by timestamp desc
    limit 200
  `.replace(/\s+/g, " ").trim();

  const url = `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    return json({ error: `Management API ${res.status}: ${(await res.text()).slice(0, 300)}` }, 502);
  }

  const payload = await res.json();
  const rows: Array<{ ts?: string; event_message?: string }> = payload.result || [];
  const hits = rows.filter((r) => INTERESTING.test(r.event_message || ""));
  if (!hits.length) return json({ ok: true, checked: rows.length, found: 0 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Skip anything the app already told us about in the same window — otherwise every
  // client-reported failure would arrive twice, and duplicate alerts train you to ignore them.
  const { count: alreadyReported } = await admin
    .from("job_alerts")
    .select("id", { count: "exact", head: true })
    .eq("kind", "failed")
    .gte("created_at", since.toISOString());

  if ((alreadyReported ?? 0) >= hits.length) {
    return json({ ok: true, checked: rows.length, found: hits.length, suppressed: "already reported by the app" });
  }

  const unreported = hits.length - (alreadyReported ?? 0);
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("ALERT_EMAIL_TO");
  if (key && to) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("ALERT_EMAIL_FROM") || "Flexachem Tracker <onboarding@resend.dev>",
        to: [to],
        subject: `${unreported} unreported database error${unreported === 1 ? "" : "s"} in the last ${windowMinutes} min`,
        html: `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px">
            <p style="font-size:15px"><strong style="color:#b91c1c">&#9888;
            ${unreported} write error${unreported === 1 ? "" : "s"} the app never reported.</strong></p>
            <p style="font-size:13px;color:#64748b">Usually means a browser closed before it could
            tell anyone. Raw log lines:</p>
            <pre style="font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;padding:10px;
            border-radius:8px;overflow-x:auto;white-space:pre-wrap">${hits.slice(0, 10)
              .map((h) => esc(`${h.ts}  ${h.event_message}`)).join("\n\n")}</pre>
          </div>`,
      }),
    }).catch(() => {});
  }

  await admin.from("job_alerts").insert({
    kind: "failed",
    job_label: "(log sweep)",
    detail: `${unreported} unreported error(s): ${hits[0]?.event_message?.slice(0, 200) ?? ""}`,
    emailed: Boolean(key && to),
  });

  return json({ ok: true, checked: rows.length, found: hits.length, unreported });
});
