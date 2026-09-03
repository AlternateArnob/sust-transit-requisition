import { useState } from "react";

import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useVehicles from "../hooks/useVehicles";
import useOffDays from "../hooks/useOffDays";
import useRoutes from "../hooks/useRoutes";

import Modal from "../components/Modal";
import AllocationPicker from "../components/AllocationPicker";

import { detectConflicts, type Conflict } from "../utils/conflictUtils";

export default function ConflictsPage() {
  const { requisitions, rejectTrip } = useRequisitions();
  const { allocations, updateAllocation, removeAllocation } = useAllocations();
  const { vehicles } = useVehicles();
  const { offDays } = useOffDays();
  const { routes } = useRoutes();

  const [reassignConflict, setReassignConflict] = useState<Conflict | null>(
    null,
  );

  const conflicts = detectConflicts(
    allocations,
    requisitions,
    vehicles,
    offDays,
    routes,
  );

  function getVehicleLabel(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    return vehicle
      ? `${vehicle.registrationNumber} (${vehicle.category})`
      : "Unknown Vehicle";
  }

  function handleReject(conflict: Conflict) {
    const confirmed = window.confirm(
      "Reject this trip? It will be marked rejected and removed from allocation.",
    );

    if (!confirmed) {
      return;
    }

    rejectTrip(
      conflict.requisition.id,
      conflict.trip.id,
      "Schedule conflict",
      "Rejected due to a detected conflict",
    );
    removeAllocation(conflict.allocation.id);
  }

  function handleReassign(vehicleId: string, driverId?: string) {
    if (!reassignConflict) {
      return;
    }

    updateAllocation({
      ...reassignConflict.allocation,
      vehicleId,
      driverId,
      allocatedAt: new Date().toISOString(),
    });
    setReassignConflict(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1E293B]">Conflicts</h1>

        <p className="mt-1 text-sm text-[#64748B]">
          Automatically detected resource conflicts across current allocations
        </p>
      </div>

      {conflicts.length === 0 ? (
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center">
          <p className="font-medium text-[#1E293B]">No conflicts detected</p>

          <p className="mt-1 text-sm text-[#64748B]">
            All current allocations are clear of vehicle, off-day, and route
            conflicts.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="rounded-lg border border-[#E2E8F0] bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        conflict.severity === "Blocking"
                          ? "bg-[#FEE2E2] text-[#B91C1C]"
                          : "bg-[#FEF3C7] text-[#B45309]"
                      }`}
                    >
                      {conflict.severity}
                    </span>

                    <span className="text-sm font-medium text-[#1E293B]">
                      {conflict.type}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-[#64748B]">
                    {conflict.description}
                  </p>

                  <p className="mt-2 text-xs text-[#64748B]">
                    Source: {conflict.requisition.requesterName} —{" "}
                    {conflict.trip.date} {conflict.trip.startTime}–
                    {conflict.trip.endTime} ·{" "}
                    {getVehicleLabel(conflict.vehicleId)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    onClick={() => setReassignConflict(conflict)}
                    className="h-8 rounded-md border border-[#E2E8F0] px-3 text-xs font-medium text-[#334E68] hover:bg-[#F8FAFC]"
                  >
                    Reassign Vehicle
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReject(conflict)}
                    className="h-8 rounded-md border border-[#E2E8F0] px-3 text-xs font-medium text-[#B91C1C] hover:bg-[#F8FAFC]"
                  >
                    Reject Trip
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {reassignConflict && (
        <Modal
          title="Reassign Vehicle"
          onClose={() => setReassignConflict(null)}
          wide
        >
          <AllocationPicker
            trip={reassignConflict.trip}
            allocations={allocations}
            excludeAllocationId={reassignConflict.allocation.id}
            onSelect={handleReassign}
            onCancel={() => setReassignConflict(null)}
          />
        </Modal>
      )}
    </div>
  );
}
