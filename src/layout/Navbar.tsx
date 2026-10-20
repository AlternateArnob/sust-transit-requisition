import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import useNotifications from "../hooks/useNotifications";

import NotificationBell from "../components/NotificationBell";

interface NavbarProps {
  title: string;
}

function Navbar({ title }: NavbarProps) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { recommendationsCount } = useNotifications();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Same click-outside-to-close pattern NotificationBell.tsx already
  // uses, kept consistent rather than reaching for a new approach.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Phase 5 — only DepartmentHeads get a "recommendations waiting" pill
  // in the navbar. Admins already see admin-side workflows, and the
  // bell's running unreadCount covers their "something needs attention"
  // signal — we don't want to add a second pill to the Admin view.
  const showRecommendationsBadge =
    currentUser?.role === "DepartmentHead" && recommendationsCount > 0;

  function handleLogout() {
    setIsMenuOpen(false);
    logout();
    navigate("/login");
  }

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

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/10"
          >
            {currentUser?.fullName ?? currentUser?.email ?? "Account"}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={isMenuOpen ? "rotate-180" : ""}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-[#E2E8F0] bg-white py-1 text-[#1E293B] shadow-lg">
              <Link
                to="/admin/profile"
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-2 text-sm hover:bg-[#F8FAFC]"
              >
                Edit Profile
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="block w-full px-4 py-2 text-left text-sm text-[#B91C1C] hover:bg-[#FEF2F2]"
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
