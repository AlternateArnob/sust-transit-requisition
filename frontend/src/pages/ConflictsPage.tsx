import { useState } from "react";

import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useVehicles from "../hooks/useVehicles";
import useOffDays from "../hooks/useOffDays";
import useTransportSchedule from "../hooks/useTransportSchedule";

import Modal from "../components/Modal";
import AllocationPicker from "../components/AllocationPicker";

import { detectConflicts, type Conflict } from "../utils/conflictUtils";
import { reassignAllocation } from "../utils/allocationUtils";
import { buttonClass } from "../components/ui/buttonStyles";
import PageTitle from "../components/ui/PageTitle";

export default function ConflictsPage() {
  const { requisitions, rejectTrip } = useRequisitions();
  const { allocations, addAllocation, removeAllocation } = useAllocations();
  const { vehicles } = useVehicles();
  const { offDays } = useOffDays();
  const { routes } = useTransportSchedule();

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

    // Phase 8, §3 — new record, old one removed, instead of mutating
    // the same Allocation in place.
    removeAllocation(reassignConflict.allocation.id);
    addAllocation(
      reassignAllocation(reassignConflict.allocation, vehicleId, driverId),
    );
    setReassignConflict(null);
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Conflicts" subtitle="Automatically detected resource conflicts across current allocations" />

      {conflicts.length === 0 ? (
        <div className="rounded-lg border border-border bg-white shadow-sm p-8 text-center">
          <p className="font-medium text-text">No conflicts detected</p>

          <p className="mt-1 text-sm text-text-muted">
            All current allocations are clear of vehicle, off-day, and route
            conflicts.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="rounded-lg border border-border bg-white shadow-sm p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        conflict.severity === "Blocking"
                          ? "bg-error-bg text-error"
                          : "bg-warning-bg text-warning"
                      }`}
                    >
                      {conflict.severity}
                    </span>

                    <span className="text-sm font-medium text-text">
                      {conflict.type}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-text-muted">
                    {conflict.description}
                  </p>

                  <p className="mt-2 text-xs text-text-muted">
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
                    className="h-8 rounded-md border border-border px-3 text-xs font-medium text-secondary hover:bg-surface"
                  >
                    Reassign Vehicle
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReject(conflict)}
                    className={buttonClass("danger","sm")}
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
