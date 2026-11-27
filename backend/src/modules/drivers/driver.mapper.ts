import type { DriverDesignation, DriverStatus } from "../../config/constants.js";

/** A `drivers` row, joined with the vehicle that names it as permanent driver (if any). */
export interface DriverRow {
  id: string;
  name: string;
  designation: DriverDesignation;
  phone: string | null;
  status: DriverStatus;
  permanent_vehicle_id: string | null;
}

/** The driver as the API returns it (Part 1 §12.6). Empty optional fields are left out. */
export interface DriverDto {
  id: string;
  name: string;
  designation: DriverDesignation;
  phone?: string;
  status: DriverStatus;
  /** Computed from `vehicles.permanent_driver_id`; there is no column for it on `drivers`. */
  permanentVehicleId?: string;
}

export function toDriverDto(row: DriverRow): DriverDto {
  return {
    id: row.id,
    name: row.name,
    designation: row.designation,
    ...(row.phone ? { phone: row.phone } : {}),
    status: row.status,
    ...(row.permanent_vehicle_id ? { permanentVehicleId: row.permanent_vehicle_id } : {}),
  };
}
