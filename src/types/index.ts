export { VEHICLE_CATEGORIES, VEHICLE_STATUSES } from "./vehicle";

export type { Vehicle, VehicleCategory, VehicleStatus } from "./vehicle";

export type {
  DriverDesignation,
  Driver,
  DriverStatus,
  AssignmentResult,
} from "./driver";

export { WEEKDAYS } from "./schedule";

export type {
  Weekday,
  StudentTransportVehicle,
  StudentTransportSchedule,
} from "./schedule";
export type { MileageEntry } from "./mileage";
export type { OffDayType, VehicleOffDay } from "./offday";
export type { Allocation } from "./allocation";
export type { NotificationType, AppNotification } from "./notification";
export type { DutySlip, DutySlipTripSnapshot } from "./dutySlip";

export {
  REQUISITION_TYPES,
  REJECTION_REASONS,
} from "./requisition";

export type {
  RequisitionType,
  ApplicationStatus,
  TripStatus,
  ScheduleType,
  RejectionReason,
  Requisition,
} from "./requisition";

export type { Trip, RequestedVehicleCategory } from "./trip";
export type { TripDraft } from "./tripDraft";
export { createEmptyTripDraft } from "./tripDraft";

export {
  APPLICANT_PROFILES,
  LOCKED_PROFILE_FIELDS_BY_ROLE,
} from "./user";

export type { ApplicantProfile, UserRole, UserAccount } from "./user";

export { OTP_LENGTH, OTP_EXPIRY_MS, OTP_MAX_ATTEMPTS } from "./otp";
export type { OtpChallenge } from "./otp";

/**
 * Phase 2 (admin module) — FRD §11 lists Senior Driver / Driver / Driver
 * (Grade-1) / Driver (Outsourced) only, with no "Supervisor Driver".
 * Kept here rather than silently dropped for the same reason as
 * VehicleCategory's "Eicher Bus" (types/vehicle.ts) — existing driver
 * records may reference it. Flag to the product owner before removing.
 */
export const DRIVER_DESIGNATIONS = [
  "Supervisor Driver",
  "Senior Driver",
  "Driver",
  "Driver (Grade-1)",
  "Driver (Outsourced)",
] as const;

export const DRIVER_STATUSES = ["Active", "Inactive"] as const;
