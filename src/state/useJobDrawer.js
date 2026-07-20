import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// The selected job and the updates panel live in the URL (?job=<id>, ?panel=updates).
// This makes jobs deep-linkable and lets the browser/Android back button close overlays for free.
export function useJobDrawer() {
  const [params, setParams] = useSearchParams();
  const jobId = params.get("job");
  const panel = params.get("panel");

  const openJob = useCallback((id) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("job", id); else next.delete("job");
      next.delete("panel");
      return next;
    });
  }, [setParams]);

  const closeJob = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("job");
      return next;
    });
  }, [setParams]);

  const openUpdates = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("panel", "updates");
      next.delete("job");
      return next;
    });
  }, [setParams]);

  const openNotifications = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("panel", "notifications");
      next.delete("job");
      return next;
    });
  }, [setParams]);

  const closePanel = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("panel");
      return next;
    });
  }, [setParams]);

  return { jobId, panel, openJob, closeJob, openUpdates, openNotifications, closePanel };
}
