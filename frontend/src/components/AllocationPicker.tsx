import useVehicles from "../hooks/useVehicles";
import useDriver from "../hooks/useDriver";
import useTransportSchedule from "../hooks/useTransportSchedule";
import useOffDays from "../hooks/useOffDays";

import { getVehicleEligibility } from "../utils/allocationUtils";
import type { Trip, Allocation } from "../types";
import { buttonClass } from "./ui/buttonStyles";

interface AllocationPickerProps {
  trip: Trip;
  allocations: Allocation[];
  excludeAllocationId?: string;
  onSelect: (vehicleId: string, driverId?: string) => void;
  onCancel: () => void;
}

export default function AllocationPicker({
  trip,
  allocations,
  excludeAllocationId,
  onSelect,
  onCancel,
}: AllocationPickerProps) {
  const { vehicles } = useVehicles();
  const { driver } = useDriver();
  const { routes } = useTransportSchedule();
  const { offDays } = useOffDays();

  const evaluated = vehicles
    .filter(
      (vehicle) =>
        trip.vehicleCategory === "Any" || vehicle.category === trip.vehicleCategory,
    )
    .map((vehicle) =>
      getVehicleEligibility(vehicle, trip, {
        allocations,
        offDays,
        routes,
        excludeAllocationId,
      }),
    )
    .filter((result) => result.eligible);

  function getDriverName(driverId?: string) {
    if (!driverId) {
      return undefined;
    }

    return driver.find((member) => member.id === driverId)?.name;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-surface p-3 text-sm text-text">
        <p className="font-medium">
          {trip.date} · {trip.startTime}–{trip.endTime} · {trip.vehicleCategory}
        </p>

        <p className="mt-1 text-text-muted">{trip.route}</p>
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto">
        {evaluated.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
            No vehicles found.
          </p>
        )}

        {evaluated.map(({ vehicle, eligible, blockers, warnings }) => (
          <div
            key={vehicle.id}
            className={`rounded-md border px-4 py-3 ${
              eligible
                ? "border-border bg-white"
                : "border-border bg-surface opacity-60"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text">
                  {vehicle.registrationNumber} — {vehicle.category}
                </p>

                <p className="text-xs text-text-muted">
                  Driver: {getDriverName(vehicle.permanentDriverId) ?? "None"}
                </p>
              </div>

              <button
                type="button"
                disabled={!eligible}
                onClick={() => onSelect(vehicle.id, vehicle.permanentDriverId)}
                className={`h-8 shrink-0 rounded-md px-3 text-xs font-medium ${
                  eligible
                    ? "bg-primary text-white hover:bg-secondary"
                    : "cursor-not-allowed bg-border text-text-muted"
                }`}
              >
                Select
              </button>
            </div>

            {blockers.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {blockers.map((blocker) => (
                  <li key={blocker} className="text-xs text-error">
                    ✕ {blocker}
                  </li>
                ))}
              </ul>
            )}

            {warnings.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {warnings.map((warning) => (
                  <li key={warning} className="text-xs text-warning">
                    ⚠ {warning}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={onCancel}
          className={buttonClass("secondary")}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}