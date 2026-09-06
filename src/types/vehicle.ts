/**
 * Phase 2 (admin module) — FRD §12's category list has no "Eicher Bus".
 * Kept here rather than silently dropped: existing seed/demo vehicle
 * records may already reference it, and removing the value would break
 * their category field and any select bound to it. Flagged for the
 * product owner to confirm whether it should be retired or the FRD
 * amended — do not remove without that decision.
 */
export type VehicleCategory =
  | "Jeep"
  | "Car"
  | "Mitsubishi Bus"
  | "Hino Bus"
  | "Tata Bus"
  | "Eicher Bus"
  | "Minibus"
  | "Minibus A/C"
  | "Microbus"
  | "Pickup";

export type VehicleStatus = "Active" | "Under Maintenance" | "Out-of-Service";

export interface Vehicle {
  id: string;

  registrationNumber: string;

  category: VehicleCategory;

  fuelType?: string;

  operationalStatus: VehicleStatus;

  reservedFor?: string;

  availableForRequisition: boolean;

  // Permanent driver assigned to this vehicle
  permanentDriverId?: string;
}

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  "Jeep",
  "Car",
  "Mitsubishi Bus",
  "Hino Bus",
  "Tata Bus",
  "Eicher Bus",
  "Minibus",
  "Minibus A/C",
  "Microbus",
  "Pickup",
];

export const VEHICLE_STATUSES: VehicleStatus[] = [
  "Active",
  "Under Maintenance",
  "Out-of-Service",
];
