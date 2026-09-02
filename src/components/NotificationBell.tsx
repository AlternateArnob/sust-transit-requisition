import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import useNotifications from "../hooks/useNotifications";
import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useVehicles from "../hooks/useVehicles";
import useOffDays from "../hooks/useOffDays";
import useRoutes from "../hooks/useRoutes";

import { detectConflicts } from "../utils/conflictUtils";
import type { AppNotification } from "../types";

export default function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    unreadCount,
  } = useNotifications();
  const { requisitions } = useRequisitions();
  const { allocations } = useAllocations();
  const { vehicles } = useVehicles();
  const { offDays } = useOffDays();
  const { routes } = useRoutes();

  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reconcile detected conflicts against already-notified ones on every render cycle
  useEffect(() => {
    const conflicts = detectConflicts(
      allocations,
      requisitions,
      vehicles,
      offDays,
      routes,
    );
    const notifiedConflictIds = new Set(
      notifications
        .filter((notification) => notification.linkType === "conflict")
        .map((notification) => notification.linkId),
    );

    conflicts.forEach((conflict) => {
      if (!notifiedConflictIds.has(conflict.id)) {
        addNotification({
          id: crypto.randomUUID(),
          type: "Conflict",
          message: conflict.description,
          timestamp: new Date().toISOString(),
          linkType: "conflict",
          linkId: conflict.id,
          isRead: false,
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocations, requisitions, vehicles, offDays, routes]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sorted = [...notifications].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
  const recent = sorted.slice(0, 8);

  function handleClick(notification: AppNotification) {
    markAsRead(notification.id);
    setIsOpen(false);
    navigate(
      notification.linkType === "requisition"
        ? "/admin/requisitions"
        : "/admin/conflicts",
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative rounded-md p-2 text-white hover:bg-white/10"
        aria-label="Notifications"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#B91C1C] px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-[#E2E8F0] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
            <p className="text-sm font-medium text-[#1E293B]">Notifications</p>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-medium text-[#334E68] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#64748B]">
                No notifications yet
              </p>
            ) : (
              recent.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleClick(notification)}
                  className={`block w-full border-b border-[#E2E8F0] px-4 py-3 text-left last:border-b-0 hover:bg-[#F8FAFC] ${
                    notification.isRead ? "" : "bg-[#EFF6FF]"
                  }`}
                >
                  <p className="text-xs font-medium text-[#0F2747]">
                    {notification.type}
                  </p>
                  <p className="mt-0.5 text-sm text-[#1E293B]">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    {new Date(notification.timestamp).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-[#E2E8F0] px-4 py-2 text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/admin/notifications");
              }}
              className="text-xs font-medium text-[#334E68] hover:underline"
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
