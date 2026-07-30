import { useEffect, useState } from "react";
import { useRouteError, isRouteErrorResponse } from "react-router-dom";
import { RefreshCw, Home } from "lucide-react";
import { BrandMark } from "./Sidebar";
import { Sentry } from "../../lib/monitoring";
import { Button } from "../ui/primitives";

// After a new deploy, an already-open tab's index.html still points at the OLD
// content-hashed chunk filenames (e.g. CustomersView-xxxx.js). Vercel only serves the
// latest build's assets, so once a newer deploy overwrites them, lazy-loading any
// code-split route (Staff/JobTypes/Customers/BusinessUnits/DueDates/MasterList) 404s
// with "Failed to fetch dynamically imported module" — not specific to any one page.
// A reload fetches the current index.html + matching chunks and fixes it outright, so
// we do that once automatically instead of showing react-router's raw crash screen.
const CHUNK_ERROR_RE = /fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i;
const RELOAD_GUARD_KEY = "flexachem_chunk_reload_attempted";

function isChunkLoadError(error) {
  const message = isRouteErrorResponse(error) ? error.statusText : error?.message || String(error || "");
  return CHUNK_ERROR_RE.test(message);
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const chunkError = isChunkLoadError(error);
  const alreadyTried = typeof sessionStorage !== "undefined" && sessionStorage.getItem(RELOAD_GUARD_KEY) === "1";
  const [reloading, setReloading] = useState(chunkError && !alreadyTried);

  useEffect(() => {
    if (!chunkError || alreadyTried) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
    window.location.reload();
  }, [chunkError, alreadyTried]);

  // Report anything that actually reached this screen. A stale-chunk error that self-heals on
  // the first reload is filtered out in monitoring.js (expected, not actionable); one that
  // survives the reload is a genuine crash and lands here to be reported.
  useEffect(() => {
    if (chunkError && !alreadyTried) return;
    Sentry.captureException(error, {
      tags: { boundary: "route", stale_chunk: String(chunkError) },
    });
  }, [error, chunkError, alreadyTried]);

  if (reloading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center p-6">
        <div className="card grid max-w-sm gap-3 p-7 text-center">
          <div className="mx-auto animate-pulse"><BrandMark /></div>
          <div className="text-lg font-bold text-[var(--ink)]">Updating…</div>
          <div className="text-[0.82rem] text-[var(--ink-muted)]">A newer version of the app is available. Refreshing now.</div>
        </div>
      </div>
    );
  }

  // Either a non-chunk error, or the reload already happened once and it's still
  // failing (a real problem, not just a stale deploy) — show a real fallback instead
  // of react-router's unstyled default crash screen.
  const message = isRouteErrorResponse(error) ? error.statusText : error?.message || "Something went wrong.";
  return (
    <div className="grid min-h-[100dvh] place-items-center p-6">
      <div className="card grid max-w-md gap-4 p-7 text-center">
        <div className="mx-auto"><BrandMark /></div>
        <div>
          <div className="text-lg font-bold text-[var(--ink)]">Something went wrong</div>
          <p className="mt-1 text-[0.82rem] text-[var(--ink-muted)]">{message}</p>
        </div>
        <div className="flex justify-center gap-2">
          <Button variant="ghost" onClick={() => { window.location.href = "/"; }} className="gap-1.5"><Home size={15} />Dashboard</Button>
          <Button variant="primary" onClick={() => window.location.reload()} className="gap-1.5"><RefreshCw size={15} />Reload</Button>
        </div>
      </div>
    </div>
  );
}
