import type { UserRole } from "../config/constants.js";

/**
 * Capability-based permissions for the Transport Office roles (port of the frontend's
 * shared/utils/permissions.ts). Services call these instead of comparing `role === "..."`
 * so a change to the permission matrix happens in exactly one place.
 */

export const ADMIN_ROLES = ["TransportInCharge", "TransportAdministrator", "SuperAdmin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

type MaybeRole = UserRole | undefined;

export function isAdminRole(role: MaybeRole): role is AdminRole {
  return role === "TransportInCharge" || role === "TransportAdministrator" || role === "SuperAdmin";
}

export const isTransportInCharge = (role: MaybeRole): boolean => role === "TransportInCharge";
export const isTransportAdministrator = (role: MaybeRole): boolean =>
  role === "TransportAdministrator";
export const isSuperAdmin = (role: MaybeRole): boolean => role === "SuperAdmin";

// Vehicle / driver / schedule / off-day management: all three Transport Office roles.
export const canManageVehicles = (role: MaybeRole): boolean => isAdminRole(role);
export const canManageDrivers = (role: MaybeRole): boolean => isAdminRole(role);
export const canManageSchedule = (role: MaybeRole): boolean => isAdminRole(role);
export const canManageOffDays = (role: MaybeRole): boolean => isAdminRole(role);

// Requisition workflow: split between In-Charge and Administrator. Super Admin is oversight only.
export const canAssignVehicleAndForward = (role: MaybeRole): boolean => isTransportInCharge(role);
export const canSendBackToApplicant = (role: MaybeRole): boolean => isTransportInCharge(role);
export const canSendBackToTransportInCharge = (role: MaybeRole): boolean =>
  isTransportAdministrator(role);

// Trip completion / mileage: operational staff (TIC or Administrator); Super Admin is view-only.
export const canMarkTripCompleted = (role: MaybeRole): boolean =>
  isTransportInCharge(role) || isTransportAdministrator(role);
export const canRecordMileage = (role: MaybeRole): boolean =>
  isTransportInCharge(role) || isTransportAdministrator(role);

// Super Admin: account administration and audit oversight.
export const canManageUserAccounts = (role: MaybeRole): boolean => isSuperAdmin(role);
export const isOperationsViewOnly = (role: MaybeRole): boolean => isSuperAdmin(role);

// Slips (Part 1 §12): the In-Charge may download a driver slip; only the Administrator generates
// (and regenerates, superseding the old one) a duty slip.
export const canDownloadDriverSlip = (role: MaybeRole): boolean =>
  isTransportInCharge(role) || isTransportAdministrator(role);
export const canGenerateDutySlip = (role: MaybeRole): boolean => isTransportAdministrator(role);
