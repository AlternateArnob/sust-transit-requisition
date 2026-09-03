import { NavLink } from "react-router-dom";

import useAuth from "../hooks/useAuth";

const baseNavigationItems = [
  { label: "Dashboard", path: "/admin" },
  { label: "Vehicle", path: "/admin/vehicle" },
  { label: "Driver", path: "/admin/driver" },
  { label: "Transport Schedule", path: "/admin/routes" },
  { label: "Requisitions", path: "/admin/requisitions" },
];

const recommenderNavigationItem = {
  label: "Recommender",
  path: "/admin/recommender",
};

export default function Sidebar() {
  const { currentUser } = useAuth();
  const showRecommender = currentUser?.role === "DepartmentHead";

  const navigationItems = showRecommender
    ? [
        ...baseNavigationItems.slice(0, 1),
        recommenderNavigationItem,
        ...baseNavigationItems.slice(1),
      ]
    : baseNavigationItems;

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
