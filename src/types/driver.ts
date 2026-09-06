export type DriverDesignation =
  | "Supervisor Driver"
  | "Senior Driver"
  | "Driver"
  | "Driver (Grade-1)"
  | "Driver (Outsourced)";

export type DriverStatus = "Active" | "Inactive";

/** Result of a vehicle<->driver assignment attempt (see useVehicleDriverAssignment). */
export interface AssignmentResult {
  success: boolean;
  message: string;
}

export interface Driver {
  id: string;
  name: string;
  designation: DriverDesignation;
  phone?: string;
  status: DriverStatus;
  permanentVehicleId?: string;
}
