export type DriverDesignation =
  | "Supervisor Driver"
  | "Senior Driver"
  | "Driver"
  | "Driver (Grade-1)"
  | "Driver (Outsourced)";

export type DriverStatus = "Active" | "Inactive";

export interface Driver {
  id: string;
  name: string;
  designation: DriverDesignation;
  phone?: string;
  status: DriverStatus;
  permanentVehicleId?: string;
}
