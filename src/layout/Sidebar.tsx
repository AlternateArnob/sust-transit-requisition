import { NavLink } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import { isAdminRole, isSuperAdmin } from "../utils/permissions";

interface NavItem {
  label: string;
  path: string;
}

const DASHBOARD_ITEM: NavItem = { label: "Dashboard", path: "/admin" };

// Phase 0 — all three Transport Office roles currently share the same
// vehicle/driver/schedule/requisitions capabilities (see
// utils/permissions.ts).
// Phase 4 — the standalone Allocation page was retired (see
// RequisitionsPage's Super Admin "Allocated" tab for the read-only
// cross-requisition view it used to provide).
const ADMIN_ROLE_ITEMS: NavItem[] = [
  { label: "Vehicle", path: "/admin/vehicle" },
  { label: "Driver", path: "/admin/driver" },
  { label: "Transport Schedule", path: "/admin/transport-schedule" },
  { label: "Schedule Lookup", path: "/admin/schedule" },
  { label: "Requisitions", path: "/admin/requisitions" },
  { label: "Notifications", path: "/admin/notifications" },
];

const RECOMMENDER_ITEM: NavItem = {
  label: "Recommender",
  path: "/admin/recommender",
};

export default function Sidebar() {
  const { currentUser } = useAuth();

  const navigationItems: NavItem[] = isAdminRole(currentUser?.role)
    ? [
        DASHBOARD_ITEM,
        ...ADMIN_ROLE_ITEMS,
        // Phase 9 — Super Admin console, not shared with TIC/Administrator.
        ...(isSuperAdmin(currentUser?.role)
          ? [{ label: "Accounts", path: "/admin/users" }]
          : []),
      ]
    : currentUser?.role === "DepartmentHead"
      ? [DASHBOARD_ITEM, RECOMMENDER_ITEM, { label: "Notifications", path: "/admin/notifications" }]
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
