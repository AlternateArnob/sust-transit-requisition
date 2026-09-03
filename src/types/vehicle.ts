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
