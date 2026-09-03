export { VEHICLE_CATEGORIES, VEHICLE_STATUSES } from "./vehicle";

export type { Vehicle, VehicleCategory, VehicleStatus } from "./vehicle";

export type { DriverDesignation, Driver, DriverStatus } from "./driver";

export { WEEKDAYS } from "./route";

export type {
  Weekday,
  StudentTransportVehicle,
  StudentTransportSchedule,
} from "./route";
export type { MileageEntry } from "./mileage";
export type { OffDayType, VehicleOffDay } from "./offday";
export type { Allocation } from "./allocation";
export type { NotificationType, AppNotification } from "./notification";
export type { DutySlip, DutySlipTripSnapshot } from "./dutySlip";

export {
  REQUISITION_TYPES,
  APPLICANT_TYPES,
  REJECTION_REASONS,
} from "./requisition";

export type {
  RequisitionType,
  ApplicantType,
  ApplicationStatus,
  TripStatus,
  ScheduleType,
  RejectionReason,
  Requisition,
} from "./requisition";

export type { Trip } from "./trip";

export {
  APPLICANT_PROFILES,
  LOCKED_PROFILE_FIELDS_BY_ROLE,
} from "./user";

export type { ApplicantProfile as UserProfile, UserRole, UserAccount } from "./user";

export { OTP_LENGTH, OTP_EXPIRY_MS, OTP_MAX_ATTEMPTS } from "./otp";
export type { OtpChallenge } from "./otp";

export const DRIVER_DESIGNATIONS = [
  "Supervisor Driver",
  "Senior Driver",
  "Driver",
  "Driver (Grade-1)",
  "Driver (Outsourced)",
] as const;

export const DRIVER_STATUSES = ["Active", "Inactive"] as const;
