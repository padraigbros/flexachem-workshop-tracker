import { Bell } from "lucide-react";
import { useNotifications } from "../../state/NotificationsProvider";
import { useJobDrawer } from "../../state/useJobDrawer";

// Bell with an unread badge, shown at all breakpoints. Opens the notifications panel.
export function NotificationsBell() {
  const { unreadCount } = useNotifications();
  const { openNotifications } = useJobDrawer();

  return (
    <button
      type="button"
      onClick={openNotifications}
      aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
      title="Notifications"
      className="relative grid h-9 w-9 place-items-center rounded-xl border border-[var(--line-strong)] bg-[var(--surface-card)] text-[var(--ink)] transition-colors hover:border-[var(--color-brand-500)]"
    >
      <Bell size={16} />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-[16px] place-items-center rounded-full bg-[var(--color-brand-500)] px-1 text-[0.58rem] font-bold leading-[16px] text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
