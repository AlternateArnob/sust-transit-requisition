import { Link } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import useNotifications from "../hooks/useNotifications";

import NotificationBell from "../components/NotificationBell";

interface NavbarProps {
  title: string;
  administrator: string;
}

function Navbar({ title, administrator }: NavbarProps) {
  const { currentUser } = useAuth();
  const { recommendationsCount } = useNotifications();

  // Phase 5 — only DepartmentHeads get a "recommendations waiting" pill
  // in the navbar. Admins already see admin-side workflows, and the
  // bell's running unreadCount covers their "something needs attention"
  // signal — we don't want to add a second pill to the Admin view.
  const showRecommendationsBadge =
    currentUser?.role === "DepartmentHead" && recommendationsCount > 0;

  return (
    <header className="flex h-16 items-center justify-between bg-[#0F2747] px-6 text-white">
      <h1 className="text-lg font-semibold">{title}</h1>

      <div className="flex items-center gap-4">
        {showRecommendationsBadge ? (
          <Link
            to="/admin/recommender"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
            aria-label={`${recommendationsCount} pending recommendation${recommendationsCount === 1 ? "" : "s"}`}
          >
            <span
              className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#F59E0B] px-1.5 text-[11px] font-semibold text-[#0F2747]"
            >
              {recommendationsCount}
            </span>
            <span>
              pending recommendation{recommendationsCount === 1 ? "" : "s"}
            </span>
          </Link>
        ) : null}

        <NotificationBell />
        <div className="text-sm">{administrator}</div>
      </div>
    </header>
  );
}

export default Navbar;
