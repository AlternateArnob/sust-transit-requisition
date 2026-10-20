import { Link } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import useVehicles from "../hooks/useVehicles";
import useDriver from "../hooks/useDriver";
import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useOffDays from "../hooks/useOffDays";
import useTransportSchedule from "../hooks/useTransportSchedule";
import useNotifications from "../hooks/useNotifications";
import useUsers from "../hooks/useUsers";

import StatCard from "../components/StatCard";
import { isInActiveQueue } from "../utils/requisitionUtils";
import { detectConflicts } from "../utils/conflictUtils";
import { todayString } from "../utils/scheduleUtils";
import {
  isTransportAdministrator,
  isSuperAdmin,
  ADMIN_ROLES,
  type AdminRole,
} from "../utils/permissions";

/**
 * Corrections Step 3 — this used to be one dashboard computing
 * vehicle/driver/requisition/conflict stats unconditionally for every
 * role. Now branches by role: each one only computes and shows what
 * that role can actually act on, rather than e.g. running vehicle/
 * driver queries for a Super Admin who can no longer see vehicles or
 * drivers at all.
 *
 * Transport In Charge's scope is unchanged from before this step, so
 * it's also the fallback for any role not explicitly Super Admin or
 * Transport Administrator (DepartmentHead lands here too, exactly as
 * it always has — splitting DepartmentHead's own dashboard wasn't part
 * of this correction, so it's deliberately left alone).
 */
export default function DashboardPage() {
  const { currentUser } = useAuth();

  if (isSuperAdmin(currentUser?.role)) {
    return <SuperAdminDashboard />;
  }

  if (isTransportAdministrator(currentUser?.role)) {
    return <TransportAdministratorDashboard />;
  }

  return <TransportInChargeDashboard />;
}

function DashboardHeader({ subtitle }: { subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#1E293B]">Dashboard</h1>
      <p className="mt-1 text-sm text-[#64748B]">
        {subtitle} —{" "}
        {new Date().toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
    </div>
  );
}

function SuperAdminDashboard() {
  const { users } = useUsers();

  const transportOfficeUsers = users.filter((user) =>
    ADMIN_ROLES.includes(user.role as AdminRole),
  );

  function countByRole(role: AdminRole): number {
    return transportOfficeUsers.filter((user) => user.role === role).length;
  }

  const deactivatedCount = transportOfficeUsers.filter(
    (user) => user.isActive === false,
  ).length;

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
          label="Transport In Charge"
          value={countByRole("TransportInCharge")}
          href="/admin/users"
        />
        <StatCard
          label="Transport Administrator"
          value={countByRole("TransportAdministrator")}
          href="/admin/users"
        />
        <StatCard
          label="Super Admin"
          value={countByRole("SuperAdmin")}
          href="/admin/users"
        />
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

function TransportAdministratorDashboard() {
  const { vehicles } = useVehicles();
  const { driver } = useDriver();
  const { requisitions } = useRequisitions();
  const { allocations } = useAllocations();
  const { offDays } = useOffDays();
  const { routes } = useTransportSchedule();
  const { unreadCount } = useNotifications();

  const today = todayString();

  const todaysAllocations = allocations.filter(
    (allocation) => allocation.date === today,
  );

  const pendingRequisitions = requisitions.filter(isInActiveQueue).length;

  const conflicts = detectConflicts(
    allocations,
    requisitions,
    vehicles,
    offDays,
    routes,
  );
  const blockingConflicts = conflicts.filter(
    (conflict) => conflict.severity === "Blocking",
  ).length;

  // Still needed for display only (labeling allocations below) — TA no
  // longer manages vehicles/drivers, but still sees which ones are tied
  // to the requisitions they're approving/completing.
  function getVehicleLabel(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    return vehicle
      ? `${vehicle.registrationNumber} (${vehicle.category})`
      : "Unknown Vehicle";
  }

  function getDriverName(driverId?: string) {
    if (!driverId) {
      return "No driver";
    }

    return (
      driver.find((member) => member.id === driverId)?.name ?? "Unknown Driver"
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader subtitle="Requisition queue overview" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's Allocations"
          value={todaysAllocations.length}
          href="/admin/requisitions"
        />
        <StatCard
          label="Pending Requisitions"
          value={pendingRequisitions}
          href="/admin/requisitions"
          accent="warning"
        />
        <StatCard
          label="Conflicts"
          value={conflicts.length}
          href="/admin/conflicts"
          accent={blockingConflicts > 0 ? "error" : "default"}
        />
        <StatCard
          label="Unread Notifications"
          value={unreadCount}
          href="/admin/notifications"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[#E2E8F0] bg-white">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
            <p className="text-sm font-medium text-[#1E293B]">
              Today's Allocations
            </p>

            <Link
              to="/admin/requisitions"
              className="text-xs font-medium text-[#334E68] hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {todaysAllocations.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#64748B]">
                No allocations scheduled for today.
              </p>
            ) : (
              todaysAllocations.slice(0, 5).map((allocation) => (
                <div key={allocation.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-[#1E293B]">
                    {allocation.startTime}–{allocation.endTime} ·{" "}
                    {getVehicleLabel(allocation.vehicleId)}
                  </p>

                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Driver: {getDriverName(allocation.driverId)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
            <p className="text-sm font-medium text-[#1E293B]">
              Active Conflicts
            </p>

            <Link
              to="/admin/conflicts"
              className="text-xs font-medium text-[#334E68] hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {conflicts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#64748B]">
                No conflicts detected.
              </p>
            ) : (
              conflicts.slice(0, 5).map((conflict) => (
                <div key={conflict.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        conflict.severity === "Blocking"
                          ? "bg-[#FEE2E2] text-[#B91C1C]"
                          : "bg-[#FEF3C7] text-[#B45309]"
                      }`}
                    >
                      {conflict.severity}
                    </span>

                    <p className="text-sm font-medium text-[#1E293B]">
                      {conflict.type}
                    </p>
                  </div>

                  <p className="mt-1 text-xs text-[#64748B]">
                    {conflict.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Unchanged from the original single dashboard — Transport In Charge
 * keeps everything it always had (confirmed in the corrections plan).
 */
function TransportInChargeDashboard() {
  const { vehicles } = useVehicles();
  const { driver } = useDriver();
  const { requisitions } = useRequisitions();
  const { allocations } = useAllocations();
  const { offDays } = useOffDays();
  const { routes } = useTransportSchedule();
  const { unreadCount } = useNotifications();

  const today = todayString();

  const activeVehicles = vehicles.filter(
    (vehicle) => vehicle.operationalStatus === "Active",
  ).length;

  const underMaintenance = vehicles.filter(
    (vehicle) => vehicle.operationalStatus === "Under Maintenance",
  ).length;

  const todaysAllocations = allocations.filter(
    (allocation) => allocation.date === today,
  );

  const pendingRequisitions = requisitions.filter(isInActiveQueue).length;

  const conflicts = detectConflicts(
    allocations,
    requisitions,
    vehicles,
    offDays,
    routes,
  );
  const blockingConflicts = conflicts.filter(
    (conflict) => conflict.severity === "Blocking",
  ).length;

  const activeDrivers = driver.filter(
    (member) => member.status === "Active",
  ).length;

  function getVehicleLabel(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    return vehicle
      ? `${vehicle.registrationNumber} (${vehicle.category})`
      : "Unknown Vehicle";
  }

  function getDriverName(driverId?: string) {
    if (!driverId) {
      return "No driver";
    }

    return (
      driver.find((member) => member.id === driverId)?.name ?? "Unknown Driver"
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader subtitle="Transport administration overview" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Vehicle"
          value={vehicles.length}
          href="/admin/vehicle"
        />
        <StatCard
          label="Active Vehicles"
          value={activeVehicles}
          href="/admin/vehicle"
          accent="success"
        />
        <StatCard
          label="Under Maintenance"
          value={underMaintenance}
          href="/admin/vehicle"
          accent="warning"
        />
        <StatCard
          label="Today's Allocations"
          value={todaysAllocations.length}
          href="/admin/requisitions"
        />
        <StatCard
          label="Pending Requisitions"
          value={pendingRequisitions}
          href="/admin/requisitions"
          accent="warning"
        />
        <StatCard
          label="Conflicts"
          value={conflicts.length}
          href="/admin/conflicts"
          accent={blockingConflicts > 0 ? "error" : "default"}
        />
        <StatCard
          label="Unread Notifications"
          value={unreadCount}
          href="/admin/notifications"
        />
        <StatCard
          label="Active Drivers"
          value={activeDrivers}
          href="/admin/driver"
        />
      </div>

      {/* Detail panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Allocations */}
        <div className="rounded-lg border border-[#E2E8F0] bg-white">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
            <p className="text-sm font-medium text-[#1E293B]">
              Today's Allocations
            </p>

            <Link
              to="/admin/requisitions"
              className="text-xs font-medium text-[#334E68] hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {todaysAllocations.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#64748B]">
                No allocations scheduled for today.
              </p>
            ) : (
              todaysAllocations.slice(0, 5).map((allocation) => (
                <div key={allocation.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-[#1E293B]">
                    {allocation.startTime}–{allocation.endTime} ·{" "}
                    {getVehicleLabel(allocation.vehicleId)}
                  </p>

                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Driver: {getDriverName(allocation.driverId)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Conflicts */}
        <div className="rounded-lg border border-[#E2E8F0] bg-white">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
            <p className="text-sm font-medium text-[#1E293B]">
              Active Conflicts
            </p>

            <Link
              to="/admin/conflicts"
              className="text-xs font-medium text-[#334E68] hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {conflicts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#64748B]">
                No conflicts detected.
              </p>
            ) : (
              conflicts.slice(0, 5).map((conflict) => (
                <div key={conflict.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        conflict.severity === "Blocking"
                          ? "bg-[#FEE2E2] text-[#B91C1C]"
                          : "bg-[#FEF3C7] text-[#B45309]"
                      }`}
                    >
                      {conflict.severity}
                    </span>

                    <p className="text-sm font-medium text-[#1E293B]">
                      {conflict.type}
                    </p>
                  </div>

                  <p className="mt-1 text-xs text-[#64748B]">
                    {conflict.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
