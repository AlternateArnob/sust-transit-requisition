import type { Vehicle } from "../types";

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
