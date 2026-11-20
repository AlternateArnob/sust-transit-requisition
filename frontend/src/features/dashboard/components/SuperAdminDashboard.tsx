import useUsers from "@/features/users/hooks/useUsers";
import StatCard from "@/shared/ui/StatCard";
import { ADMIN_ROLES, type AdminRole } from "@/shared/utils/permissions";
import DashboardHeader from "./DashboardHeader";

export default function SuperAdminDashboard() {
  const { users } = useUsers();

  const transportOfficeUsers = users.filter((user) => ADMIN_ROLES.includes(user.role as AdminRole));

  function countByRole(role: AdminRole): number {
    return transportOfficeUsers.filter((user) => user.role === role).length;
  }

  const deactivatedCount = transportOfficeUsers.filter((user) => user.isActive === false).length;

  return (
    <div className="space-y-6">
      <DashboardHeader subtitle="Transport Office account overview" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Transport Office Accounts"
          value={transportOfficeUsers.length}
          href="/admin/users"
        />
        <StatCard
          label="Transport In-Charge"
          value={countByRole("TransportInCharge")}
          href="/admin/users"
        />
        <StatCard
          label="Transport Administrator"
          value={countByRole("TransportAdministrator")}
          href="/admin/users"
        />
        <StatCard label="Super Admin" value={countByRole("SuperAdmin")} href="/admin/users" />
        <StatCard
          label="Deactivated Accounts"
          value={deactivatedCount}
          href="/admin/users"
          accent={deactivatedCount > 0 ? "warning" : "default"}
        />
      </div>
    </div>
  );
}
