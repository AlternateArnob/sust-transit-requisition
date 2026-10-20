import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useNotifications from "../hooks/useNotifications";
import type { AppNotification } from "../types";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const isApplicant = currentUser?.role === "Applicant";

  const sorted = [...notifications].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );

  function handleClick(notification: AppNotification) {
    markAsRead(notification.id);

    // Step 10 — an Applicant reaching this page (via the new /notifications
    // route) has no /admin access, so every link must resolve to an
    // applicant-facing route instead of the admin routes below.
    if (isApplicant) {
      if (notification.linkType === "requisition") {
        navigate(`/my-requisitions?open=${notification.linkId}`);
        return;
      }
      if (notification.linkType === "user") {
        navigate("/profile-setup");
        return;
      }
      navigate("/dashboard");
      return;
    }

    if (notification.linkType === "requisition") {
      navigate("/admin/requisitions");
      return;
    }

    // Phase 9 — account activation/deactivation/role-change pings.
    // This page never got the fix NotificationBell.tsx got in Phase 9;
    // backfilling it here so both surfaces route consistently.
    if (notification.linkType === "user") {
      navigate("/admin/users");
      return;
    }

    navigate("/admin/conflicts");
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const body = (
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

  // Step 10 — this page is shared between the admin shell (rendered bare
  // inside AdminLayout's <Outlet>, which already supplies Navbar/Sidebar)
  // and the new top-level /notifications route an Applicant hits
  // directly with no surrounding shell at all. Give Applicants the same
  // self-contained header the other applicant-facing pages already use
  // (ApplicantDashboardPage, MyRequisitionsPage, etc.) so they aren't
  // dropped on an unstyled, nav-less page.
  if (isApplicant) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <header className="flex h-16 items-center justify-between bg-[#0F2747] px-6 text-white">
          <h1 className="text-lg font-semibold">SUST Transit — Notifications</h1>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <Link to="/my-requisitions" className="hover:underline">
              My Requisitions
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">{body}</main>
      </div>
    );
  }

  return body;
}
