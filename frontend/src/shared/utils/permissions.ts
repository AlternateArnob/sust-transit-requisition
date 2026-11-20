import type { UserRole } from "@/types";

/**
 * Capability-based permissions for the Transport Office roles.
 *
 * The rest of the app should call these instead of comparing
 * `currentUser.role === "..."` directly, so that if the permission
 * matrix changes later (e.g. Super Admin gains an operational power),
 * there's exactly one place to update instead of hunting through every
 * page. See the admin-module implementation plan, §2, for the source
 * matrix this file encodes.
 */

export const ADMIN_ROLES = ["TransportInCharge", "TransportAdministrator", "SuperAdmin"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Roles that share the /admin layout (Transport Office roles + the
 *  DepartmentHead recommender, who reuses the same shell for their inbox). */
export const ADMIN_LAYOUT_ROLES: ReadonlyArray<UserRole> = [...ADMIN_ROLES, "DepartmentHead"];

export function isAdminRole(role: UserRole | undefined): role is AdminRole {
  return role === "TransportInCharge" || role === "TransportAdministrator" || role === "SuperAdmin";
}

export function isTransportInCharge(role: UserRole | undefined): boolean {
  return role === "TransportInCharge";
}

export function isTransportAdministrator(role: UserRole | undefined): boolean {
  return role === "TransportAdministrator";
}

export function isSuperAdmin(role: UserRole | undefined): boolean {
  return role === "SuperAdmin";
}

// ---------------------------------------------------------------------
// Vehicle / driver / schedule / off-day management — all three Transport
// Office roles can do this (FRD §9, §12, §13, §15, §16).
// ---------------------------------------------------------------------
export function canManageVehicles(role: UserRole | undefined): boolean {
  return isAdminRole(role);
}

export function canManageDrivers(role: UserRole | undefined): boolean {
  return isAdminRole(role);
}

export function canManageSchedule(role: UserRole | undefined): boolean {
  return isAdminRole(role);
}

export function canManageOffDays(role: UserRole | undefined): boolean {
  return isAdminRole(role);
}

// ---------------------------------------------------------------------
// Requisition workflow — split between Transport In Charge and Transport
// Administrator (FRD §9, §19). Super Admin is oversight-only here.
// RequisitionsPage renders one of three modes per requisition based on
// these. The standalone AllocationPage was retired once its "Needs
// Allocation" tab became unreachable.
// ---------------------------------------------------------------------
export function canAssignVehicleAndForward(role: UserRole | undefined): boolean {
  return isTransportInCharge(role);
}

export function canSendBackToApplicant(role: UserRole | undefined): boolean {
  return isTransportInCharge(role);
}

export function canSendBackToTransportInCharge(role: UserRole | undefined): boolean {
  return isTransportAdministrator(role);
}

// ---------------------------------------------------------------------
// Trip completion / mileage — Transport Office operational staff
// (TIC or Administrator); Super Admin is view-only (FRD §22, §23).
//
// Note: two unused helpers were removed from just above this block —
// `canFinalApprove` (referenced the retired "Final Approve" step) and a `canGenerateSlips(role)` that name-collided
// with dutySlipUtils.ts's actually-used `canGenerateSlips(requisition)`.
// Neither had any callers.
// ---------------------------------------------------------------------
export function canMarkTripCompleted(role: UserRole | undefined): boolean {
  return isTransportInCharge(role) || isTransportAdministrator(role);
}

export function canRecordMileage(role: UserRole | undefined): boolean {
  return isTransportInCharge(role) || isTransportAdministrator(role);
}

// ---------------------------------------------------------------------
// Super Admin — account administration and audit oversight (FRD §2, §25).
// Used by the route guards and nav to tell Super Admin apart from the
// other two roles.
// ---------------------------------------------------------------------
export function canManageUserAccounts(role: UserRole | undefined): boolean {
  return isSuperAdmin(role);
}

export function isOperationsViewOnly(role: UserRole | undefined): boolean {
  return isSuperAdmin(role);
}
