// Helpers for the cloud-mode suite. The app boots with a real Supabase client (see
// .env.e2e-cloud) but every request is answered here, so these tests are hermetic.

const PROJECT_REF = "e2e"; // first label of VITE_SUPABASE_URL host -> supabase-js storage key
const AUTH_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
const USER_ID = "00000000-0000-4000-8000-000000000001";

// A session far enough in the future that supabase-js reads it straight from storage and
// never attempts a token refresh over the network.
function sessionFixture() {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  return {
    access_token: "e2e-access-token",
    token_type: "bearer",
    expires_in: 60 * 60 * 24 * 365,
    expires_at: expiresAt,
    refresh_token: "e2e-refresh-token",
    user: {
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "anna.murphy@flexachem.com",
      app_metadata: { provider: "email" },
      user_metadata: { name: "Anna Murphy" },
      created_at: new Date().toISOString(),
    },
  };
}

const ADMIN_PROFILE = {
  id: USER_ID,
  email: "anna.murphy@flexachem.com",
  name: "Anna Murphy",
  role: "admin",
  active: true,
  onboarded: true,
  theme: "light",
};

// Sign in as an admin without touching the network, and answer every read with an empty
// table. `onInsertJob` decides what POST /rest/v1/jobs returns — that is the whole point of
// this suite.
export async function seedCloudSession(page, { onInsertJob, onPatchJob, jobs = [], alertCalls }) {
  await page.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: AUTH_STORAGE_KEY, session: sessionFixture() },
  );

  // Realtime: let the websocket fail quietly rather than hang the page.
  await page.route("**/realtime/v1/**", (route) => route.abort());

  // Edge functions. Pass an `alertCalls` array to capture what the app tried to send —
  // that is how we assert the failure-alert email was triggered without sending one.
  await page.route("**/functions/v1/**", async (route) => {
    if (alertCalls) {
      try {
        alertCalls.push(JSON.parse(route.request().postData() || "{}"));
      } catch { /* not JSON — ignore */ }
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.replace("/rest/v1/", "").split("?")[0];
    const method = request.method();

    if (method === "POST" && table === "jobs" && onInsertJob) return onInsertJob(route, request);
    if (method === "PATCH" && table === "jobs" && onPatchJob) return onPatchJob(route, request);

    if (method === "GET") {
      const body = table === "profiles" ? [ADMIN_PROFILE] : table === "jobs" ? jobs : [];
      // PostgREST returns a bare object (not an array) when the client asks for one row.
      const single = (request.headers()["accept"] || "").includes("vnd.pgrst.object");
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(single ? (body[0] ?? null) : body),
      });
    }

    // Any other write succeeds so a test only ever fails for the reason it is asserting.
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: "[]",
    });
  });
}

// A minimal jobs row in DB shape for tests that need an existing job to edit. Numeric id on
// purpose — normalizeJob must String() it or the drawer and edit modal silently no-op.
export function jobRow(overrides = {}) {
  return {
    id: 30,
    asm: "A007563",
    so: "298000",
    cust: "Eli Lilly",
    customer: "Eli Lilly",
    type: "Valve Assembly",
    job_type: "Valve Assembly",
    alloc: "Unassigned",
    allocated_to: "Unassigned",
    bus: "Valves",
    status: "In Progress",
    priority: "Normal",
    hrs: 8,
    actual_hours: 0,
    start_date: "2026-07-20",
    due_date: "2026-08-10",
    notes: [],
    deleted: false,
    archived: false,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// The exact shape PostgREST returns for the not-null violation that lost two jobs on
// 29 Jul 2026: `null value in column "allocated_to" of relation "jobs"`.
export function notNullViolation(column = "allocated_to") {
  return {
    status: 400,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({
      code: "23502",
      details: null,
      hint: null,
      message: `null value in column "${column}" of relation "jobs" violates not-null constraint`,
    }),
  };
}
