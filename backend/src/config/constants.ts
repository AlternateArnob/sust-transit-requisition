// Single source of truth for every enumeration (Part 1 §11.1 and the §10.2 ENUM columns).
// Zod schemas, services, migrations and tests all import from here.

export const REQUISITION_TYPES = ["Personal", "Departmental/Official", "Club"] as const;
export type RequisitionType = (typeof REQUISITION_TYPES)[number];

export const APPLICATION_STATUSES = [
  "Draft",
  "Pending Recommendation",
  "Information Requested",
  "Recommended",
  "Pending on Transport Office",
  "Pending Administrator",
  "Partially Approved",
  "Approved",
  "Completed",
  "Ready for Accounts",
  "Rejected",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const TRIP_STATUSES = ["Pending", "Approved", "Rejected", "Completed"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const REJECTION_REASONS = [
  "Vehicle unavailable",
  "Driver unavailable",
  "Schedule conflict",
  "Other",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

/** Sun = 0, matching JavaScript's Date#getDay. */
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

// `Eicher Bus` is not in the FRD list but exists in data; kept until the owner retires it (Part 1 §20).
export const VEHICLE_CATEGORIES = [
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
] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export const REQUESTED_VEHICLE_CATEGORIES = [...VEHICLE_CATEGORIES, "Any"] as const;
export type RequestedVehicleCategory = (typeof REQUESTED_VEHICLE_CATEGORIES)[number];

export const VEHICLE_OPERATIONAL_STATUSES = [
  "Active",
  "Under Maintenance",
  "Out-of-Service",
] as const;
export type VehicleOperationalStatus = (typeof VEHICLE_OPERATIONAL_STATUSES)[number];

export const DRIVER_DESIGNATIONS = [
  "Supervisor Driver",
  "Senior Driver",
  "Driver",
  "Driver (Grade-1)",
  "Driver (Outsourced)",
] as const;
export type DriverDesignation = (typeof DRIVER_DESIGNATIONS)[number];

export const DRIVER_STATUSES = ["Active", "Inactive"] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const USER_ROLES = [
  "Applicant",
  "DepartmentHead",
  "TransportInCharge",
  "TransportAdministrator",
  "SuperAdmin",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const APPLICANT_PROFILES = ["Teacher", "Student", "Officer"] as const;
export type ApplicantProfile = (typeof APPLICANT_PROFILES)[number];

export const DIRECTORY_KINDS = ["Department", "Office"] as const;
export type DirectoryKind = (typeof DIRECTORY_KINDS)[number];

export const OFF_DAY_TYPES = ["One-time", "Recurring"] as const;
export type OffDayType = (typeof OFF_DAY_TYPES)[number];

export const OTP_PURPOSES = ["registration", "resume"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const FILE_PURPOSES = ["signature", "supporting_document"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export const ALLOCATION_EVENTS = [
  "assigned",
  "reassigned",
  "removed",
  "released_on_reject",
  "released_on_send_back",
] as const;
export type AllocationEvent = (typeof ALLOCATION_EVENTS)[number];

// --- HTTP / operational limits ---
export const REQUEST_BODY_LIMIT = "100kb";
export const GLOBAL_RATE_LIMIT = { windowMs: 60_000, limit: 300 } as const;
export const DB_HEALTH_TIMEOUT_MS = 2_000;
export const SHUTDOWN_TIMEOUT_MS = 10_000;

// --- Domain rules (Part 1 §11, §20) ---
/** "Today", application-number year and dashboard "today" all use the university's time zone. */
export const APP_TIME_ZONE = "Asia/Dhaka";
/** A trip may hold a vehicle for at most this many hours (and may not cross midnight). */
export const MAX_TRIP_HOURS = 3;

/** Part 1 §8.1: after this many consecutive wrong passwords the account is locked for a while. */
export const LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MINUTES = 15;

/** Part 1 §8.4: /auth/refresh and /auth/logout require this header (a cheap CSRF defence). */
export const CSRF_HEADER = "x-requested-with";
export const CSRF_HEADER_VALUE = "fetch";

/**
 * Part 1 §16.2: the development-only password of the seeded accounts. The seed refuses to run in
 * production while `SEED_ADMIN_PASSWORD` still has this value.
 */
export const DEFAULT_SEED_ADMIN_PASSWORD = "Admin@123";
