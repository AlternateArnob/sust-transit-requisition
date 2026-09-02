export { VEHICLE_CATEGORIES, VEHICLE_STATUSES } from "./vehicle";

export type { Vehicle, VehicleCategory, VehicleStatus } from "./vehicle";

export type { DriverDesignation, Staff, StaffStatus } from "./staff";

export { WEEKDAYS, ROUTE_SLOTS } from "./route";

export type { Weekday, RouteSlot, RecurringRoute } from "./route";
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

export const DRIVER_DESIGNATIONS = [
  "Supervisor Driver",
  "Senior Driver",
  "Driver",
  "Driver (Grade-1)",
  "Driver (Outsourced)",
] as const;

export const STAFF_STATUSES = ["Active", "Inactive"] as const;
