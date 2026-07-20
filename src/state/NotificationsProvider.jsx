import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { normalizeNotification, mentionCandidates, excerptOf } from "../lib/notifications";
import { loadStoredNotifications, saveStoredNotifications } from "../lib/storage";
import { useAuthCtx } from "./AuthProvider";
import { useWorkshop } from "./WorkshopProvider";

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user, cloud } = useAuthCtx();
  const { profiles, activePeople } = useWorkshop();
  const [notifications, setNotifications] = useState(() => (cloud ? [] : loadStoredNotifications()));
  const userId = user?.id || (user ? "local" : null);

  const mentionables = useMemo(
    () => mentionCandidates(profiles, activePeople, cloud),
    [profiles, activePeople, cloud],
  );

  // Persist demo notifications locally (cloud rows live in Postgres).
  useEffect(() => { if (!cloud) saveStoredNotifications(notifications); }, [cloud, notifications]);

  // Initial fetch on login (cloud only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !user?.id) return;
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled || error || !Array.isArray(data)) return;
      setNotifications(data.map(normalizeNotification));
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Realtime: new notifications arrive live and raise a toast; read-state syncs across devices.
  // A ref lets the INSERT handler avoid duplicating a row already present from the initial fetch.
  const idsRef = useRef(new Set());
  useEffect(() => { idsRef.current = new Set(notifications.map((n) => n.id)); }, [notifications]);

  useEffect(() => {
    if (!supabase || !user?.id) return;
    const channel = supabase
      .channel("notifications-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        const incoming = normalizeNotification(payload.new);
        if (idsRef.current.has(incoming.id)) return;
        setNotifications((prev) => [incoming, ...prev.filter((n) => n.id !== incoming.id)]);
        toast(incoming.actor ? `${incoming.actor} mentioned you` : "You were mentioned", { description: incoming.jobLabel || incoming.excerpt });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        const incoming = normalizeNotification(payload.new);
        setNotifications((prev) => prev.map((n) => (n.id === incoming.id ? incoming : n)));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // Insert a notification per mentioned user. Cloud: security-definer RPC. Demo: local append
  // (self-addressed) so the whole feature is testable without a backend.
  const notifyMentions = useCallback(async ({ userIds, jobId, jobLabel, excerpt }) => {
    const targets = Array.from(new Set((userIds || []).filter(Boolean)));
    if (!targets.length) return;
    if (supabase && user?.id) {
      const { error } = await supabase.rpc("notify_mentions", {
        target_ids: targets,
        p_job_id: jobId == null ? null : String(jobId),
        p_job_label: jobLabel || "",
        p_excerpt: excerptOf(excerpt, 200),
      });
      if (error) throw error;
      return;
    }
    // Demo mode: no other accounts exist, so surface the mention to the current user.
    const row = normalizeNotification({
      user_id: userId,
      actor: user?.name || user?.email || "Workshop",
      job_id: jobId == null ? null : String(jobId),
      job_label: jobLabel || "",
      excerpt: excerptOf(excerpt, 200),
      read: false,
    });
    setNotifications((prev) => [row, ...prev]);
  }, [user?.id, user?.name, user?.email, userId]);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (supabase && user?.id) await supabase.from("notifications").update({ read: true }).eq("id", id);
  }, [user?.id]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (supabase && user?.id) await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  }, [user?.id]);

  const value = useMemo(
    () => ({ notifications, unreadCount, mentionables, notifyMentions, markRead, markAllRead }),
    [notifications, unreadCount, mentionables, notifyMentions, markRead, markAllRead],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
