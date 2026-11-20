import type { Allocation, Vehicle } from "../types";

export function isVehicleOperationallyAvailable(vehicle: Vehicle): boolean {
  return vehicle.operationalStatus === "Active";
}

export function isVehicleEligibleForRequisition(vehicle: Vehicle): boolean {
  return (
    vehicle.operationalStatus === "Active" && vehicle.availableForRequisition
  );
}

export function isVehicleAvailable(vehicle: Vehicle): boolean {
  return isVehicleEligibleForRequisition(vehicle);
}

/**
 * Phase 2 (admin module) — FR-25 requires allocation/vehicle history to
 * survive later changes, but confirmation and duty slips resolve a
 * vehicle's registration/category by looking `allocation.vehicleId` up
 * in the live vehicle list (see utils/pdf/confirmationSlip.ts and
 * dutySlip.ts) rather than snapshotting it at allocation time. Deleting
 * a vehicle that any allocation ever referenced — not just a currently
 * "active" one — would silently blank those fields on historical slips.
 * Until slips snapshot vehicle details themselves, deletion must be
 * blocked whenever any allocation, past or present, references the
 * vehicle; "Out-of-Service" / not-available-for-requisition is the
 * correct way to retire a vehicle that has ever been used.
 */
export function hasAllocationHistory(
  vehicleId: string,
  allocations: Allocation[],
): boolean {
  return allocations.some((allocation) => allocation.vehicleId === vehicleId);
}

export function isDuplicateRegistration(
  vehicles: Vehicle[],
  registrationNumber: string,
  currentVehicleId?: string,
): boolean {
  const normalizedRegistration = registrationNumber.trim().toLowerCase();

  return vehicles.some(
    (vehicle) =>
      vehicle.id !== currentVehicleId &&
      vehicle.registrationNumber.trim().toLowerCase() ===
        normalizedRegistration,
  );
}
