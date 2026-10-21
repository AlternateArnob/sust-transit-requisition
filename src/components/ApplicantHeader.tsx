import { Link, useLocation } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import useNotifications from "../hooks/useNotifications";
import NotificationBell from "./NotificationBell";
import SustLogo from "./SustLogo";
import LogoutButton from "./LogoutButton";

type NavKey =
  | "dashboard"
  | "apply"
  | "my-requisitions"
  | "my-mileage"
  | "request"
  | "recommended"
  | "profile";

type NavLinkItem = { key: NavKey; to: string; label: string };

const APPLICANT_LINKS: NavLinkItem[] = [
  { key: "dashboard", to: "/dashboard", label: "Dashboard" },
  { key: "apply", to: "/apply", label: "New Requisition" },
  { key: "my-requisitions", to: "/my-requisitions", label: "My Requisitions" },
  { key: "my-mileage", to: "/my-mileage", label: "My Mileage" },
];

/**
 * A Department / Office Head applies for vehicles like any teacher AND
 * handles requests from their department, so they get one top bar that
 * covers both — no left sidebar anywhere (see AdminLayout). Their
 * Dashboard lives under /admin, which is the Applicant-only /dashboard's
 * equivalent for this role.
 */
const HEAD_LINKS: NavLinkItem[] = [
  { key: "dashboard", to: "/admin", label: "Dashboard" },
  { key: "request", to: "/admin/recommender", label: "Request" },
  { key: "recommended", to: "/admin/recommender/history", label: "Recommended by me" },
  { key: "apply", to: "/apply", label: "New Requisition" },
  { key: "my-requisitions", to: "/my-requisitions", label: "My Requisitions" },
  { key: "my-mileage", to: "/my-mileage", label: "My Mileage" },
];

function keyFromPath(pathname: string): NavKey | undefined {
  if (pathname === "/dashboard" || pathname === "/admin") return "dashboard";
  if (pathname.startsWith("/apply")) return "apply";
  if (pathname.startsWith("/my-requisitions")) return "my-requisitions";
  if (pathname.startsWith("/my-mileage")) return "my-mileage";
  if (pathname.startsWith("/admin/recommender/history")) return "recommended";
  if (pathname.startsWith("/admin/recommender")) return "request";
  if (pathname.startsWith("/profile-setup")) return "profile";
  return undefined;
}

interface ApplicantHeaderProps {
  /** Which nav item to underline as current. Defaults to whatever the
   *  current URL implies, so pages rarely need to pass it. */
  active?: NavKey;
  title?: string;
}

/**
 * One shared top bar for every applicant-facing page and for the
 * Department / Office Head's whole area. Always at the top of the page
 * (never a sidebar) so navigation stays in the same place everywhere.
 */
export default function ApplicantHeader({ active, title }: ApplicantHeaderProps) {
  const location = useLocation();
  const { currentUser } = useAuth();
  const { recommendationsCount } = useNotifications();

  const isHead = currentUser?.role === "DepartmentHead";
  const links = isHead ? HEAD_LINKS : APPLICANT_LINKS;
  const current = active ?? keyFromPath(location.pathname);

  const linkClass = (key: NavKey) =>
    current === key
      ? "font-semibold underline underline-offset-4"
      : "hover:underline";

  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-[#0F2747] px-6 py-3 text-white">
      <div className="flex items-center gap-3">
        <SustLogo badge heightClass="h-8" />
        <h1 className="text-lg font-semibold">
          {title ? `SUST Transit — ${title}` : "SUST Transit"}
        </h1>
      </div>

      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {links.map((link) => (
          <Link key={link.key} to={link.to} className={linkClass(link.key)}>
            {link.label}
            {link.key === "request" && recommendationsCount > 0 ? (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#F59E0B] px-1.5 text-[11px] font-semibold text-[#0F2747]">
                {recommendationsCount}
              </span>
            ) : null}
          </Link>
        ))}

        <Link to="/profile-setup" className={linkClass("profile")}>
          Profile
        </Link>

        <NotificationBell />

        <LogoutButton />
      </nav>
    </header>
  );
}
