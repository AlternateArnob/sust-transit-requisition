import { Link } from "react-router-dom";
import useVehicles from "@/features/fleet/hooks/useVehicles";
import useDrivers from "@/features/fleet/hooks/useDrivers";
import useRequisitions from "@/features/requisitions/hooks/useRequisitions";
import useAllocations from "@/features/requisitions/hooks/useAllocations";
import useOffDays from "@/features/fleet/hooks/useOffDays";
import useTransportSchedule from "@/features/fleet/hooks/useTransportSchedule";
import useNotifications from "@/features/notifications/hooks/useNotifications";
import StatCard from "@/shared/ui/StatCard";
import { isInActiveQueue } from "@/features/requisitions/utils/requisitionUtils";
import { detectConflicts } from "@/features/conflicts/utils/conflictUtils";
import { todayString } from "@/features/fleet/utils/scheduleUtils";
import DashboardHeader from "./DashboardHeader";

export default function TransportInChargeDashboard() {
  const { vehicles } = useVehicles();
  const { drivers } = useDrivers();
  const { requisitions } = useRequisitions();
  const { allocations } = useAllocations();
  const { offDays } = useOffDays();
  const { schedules } = useTransportSchedule();
  const { unreadCount } = useNotifications();

  const today = todayString();

  const activeVehicles = vehicles.filter(
    (vehicle) => vehicle.operationalStatus === "Active",
  ).length;

  const underMaintenance = vehicles.filter(
    (vehicle) => vehicle.operationalStatus === "Under Maintenance",
  ).length;

  const todaysAllocations = allocations.filter((allocation) => allocation.date === today);

  const pendingRequisitions = requisitions.filter(isInActiveQueue).length;

  const conflicts = detectConflicts(allocations, requisitions, vehicles, offDays, schedules);
  const blockingConflicts = conflicts.filter((conflict) => conflict.severity === "Blocking").length;

  const activeDrivers = drivers.filter((member) => member.status === "Active").length;

  function getVehicleLabel(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    return vehicle ? `${vehicle.registrationNumber} (${vehicle.category})` : "Unknown Vehicle";
  }

  function getDriverName(driverId?: string) {
    if (!driverId) {
      return "No driver";
    }

    return drivers.find((member) => member.id === driverId)?.name ?? "Unknown Driver";
  }

  return (
    <div className="space-y-6">
      <DashboardHeader subtitle="Transport administration overview" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Vehicle" value={vehicles.length} href="/admin/vehicle" />
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
        <StatCard label="Unread Notifications" value={unreadCount} href="/admin/notifications" />
        <StatCard label="Active Drivers" value={activeDrivers} href="/admin/driver" />
      </div>

      {/* Detail panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Allocations */}
        <div className="rounded-lg border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <p className="text-sm font-medium text-text">Today's Allocations</p>

            <Link
              to="/admin/requisitions"
              className="text-xs font-medium text-secondary hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-border">
            {todaysAllocations.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-text-muted">
                No allocations scheduled for today.
              </p>
            ) : (
              todaysAllocations.slice(0, 5).map((allocation) => (
                <div key={allocation.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-text">
                    {allocation.startTime}–{allocation.endTime} ·{" "}
                    {getVehicleLabel(allocation.vehicleId)}
                  </p>

                  <p className="mt-0.5 text-xs text-text-muted">
                    Driver: {getDriverName(allocation.driverId)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Conflicts */}
        <div className="rounded-lg border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <p className="text-sm font-medium text-text">Active Conflicts</p>

            <Link
              to="/admin/conflicts"
              className="text-xs font-medium text-secondary hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-border">
            {conflicts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-text-muted">
                No conflicts detected.
              </p>
            ) : (
              conflicts.slice(0, 5).map((conflict) => (
                <div key={conflict.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        conflict.severity === "Blocking"
                          ? "bg-error-bg text-error"
                          : "bg-warning-bg text-warning"
                      }`}
                    >
                      {conflict.severity}
                    </span>

                    <p className="text-sm font-medium text-text">{conflict.type}</p>
                  </div>

                  <p className="mt-1 text-xs text-text-muted">{conflict.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
