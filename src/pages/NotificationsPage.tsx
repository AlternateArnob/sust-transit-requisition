import { useNavigate } from "react-router-dom";
import useNotifications from "../hooks/useNotifications";
import type { AppNotification } from "../types";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

  const sorted = [...notifications].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );

  function handleClick(notification: AppNotification) {
    markAsRead(notification.id);
    navigate(
      notification.linkType === "requisition"
        ? "/admin/requisitions"
        : "/admin/conflicts",
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E293B]">
            Notifications
          </h1>

          <p className="mt-1 text-sm text-[#64748B]">
            New requisitions and detected conflicts
          </p>
        </div>

        {notifications.some((notification) => !notification.isRead) && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="h-10 rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC]"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
        {sorted.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-[#64748B]">
            No notifications yet
          </p>
        ) : (
          sorted.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => handleClick(notification)}
              className={`block w-full border-t border-[#E2E8F0] px-5 py-4 text-left first:border-t-0 hover:bg-[#F8FAFC] ${
                notification.isRead ? "bg-white" : "bg-[#EFF6FF]"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#0F2747]">
                  {notification.type}
                </p>

                {!notification.isRead && (
                  <span className="h-2 w-2 rounded-full bg-[#B91C1C]" />
                )}
              </div>

              <p className="mt-1 text-sm text-[#1E293B]">
                {notification.message}
              </p>

              <p className="mt-1 text-xs text-[#64748B]">
                {new Date(notification.timestamp).toLocaleString()}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
