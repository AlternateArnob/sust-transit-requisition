import { useNavigate } from "react-router-dom";
import ApplicantHeader from "../components/ApplicantHeader";
import useAuth from "../hooks/useAuth";
import useNotifications from "../hooks/useNotifications";
import useRequisitions from "../hooks/useRequisitions";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageTitle from "../components/ui/PageTitle";
import type { AppNotification } from "../types";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const { requisitions } = useRequisitions();
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
      // Department/Office Heads have no /admin/requisitions page: their
      // pings go to the request detail, or to My Requisitions when it is
      // their own application (same rule as the notification bell).
      if (currentUser?.role === "DepartmentHead") {
        const isOwn = requisitions.some(
          (item) =>
            item.id === notification.linkId &&
            item.requesterId === currentUser.id,
        );
        navigate(
          isOwn
            ? `/my-requisitions?open=${notification.linkId}`
            : `/admin/recommender/${notification.linkId}`,
        );
        return;
      }
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

  const body = (
    <div className="space-y-6">
      <PageTitle
        title="Notifications"
        subtitle="New requisitions and detected conflicts"
        actions={
          notifications.some((notification) => !notification.isRead) ? (
            <Button variant="secondary" onClick={markAllAsRead}>
              Mark all read
            </Button>
          ) : null
        }
      />

      <Card flush className="overflow-hidden">
        {sorted.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-text-muted">
            No notifications yet
          </p>
        ) : (
          sorted.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => handleClick(notification)}
              className={`block w-full border-t border-border px-5 py-4 text-left first:border-t-0 hover:bg-surface ${
                notification.isRead ? "bg-white" : "bg-info-bg/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-primary">
                  {notification.type}
                </p>

                {!notification.isRead && (
                  <span className="h-2 w-2 rounded-full bg-error" />
                )}
              </div>

              <p className="mt-1 text-sm text-text">
                {notification.message}
              </p>

              <p className="mt-1 text-xs text-text-muted">
                {new Date(notification.timestamp).toLocaleString()}
              </p>
            </button>
          ))
        )}
      </Card>
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
      <div className="min-h-screen bg-surface">
        <ApplicantHeader title="Notifications" />

        <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">{body}</main>
      </div>
    );
  }

  return body;
}
