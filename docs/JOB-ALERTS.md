# Email alerts for job creation

An email to `padraigbrosnan@gmail.com` when a job is created, and when a job **fails** to be
created. Built after the 29 Jul 2026 outage, where write failures were visible only in the
Supabase logs and nobody was watching them.

## How it works

| Event | Detected by | Why that way |
|---|---|---|
| Job **created** | `AFTER INSERT` trigger on `public.jobs` → `notify-job-event` | Server-side, so it catches inserts made outside the app too, and a dying browser can't skip it. |
| Job **failed** to save | The app calls `notify-job-event` | A failed insert leaves **no row**, so the database has nothing to trigger on. Only the client knows. |
| Failure the app never reported | `sweep-job-errors`, on a schedule | Covers a browser closing mid-failure. Reads the Postgres log for `23xxx`/`42501` errors. |

Every alert is written to `public.job_alerts` whether or not the email sends — so the log is
complete even if Resend is down, and it's the source a daily digest would read if you ever
switch away from per-job emails.

**Safety:** the trigger uses `pg_net`, which queues the HTTP call and returns immediately, and
its whole body is wrapped in an exception handler. If the edge function is broken, missing or
slow, **the job still saves**. Alerting must never be able to break the thing it watches.

---

## Setup

### 1. Resend account (5 min)

1. Sign up at [resend.com](https://resend.com) using **padraigbrosnan@gmail.com**.
2. **API Keys → Create API Key**. Copy it — shown once.

You do not need to verify a domain. Resend's shared sender (`onboarding@resend.dev`) can
deliver to the address that owns the account, which is exactly this use case. Free tier is
100 emails/day, 3,000/month.

> If you later want alerts going to other people, you'll need to verify a domain and set
> `ALERT_EMAIL_FROM` to an address on it.

### 2. Function secrets

In the Supabase Dashboard: **Edge Functions → Secrets**, add:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | the key from step 1 |
| `ALERT_EMAIL_TO` | `padraigbrosnan@gmail.com` |
| `APP_URL` | `https://flexachem-workshop-tracker.vercel.app` |

For the log sweep (optional, see step 5) also add:

| Name | Value |
|---|---|
| `SUPABASE_MGMT_TOKEN` | from [account/tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_REF` | `pxekejsjwxlrnaufmjxo` |
| `SWEEP_WINDOW_MINUTES` | `60` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — don't add them.

### 3. Deploy the functions

```bash
supabase functions deploy notify-job-event
```

```bash
supabase functions deploy sweep-job-errors
```

### 4. Database side

Run **`supabase/alerts-setup.sql`** in the SQL Editor. Then register the function URL and key
so the trigger knows where to send (replace `<anon key>` with your **publishable** key — the
one already in `.env.local`, not a secret key):

```sql
select vault.create_secret(
  'https://pxekejsjwxlrnaufmjxo.supabase.co/functions/v1/notify-job-event',
  'job_alert_url'
);
```

```sql
select vault.create_secret('<anon key>', 'job_alert_key');
```

To change one later use `vault.update_secret` — re-running `create_secret` with an existing
name errors.

### 5. Schedule the sweep (optional)

**Integrations → Cron**, new job, every 15 minutes, calling the `sweep-job-errors` function.
Or in SQL:

```sql
select cron.schedule('sweep-job-errors', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://pxekejsjwxlrnaufmjxo.supabase.co/functions/v1/sweep-job-errors',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <anon key>')
  );
$$);
```

Set `SWEEP_WINDOW_MINUTES` to match the interval or you'll get duplicate reports.

---

## Verifying it works

**Success path** — create a job in the app. Email within a few seconds. Then:

```sql
select created_at, kind, job_label, emailed, suppressed, detail
from public.job_alerts order by created_at desc limit 10;
```

`emailed = true` means it sent. `emailed = false` with text in `detail` means Resend rejected
it — the reason is in there.

**Failure path** — safest way to force one without breaking anything real:

```sql
alter table public.jobs add constraint tmp_alert_test check (asm <> 'ALERTTEST');
```

Create a job with assembly `ALERTTEST`. You should get the red banner in the app *and* a
"NOT SAVED" email. Then remove it:

```sql
alter table public.jobs drop constraint tmp_alert_test;
```

---

## Volume, and the honest caveat

Per-job success emails were a deliberate choice. At ~5–10 jobs/day that's 150–300 emails a
month. The risk is real: once you start filtering them, the **failure** emails get filtered
too, and you're back to the situation that made the outage invisible for hours.

Two protections are built in:

- **Rate cap.** Above 25 `created` or 40 `failed` emails in a trailing hour, sending pauses and
  you get one "alerts paused" notice. Nothing is lost — everything still lands in
  `job_alerts`. Sending resumes automatically.
- **Failure emails look nothing like success emails.** Different subject prefix
  (`NOT SAVED:`), red styling, and they state whether a retry can possibly help. Filter on the
  subject, never on the sender.

**If the noise gets bad**, don't mute the sender — turn off the success half and keep failures:

```sql
alter table public.jobs disable trigger on_job_created;
```

Failure alerts are unaffected. Re-enable with `enable trigger`. A daily digest can be built
from `job_alerts` whenever you want it.
