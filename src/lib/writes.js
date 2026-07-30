// Every Supabase write in the app funnels through here.
//
// Why this exists: on 29 Jul 2026 two jobs were created against production, appeared on the
// board, and never reached the database. The insert failed on a not-null constraint and the
// only handling was `setSyncState("error")` — no rollback, no message, no return value. The
// jobs looked saved for hours. A write that doesn't land MUST be able to say so.
//
// `runWrite` gives every caller a uniform { ok, data, error, message } so it can roll back its
// optimistic update and surface a reason the user can act on.

// Postgres/PostgREST error -> a sentence a workshop user can act on.
// Mirrors friendlyAuthError in views/LoginView.jsx.
//
// The important distinction encoded here is RETRYABLE vs NOT. A dropped connection is worth
// retrying; a schema or permission mismatch never is, and telling someone to "try again"
// when the fix is a database change is how an outage stays invisible for hours.
export function friendlyDbError(error) {
  if (!error) return "";
  const code = error.code || "";
  const msg = error.message || String(error);

  // 23502 not_null_violation — the message reads:
  //   null value in column "allocated_to" of relation "jobs" violates not-null constraint
  if (code === "23502") {
    const column = /column "([^"]+)"/.exec(msg)?.[1];
    return column
      ? `The database needs a value for "${column}" that the app doesn't send. Retrying won't help — this needs a database fix, so please tell an admin.`
      : "The database rejected this because a required value is missing. Retrying won't help — please tell an admin.";
  }
  if (code === "23505") {
    return "A record with these details already exists.";
  }
  if (code === "23503") {
    return "This refers to something that no longer exists — it may have been deleted by someone else.";
  }
  if (code === "42703" || code === "PGRST204") {
    return "The app and the database are out of step. Retrying won't help — please tell an admin.";
  }
  if (code === "42501" || error.status === 403 || /row-level security|permission denied/i.test(msg)) {
    return "You don't have permission to do that.";
  }
  if (code === "PGRST301" || error.status === 401) {
    return "Your session has expired. Sign in again and your work will save.";
  }
  // supabase-js surfaces a dead network as a bare TypeError from fetch.
  if (error.name === "TypeError" || /failed to fetch|network ?error|load failed/i.test(msg)) {
    return "Can't reach the server. Check your connection — your work is still on screen, so try again in a moment.";
  }
  return msg;
}

// True when trying the same write again could plausibly succeed. Schema and permission
// problems are excluded — a retry button on those is a lie.
export function isRetryable(error) {
  if (!error) return false;
  const code = error.code || "";
  if (["23502", "23503", "42703", "42501", "PGRST204"].includes(code)) return false;
  if (error.status === 403) return false;
  return true;
}

// Run a Supabase query builder and normalise the outcome.
//
// Pass a THUNK, not a promise: `runWrite(() => supabase.from(t).insert(row))`. Supabase query
// builders are thenable and fire on await, so taking a thunk keeps the call site readable and
// lets us catch a synchronous throw as well as a returned error.
export async function runWrite(fn) {
  try {
    const { data, error } = await fn();
    if (error) {
      return { ok: false, data: null, error, message: friendlyDbError(error), retryable: isRetryable(error) };
    }
    return { ok: true, data, error: null, message: "", retryable: false };
  } catch (err) {
    // Network failures and thrown exceptions never reach the { error } channel.
    return { ok: false, data: null, error: err, message: friendlyDbError(err), retryable: isRetryable(err) };
  }
}

// Result for a write that was skipped because there is no cloud to write to (demo mode).
// Callers treat it as success — local state is the source of truth there.
export const LOCAL_OK = { ok: true, data: null, error: null, message: "", retryable: false, local: true };

// Email an admin about a write the database rejected.
//
// Successful creations are alerted by a database trigger (supabase/alerts-setup.sql), which
// is reliable because a row exists to trigger on. A FAILED write leaves nothing behind — no
// row, no trace outside the Supabase logs — so the client is the only thing that knows it
// happened. That is the gap this closes.
//
// Strictly fire-and-forget: it never throws, never blocks, and its own failure is swallowed.
// Alerting must not be able to break the app it is watching.
export function reportWriteFailure(supabase, { action, jobLabel, result, user }) {
  if (!supabase || !result?.error) return;
  try {
    supabase.functions.invoke("notify-job-event", {
      body: {
        source: "client",
        kind: "failed",
        action,
        jobLabel,
        user,
        code: result.error.code || "",
        message: result.message || result.error.message || "",
        retryable: result.retryable === true,
      },
    }).catch(() => {});
  } catch {
    /* never let alerting break a write path */
  }
}
