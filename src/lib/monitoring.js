import * as Sentry from "@sentry/react";

// Error monitoring.
//
// The email alerts (docs/JOB-ALERTS.md) only see one class of problem: a database write that
// was rejected. Everything else that can break for a user in the workshop — a JS exception
// white-screening a view, a chunk that 404s after a deploy, the PDF import throwing, an
// unhandled promise rejection — was previously invisible unless someone phoned to complain.
// That is the gap this closes.
//
// Inert unless VITE_SENTRY_DSN is set, so demo mode, the Playwright suites and any local
// build stay completely offline. Never make this a hard dependency of the app booting.

const DSN = import.meta.env.VITE_SENTRY_DSN;

export const monitoringEnabled = Boolean(DSN);

export function initMonitoring() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    // Vercel exposes the commit SHA; tying errors to a release is what makes "this started
    // after Tuesday's deploy" answerable instead of guesswork.
    release: import.meta.env.VITE_COMMIT_SHA || undefined,
    environment: import.meta.env.MODE,
    // No performance tracing and no session replay: this is a ~10 user internal tool and the
    // free tier is better spent on errors than on traces nobody will read.
    tracesSampleRate: 0,
    // Breadcrumbs are the valuable part — the click trail that led to the crash.
    maxBreadcrumbs: 50,
    ignoreErrors: [
      // A stale tab hitting a chunk that no longer exists is already handled by
      // RouteErrorBoundary, which reloads once. Reporting it is noise.
      /Failed to fetch dynamically imported module/i,
      /Importing a module script failed/i,
      // Browser extensions and network blips we cannot act on.
      /ResizeObserver loop/i,
      /Non-Error promise rejection captured/i,
    ],
    beforeSend(event) {
      // Never ship anything that could carry a credential. Supabase keys and JWTs can end up
      // in a URL or a fetch breadcrumb, and an error report is not the place for them.
      const scrub = (value) =>
        typeof value === "string"
          ? value
              .replace(/sb_(secret|publishable)_[A-Za-z0-9_-]+/g, "sb_[redacted]")
              .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt redacted]")
              .replace(/(apikey|access_token|refresh_token)=[^&\s]+/gi, "$1=[redacted]")
          : value;

      if (event.request?.url) event.request.url = scrub(event.request.url);
      event.breadcrumbs = event.breadcrumbs?.map((crumb) => ({
        ...crumb,
        message: scrub(crumb.message),
        data: crumb.data ? { ...crumb.data, url: scrub(crumb.data.url) } : crumb.data,
      }));
      return event;
    },
  });
}

// Tie errors to a person. This is an internal tool with named staff, so knowing an error only
// affects one account — or everyone — is worth more than the anonymity.
export function identifyUser(user) {
  if (!DSN) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, email: user.email, username: user.name });
}

// A rejected database write. Not a JS exception, so it never reaches Sentry on its own — but
// it is exactly the class of failure that went unnoticed for hours on 29 Jul 2026, and having
// it searchable alongside everything else is the point of having one place to look.
export function captureWriteFailure({ action, jobLabel, result, user }) {
  if (!DSN) return;
  Sentry.withScope((scope) => {
    scope.setLevel(result?.retryable ? "warning" : "error");
    scope.setTag("failure_kind", "supabase_write");
    scope.setTag("pg_code", result?.error?.code || "unknown");
    scope.setTag("write_action", action || "write");
    scope.setContext("write", {
      action,
      jobLabel,
      message: result?.message,
      retryable: result?.retryable,
      user,
    });
    // Group by Postgres code rather than by message, so a hundred instances of the same
    // constraint violation are one issue and not a hundred.
    scope.setFingerprint(["supabase-write", action || "write", result?.error?.code || "unknown"]);
    Sentry.captureMessage(`Write rejected (${result?.error?.code || "unknown"}): ${result?.message || ""}`);
  });
}

// A failed auth attempt (sign-in, sign-up, password reset, invite onboarding).
//
// These are caught in try/catch and shown as a message, so they NEVER reach Sentry on their
// own — which is why the sign-up email-quota outage on 30 Jul 2026 was invisible until a user
// sent a screenshot. Reported explicitly here instead.
//
// Deliberately NOT reported: wrong password, unconfirmed email, an email already registered.
// Those are normal user error, they happen constantly, and burying the real signal under them
// is how an alerting channel becomes worthless.
const EXPECTED_AUTH_ERRORS = /invalid login credentials|email not confirmed|already registered|password should be at least|enter your email/i;

export function captureAuthFailure({ action, err, email }) {
  if (!DSN || !err) return;
  const message = err.message || String(err);
  if (EXPECTED_AUTH_ERRORS.test(message)) return;

  Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTag("failure_kind", "auth");
    scope.setTag("auth_action", action);
    scope.setTag("auth_code", err.code || err.status || "unknown");
    // The login page is pre-auth, so there is no user context — carry the domain (not the
    // full address) so you can tell staff attempts from strangers without storing addresses.
    scope.setContext("auth", { action, domain: String(email || "").split("@")[1] || "none", message });
    scope.setFingerprint(["auth", action, err.code || err.status || "unknown"]);
    Sentry.captureMessage(`Auth ${action} failed: ${message}`);
  });
}

export { Sentry };
