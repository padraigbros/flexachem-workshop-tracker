# Monitoring

Three layers, each catching what the others can't.

| Layer | Catches | Where you look |
|---|---|---|
| **Sentry** | JS exceptions, crashed views, PDF import errors, unhandled rejections, rejected writes | sentry.io dashboard |
| **Email alerts** | Job created; a write the database rejected | Your inbox — see [JOB-ALERTS.md](JOB-ALERTS.md) |
| **In-app banner** | A write this user just made that didn't save | The user's screen, immediately |

The banner tells the person at the keyboard. The email tells you. Sentry tells you *why*, with
a stack trace and the click trail that led there.

---

## Sentry setup

Wiring is done and committed. It is **inert until `VITE_SENTRY_DSN` is set** — demo mode, the
Playwright suites and local builds all stay completely offline. Three steps to turn it on:

### 1. Create the project

1. Sign up at [sentry.io](https://sentry.io) — free tier is 5,000 errors/month, far more than
   this app will produce.
2. **Create Project → React**. Name it `flexachem-workshop-tracker`.
3. Copy the **DSN** (looks like `https://abc123@o12345.ingest.sentry.io/678910`).

The DSN is not a secret — it only allows *sending* events, and it ships in the client bundle
by design. Unlike the API keys, it does not need guarding.

### 2. Add it to Vercel

**Vercel → Project → Settings → Environment Variables**:

| Name | Value | Environments |
|---|---|---|
| `VITE_SENTRY_DSN` | your DSN | Production, Preview |

Optionally also `VITE_COMMIT_SHA` = `$VERCEL_GIT_COMMIT_SHA`, which tags every error with the
release that produced it — that's what makes "this started after Tuesday's deploy" answerable
rather than guesswork.

Redeploy for it to take effect. Vite inlines env vars at build time, so an existing build
won't pick it up.

### 3. Confirm it works

Open the deployed app and run this in the browser console:

```js
window.dispatchEvent(new ErrorEvent("error", { error: new Error("Sentry smoke test") }));
```

An issue should appear in Sentry within a minute or so. If nothing arrives, check that the
build actually had the variable (`VITE_SENTRY_DSN` must be present at **build** time, not just
runtime).

---

## What is deliberately switched off

- **Performance tracing** (`tracesSampleRate: 0`) — this is a ~10-user internal tool. The free
  quota is better spent on errors than on traces nobody will read.
- **Session replay** — same reasoning, plus it records the screen, which is a bigger privacy
  question than an internal tool needs to take on.

Both are one-line changes in `src/lib/monitoring.js` if that ever changes.

## What is filtered out

Stale-chunk errors (`Failed to fetch dynamically imported module`) are ignored. They happen
when a tab is open across a deploy, `RouteErrorBoundary` already reloads once and recovers, and
reporting them would bury real problems. If one *survives* the reload, that's a genuine crash
and it does get reported — see the `stale_chunk` tag.

## Privacy

`identifyUser()` attaches id, email and name to each report, so you can tell whether an error
hit everyone or one account. Appropriate for an internal tool with named staff; if that ever
changes, it's one function in `monitoring.js`.

`beforeSend` scrubs Supabase keys (`sb_secret_…`, `sb_publishable_…`), JWTs, and
`apikey`/`access_token`/`refresh_token` query parameters from URLs and breadcrumbs. An error
report is not a place for credentials to leak — and given how easily keys ended up in
screenshots during the 29 Jul incident, this is worth having.

## Rejected writes appear in both places

`captureWriteFailure()` sends every rejected database write to Sentry as well as raising the
email. They're grouped by Postgres error code rather than message, so a hundred instances of
the same constraint violation are **one** issue with a count, not a hundred separate ones.

Tags to filter on: `failure_kind:supabase_write`, `pg_code:23502`, `write_action:create`.

## The remaining gap

Nothing currently detects **"the site is down entirely"** — if Vercel fails to serve the app,
there is no JS running to report it. [UptimeRobot](https://uptimerobot.com) (free) pinging the
production URL every 5 minutes closes that, and takes about two minutes to set up.
