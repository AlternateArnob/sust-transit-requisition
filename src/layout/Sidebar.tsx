import { NavLink } from "react-router-dom";

const navigationItems = [
  { label: "Dashboard", path: "/admin" },
  { label: "Vehicle", path: "/admin/fleet" },
  { label: "Driver", path: "/admin/staff" },
  { label: "Routes", path: "/admin/routes" },
  { label: "Requisitions", path: "/admin/requisitions" },
  { label: "Conflicts", path: "/admin/conflicts" },
  { label: "Notifications", path: "/admin/notifications" },
  { label: "Mileage", path: "/admin/mileage" },
  // Hidden per request — kept out of nav, files untouched:
  // { label: "Schedule", path: "/admin/schedule" },
  // { label: "Allocation", path: "/admin/allocation" },
];

export default function Sidebar() {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-[#E2E8F0] bg-white">
      <nav className="flex-1 space-y-1 p-3">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/admin"}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm font-medium ${
                isActive
                  ? "bg-[#0F2747] text-white"
                  : "text-[#334E68] hover:bg-[#F8FAFC]"
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
