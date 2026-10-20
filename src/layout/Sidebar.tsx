import { NavLink } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import {
  isTransportInCharge,
  isTransportAdministrator,
  isSuperAdmin,
} from "../utils/permissions";

interface NavItem {
  label: string;
  path: string;
}

const DASHBOARD_ITEM: NavItem = { label: "Dashboard", path: "/admin" };

const RECOMMENDER_ITEM: NavItem = {
  label: "Recommender",
  path: "/admin/recommender",
};

/**
 * Corrections Step 3 — the three admin roles no longer share one nav
 * list. Each role's surface is now genuinely different (not just a
 * couple of items hidden), so three explicit lists read more clearly
 * than one shared list with conditional filtering:
 *   - Transport In Charge keeps everything it always had.
 *   - Transport Administrator's only surface is Requisitions.
 *   - Super Admin's only surface is Accounts.
 * These match the route guards in router.tsx exactly — a role never
 * sees a nav link for a route it would immediately get redirected away
 * from.
 */
const TRANSPORT_IN_CHARGE_ITEMS: NavItem[] = [
  DASHBOARD_ITEM,
  { label: "Vehicle", path: "/admin/vehicle" },
  { label: "Driver", path: "/admin/driver" },
  { label: "Transport Schedule", path: "/admin/transport-schedule" },
  { label: "Schedule Lookup", path: "/admin/schedule" },
  { label: "Requisitions", path: "/admin/requisitions" },
];

const TRANSPORT_ADMINISTRATOR_ITEMS: NavItem[] = [
  DASHBOARD_ITEM,
  { label: "Requisitions", path: "/admin/requisitions" },
];

const SUPER_ADMIN_ITEMS: NavItem[] = [
  DASHBOARD_ITEM,
  { label: "Accounts", path: "/admin/users" },
];

export default function Sidebar() {
  const { currentUser } = useAuth();

  const navigationItems: NavItem[] = isTransportInCharge(currentUser?.role)
    ? TRANSPORT_IN_CHARGE_ITEMS
    : isTransportAdministrator(currentUser?.role)
      ? TRANSPORT_ADMINISTRATOR_ITEMS
      : isSuperAdmin(currentUser?.role)
        ? SUPER_ADMIN_ITEMS
        : currentUser?.role === "DepartmentHead"
          ? [DASHBOARD_ITEM, RECOMMENDER_ITEM]
          : [DASHBOARD_ITEM];

  return (
    <aside className="flex min-h-screen w-56 flex-col border-r border-border bg-card">
      <nav className="flex-1 space-y-1 p-3">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/admin"}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm font-medium ${
                isActive
                  ? "bg-primary text-white"
                  : "text-secondary hover:bg-surface"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
