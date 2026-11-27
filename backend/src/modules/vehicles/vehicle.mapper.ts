import type {
  DriverDesignation,
  DriverStatus,
  VehicleCategory,
  VehicleOperationalStatus,
} from "../../config/constants.js";

/** A `vehicles` row joined with its permanent driver (if any). */
export interface VehicleRow {
  id: string;
  registration_number: string;
  category: VehicleCategory;
  fuel_type: string | null;
  operational_status: VehicleOperationalStatus;
  available_for_requisition: number | boolean;
  permanent_driver_id: string | null;
  driver_name: string | null;
  driver_designation: DriverDesignation | null;
  driver_phone: string | null;
  driver_status: DriverStatus | null;
}

/** Part 1 §12.5. There is deliberately no `reservedFor`. */
export interface VehicleDto {
  id: string;
  registrationNumber: string;
  category: VehicleCategory;
  fuelType?: string;
  operationalStatus: VehicleOperationalStatus;
  availableForRequisition: boolean;
  permanentDriverId?: string;
}

export interface DriverSummary {
  id: string;
  name: string;
  designation: DriverDesignation;
  phone?: string;
  status: DriverStatus;
}

export interface VehicleDetailDto extends VehicleDto {
  permanentDriver?: DriverSummary;
}

export function toVehicleDto(row: VehicleRow): VehicleDto {
  return {
    id: row.id,
    registrationNumber: row.registration_number,
    category: row.category,
    ...(row.fuel_type ? { fuelType: row.fuel_type } : {}),
    operationalStatus: row.operational_status,
    availableForRequisition: Boolean(row.available_for_requisition),
    ...(row.permanent_driver_id ? { permanentDriverId: row.permanent_driver_id } : {}),
  };
}

export function toVehicleDetailDto(row: VehicleRow): VehicleDetailDto {
  const dto: VehicleDetailDto = toVehicleDto(row);
  if (row.permanent_driver_id && row.driver_name && row.driver_designation && row.driver_status) {
    dto.permanentDriver = {
      id: row.permanent_driver_id,
      name: row.driver_name,
      designation: row.driver_designation,
      ...(row.driver_phone ? { phone: row.driver_phone } : {}),
      status: row.driver_status,
    };
  }
  return dto;
}
