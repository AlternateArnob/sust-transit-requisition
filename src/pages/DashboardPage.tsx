import { Link } from "react-router-dom";

import useVehicles from "../hooks/useVehicles";
import useDriver from "../hooks/useDriver";
import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useOffDays from "../hooks/useOffDays";
import useRoutes from "../hooks/useRoutes";
import useNotifications from "../hooks/useNotifications";

import StatCard from "../components/StatCard";
import { isInActiveQueue } from "../utils/requisitionUtils";
import { detectConflicts } from "../utils/conflictUtils";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { vehicles } = useVehicles();
  const { driver } = useDriver();
  const { requisitions } = useRequisitions();
  const { allocations } = useAllocations();
  const { offDays } = useOffDays();
  const { routes } = useRoutes();
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
      <div>
        <h1 className="text-2xl font-semibold text-[#1E293B]">Dashboard</h1>

        <p className="mt-1 text-sm text-[#64748B]">
          Transport administration overview —{" "}
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

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
