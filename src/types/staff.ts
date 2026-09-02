export type DriverDesignation =
  | "Supervisor Driver"
  | "Senior Driver"
  | "Driver"
  | "Driver (Grade-1)"
  | "Driver (Outsourced)";

export type StaffStatus = "Active" | "Inactive";

export interface Staff {
  id: string;
  name: string;
  designation: DriverDesignation;
  phone?: string;
  status: StaffStatus;
  permanentVehicleId?: string;
}
