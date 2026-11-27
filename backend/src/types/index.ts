import type {
  ApplicantProfile,
  ApplicationStatus,
  OffDayType,
  RequestedVehicleCategory,
  RequisitionType,
  TripStatus,
  VehicleCategory,
  VehicleOperationalStatus,
  Weekday,
} from "../config/constants.js";

// Plain, camelCase shapes that the pure domain functions (src/domain) work on.
// Dates are "YYYY-MM-DD" strings and times are "HH:mm" (or "HH:mm:ss") strings, exactly as MySQL
// returns DATE / TIME columns with `dateStrings: true`. No domain type depends on Express or Knex.

export interface TripLike {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: TripStatus;
  vehicleCategory: RequestedVehicleCategory;
}

export interface RequisitionLike {
  id: string;
  status: ApplicationStatus;
  requisitionType: RequisitionType;
  applicantProfile?: ApplicantProfile | null;
  trips: TripLike[];
}

export interface AllocationLike {
  id: string;
  requisitionId: string;
  tripId: string;
  vehicleId: string;
  driverId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
}

export interface VehicleLike {
  id: string;
  category: VehicleCategory;
  operationalStatus: VehicleOperationalStatus;
  availableForRequisition: boolean;
  permanentDriverId?: string | null;
}

export interface OffDayLike {
  vehicleId: string;
  type: OffDayType;
  /** Set for "One-time" off-days. */
  date?: string | null;
  /** Set for "Recurring" off-days. */
  weekday?: Weekday | null;
}

/** "Free after" time per weekday; a missing weekday means the vehicle is free all day. */
export type StudentTransportSchedule = Partial<Record<Weekday, string>>;

export interface StudentTransportEntryLike {
  vehicleId: string;
  schedule: StudentTransportSchedule;
}

export interface MileageEntryLike {
  requisitionId: string;
  tripId: string;
  distanceKm: number;
}

/** The trip data a duty slip snapshots for each trip. */
export interface DutySlipTripSnapshot {
  tripId: string;
  vehicleId?: string | null;
}

export interface DutySlipLike {
  trips: DutySlipTripSnapshot[];
}
