import { Link, useNavigate } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import NotificationBell from "./NotificationBell";

type ApplicantNavKey =
  | "dashboard"
  | "apply"
  | "my-requisitions"
  | "my-mileage";

const NAV_LINKS: Array<{ key: ApplicantNavKey; to: string; label: string }> = [
  { key: "dashboard", to: "/dashboard", label: "Dashboard" },
  { key: "apply", to: "/apply", label: "New Requisition" },
  { key: "my-requisitions", to: "/my-requisitions", label: "My Requisitions" },
  { key: "my-mileage", to: "/my-mileage", label: "My Mileage" },
];

interface ApplicantHeaderProps {
  /** Which nav item to underline as current. Omit on pages (like
   *  Profile) that aren't one of the four primary destinations. */
  active?: ApplicantNavKey;
  title?: string;
}

/**
 * Fix 3 — one shared header for every applicant-facing page
 * (ApplyRequisitionPage, MyRequisitionsPage, ApplicantDashboardPage,
 * MyMileagePage, and the Profile link's destination). Previously each
 * page hand-rolled its own header with a different, inconsistent subset
 * of links — none of them linked to /dashboard, and Profile Setup (the
 * applicant's only account-edit page — the admin-side /admin/profile
 * route is not reachable by the Applicant role, since it sits inside
 * the ADMIN_LAYOUT_ROLES-gated /admin shell) had no discoverable link
 * anywhere outside a buried line inside the requisition form itself.
 */
export default function ApplicantHeader({ active, title }: ApplicantHeaderProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="flex h-16 flex-wrap items-center justify-between gap-3 bg-[#0F2747] px-6 py-3 text-white">
      <h1 className="text-lg font-semibold">
        {title ? `SUST Transit — ${title}` : "SUST Transit"}
      </h1>

      <nav className="flex flex-wrap items-center gap-4 text-sm">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.key}
            to={link.to}
            className={
              active === link.key
                ? "font-semibold underline underline-offset-4"
                : "hover:underline"
            }
          >
            {link.label}
          </Link>
        ))}

        <Link to="/profile-setup" className="hover:underline">
          Profile
        </Link>

        <NotificationBell />

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10"
        >
          Log out
        </button>
      </nav>
    </header>
  );
}
