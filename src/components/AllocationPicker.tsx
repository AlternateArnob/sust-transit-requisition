import { useState } from "react";

import useVehicles from "../hooks/useVehicles";
import useStaff from "../hooks/useStaff";
import useRoutes from "../hooks/useRoutes";
import useOffDays from "../hooks/useOffDays";

import { getVehicleEligibility } from "../utils/allocationUtils";
import type { Trip, Allocation } from "../types";

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
  const { staff } = useStaff();
  const { routes } = useRoutes();
  const { offDays } = useOffDays();

  const [showAllCategories, setShowAllCategories] = useState(false);

  const candidateVehicles = showAllCategories
    ? vehicles
    : vehicles.filter((vehicle) => vehicle.category === trip.vehicleCategory);

  const evaluated = candidateVehicles
    .map((vehicle) =>
      getVehicleEligibility(vehicle, trip, {
        allocations,
        offDays,
        routes,
        excludeAllocationId,
      }),
    )
    .sort((a, b) => Number(b.eligible) - Number(a.eligible));

  function getDriverName(driverId?: string) {
    if (!driverId) {
      return undefined;
    }

    return staff.find((member) => member.id === driverId)?.name;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#1E293B]">
        <p className="font-medium">
          {trip.date} · {trip.startTime}–{trip.endTime} · {trip.vehicleCategory}
        </p>

        <p className="mt-1 text-[#64748B]">{trip.route}</p>
      </div>

      <label className="flex items-center gap-2 text-sm text-[#1E293B]">
        <input
          type="checkbox"
          checked={showAllCategories}
          onChange={(event) => setShowAllCategories(event.target.checked)}
        />
        Show vehicles of all categories (not just {trip.vehicleCategory})
      </label>

      <div className="max-h-96 space-y-2 overflow-y-auto">
        {evaluated.length === 0 && (
          <p className="rounded-md border border-dashed border-[#E2E8F0] px-4 py-6 text-center text-sm text-[#64748B]">
            No vehicles found.
          </p>
        )}

        {evaluated.map(({ vehicle, eligible, blockers, warnings }) => (
          <div
            key={vehicle.id}
            className={`rounded-md border px-4 py-3 ${
              eligible
                ? "border-[#E2E8F0] bg-white"
                : "border-[#E2E8F0] bg-[#F8FAFC] opacity-60"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#1E293B]">
                  {vehicle.registrationNumber} — {vehicle.category}
                </p>

                <p className="text-xs text-[#64748B]">
                  Driver: {getDriverName(vehicle.permanentDriverId) ?? "None"}
                </p>
              </div>

              <button
                type="button"
                disabled={!eligible}
                onClick={() => onSelect(vehicle.id, vehicle.permanentDriverId)}
                className={`h-8 shrink-0 rounded-md px-3 text-xs font-medium ${
                  eligible
                    ? "bg-[#0F2747] text-white hover:bg-[#334E68]"
                    : "cursor-not-allowed bg-[#E2E8F0] text-[#64748B]"
                }`}
              >
                Select
              </button>
            </div>

            {blockers.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {blockers.map((blocker) => (
                  <li key={blocker} className="text-xs text-[#B91C1C]">
                    ✕ {blocker}
                  </li>
                ))}
              </ul>
            )}

            {warnings.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {warnings.map((warning) => (
                  <li key={warning} className="text-xs text-[#B45309]">
                    ⚠ {warning}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end border-t border-[#E2E8F0] pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}