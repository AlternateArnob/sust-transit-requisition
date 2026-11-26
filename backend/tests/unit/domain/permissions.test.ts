import { describe, expect, it } from "vitest";
import { USER_ROLES, type UserRole } from "../../../src/config/constants.js";
import * as permissions from "../../../src/domain/permissions.js";

const TIC: UserRole = "TransportInCharge";
const TA: UserRole = "TransportAdministrator";
const SA: UserRole = "SuperAdmin";

// capability -> exactly the roles that hold it (Part 1 §4 permission matrix).
const MATRIX: Record<string, { fn: (role: UserRole | undefined) => boolean; allowed: UserRole[] }> =
  {
    isAdminRole: { fn: permissions.isAdminRole, allowed: [TIC, TA, SA] },
    isTransportInCharge: { fn: permissions.isTransportInCharge, allowed: [TIC] },
    isTransportAdministrator: { fn: permissions.isTransportAdministrator, allowed: [TA] },
    isSuperAdmin: { fn: permissions.isSuperAdmin, allowed: [SA] },
    canManageVehicles: { fn: permissions.canManageVehicles, allowed: [TIC, TA, SA] },
    canManageDrivers: { fn: permissions.canManageDrivers, allowed: [TIC, TA, SA] },
    canManageSchedule: { fn: permissions.canManageSchedule, allowed: [TIC, TA, SA] },
    canManageOffDays: { fn: permissions.canManageOffDays, allowed: [TIC, TA, SA] },
    canAssignVehicleAndForward: { fn: permissions.canAssignVehicleAndForward, allowed: [TIC] },
    canSendBackToApplicant: { fn: permissions.canSendBackToApplicant, allowed: [TIC] },
    canSendBackToTransportInCharge: {
      fn: permissions.canSendBackToTransportInCharge,
      allowed: [TA],
    },
    canMarkTripCompleted: { fn: permissions.canMarkTripCompleted, allowed: [TIC, TA] },
    canRecordMileage: { fn: permissions.canRecordMileage, allowed: [TIC, TA] },
    canManageUserAccounts: { fn: permissions.canManageUserAccounts, allowed: [SA] },
    isOperationsViewOnly: { fn: permissions.isOperationsViewOnly, allowed: [SA] },
    canDownloadDriverSlip: { fn: permissions.canDownloadDriverSlip, allowed: [TIC, TA] },
    canGenerateDutySlip: { fn: permissions.canGenerateDutySlip, allowed: [TA] },
  };

describe("permission matrix", () => {
  for (const [name, { fn, allowed }] of Object.entries(MATRIX)) {
    it(`${name} is granted to exactly: ${allowed.join(", ")}`, () => {
      for (const role of USER_ROLES) {
        expect(fn(role), `${name}(${role})`).toBe(allowed.includes(role));
      }
      expect(fn(undefined), `${name}(undefined)`).toBe(false);
    });
  }

  it("never lets Applicants or Department Heads do Transport Office work", () => {
    for (const role of ["Applicant", "DepartmentHead"] as const) {
      expect(permissions.isAdminRole(role)).toBe(false);
      expect(permissions.canManageVehicles(role)).toBe(false);
      expect(permissions.canMarkTripCompleted(role)).toBe(false);
    }
  });

  it("keeps Super Admin out of every operational action (oversight only)", () => {
    expect(permissions.canAssignVehicleAndForward(SA)).toBe(false);
    expect(permissions.canSendBackToApplicant(SA)).toBe(false);
    expect(permissions.canSendBackToTransportInCharge(SA)).toBe(false);
    expect(permissions.canMarkTripCompleted(SA)).toBe(false);
    expect(permissions.canRecordMileage(SA)).toBe(false);
    expect(permissions.canGenerateDutySlip(SA)).toBe(false);
  });

  it("keeps In-Charge and Administrator duties apart", () => {
    expect(permissions.canAssignVehicleAndForward(TA)).toBe(false);
    expect(permissions.canSendBackToTransportInCharge(TIC)).toBe(false);
    expect(permissions.canGenerateDutySlip(TIC)).toBe(false);
  });

  it("lists the three Transport Office roles", () => {
    expect([...permissions.ADMIN_ROLES]).toEqual([TIC, TA, SA]);
  });
});
