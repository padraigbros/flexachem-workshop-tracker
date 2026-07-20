import { X, BellOff, CheckCheck } from "lucide-react";
import { formatRelative } from "../../lib/dates";
import { Drawer, DrawerHeader } from "../ui/overlay";
import { Button, IconButton, EmptyState, cx } from "../ui/primitives";

export function NotificationsDrawer({ notifications, open, onClose, onSelect, onMarkRead, onMarkAllRead }) {
  const hasUnread = notifications.some((n) => !n.read);

  const header = (
    <DrawerHeader>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-[var(--color-brand-300)]">Mentions & alerts</div>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Notifications</h2>
          <div className="mt-0.5 text-[0.82rem] text-[#c8daee]">When someone @-mentions you in a job note, it shows up here.</div>
        </div>
        <IconButton label="Close" onClick={onClose} className="border-white/20 bg-white/10 text-white hover:bg-white/20"><X size={18} /></IconButton>
      </div>
    </DrawerHeader>
  );

  return (
    <Drawer open={open} onClose={onClose} header={header}>
      <div className="p-4">
        {hasUnread && (
          <div className="mb-3 flex justify-end">
            <Button size="sm" variant="ghost" onClick={onMarkAllRead} className="gap-1.5"><CheckCheck size={14} />Mark all read</Button>
          </div>
        )}
        {notifications.length ? (
          <div className="grid gap-2">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => { onMarkRead(n.id); if (n.jobId != null) onSelect(n.jobId); }}
                className={cx(
                  "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors hover:border-[var(--color-brand-500)]",
                  n.read ? "border-[var(--line)] bg-[var(--surface-card)]" : "border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/8",
                )}
              >
                <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-[var(--color-brand-500)]")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-[0.72rem] text-[var(--ink-muted)]">
                    <strong className="truncate text-[var(--ink-soft)]">{n.actor || "Someone"} mentioned you</strong>
                    <span className="shrink-0">{formatRelative(n.createdAt)}</span>
                  </div>
                  {n.jobLabel && <div className="mt-0.5 truncate text-[0.74rem] font-semibold text-[var(--color-brand-600)]">{n.jobLabel}</div>}
                  {n.excerpt && <div className="mt-1 line-clamp-2 text-[0.82rem] text-[var(--ink)]">{n.excerpt}</div>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon={BellOff} title="No notifications" text="You're all caught up. Mentions in job notes will appear here." />
        )}
      </div>
    </Drawer>
  );
}
