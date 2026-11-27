import { describe, expect, it } from "vitest";
import { buildAccountStatusMessage } from "../../../src/domain/accountStatus.js";

const change = (overrides = {}) => ({
  activeChanged: false,
  isActive: true,
  roleChanged: false,
  role: "Applicant" as const,
  ...overrides,
});

describe("buildAccountStatusMessage (Part 1 §12.4 / §13)", () => {
  it("returns null when nothing relevant changed", () => {
    expect(buildAccountStatusMessage(change())).toBeNull();
    // The values are only read when the matching flag is set.
    expect(buildAccountStatusMessage(change({ isActive: false, role: "SuperAdmin" }))).toBeNull();
  });

  it("reports a deactivation", () => {
    expect(buildAccountStatusMessage(change({ activeChanged: true, isActive: false }))).toBe(
      "Your account was deactivated by a Super Admin.",
    );
  });

  it("reports a reactivation", () => {
    expect(buildAccountStatusMessage(change({ activeChanged: true, isActive: true }))).toBe(
      "Your account was reactivated by a Super Admin.",
    );
  });

  it("reports a role change with the new role", () => {
    expect(
      buildAccountStatusMessage(change({ roleChanged: true, role: "TransportInCharge" })),
    ).toBe("Your account was role changed to TransportInCharge by a Super Admin.");
  });

  it("joins both changes with ' and ', active state first (as the prototype did)", () => {
    expect(
      buildAccountStatusMessage(
        change({ activeChanged: true, isActive: true, roleChanged: true, role: "DepartmentHead" }),
      ),
    ).toBe("Your account was reactivated and role changed to DepartmentHead by a Super Admin.");
    expect(
      buildAccountStatusMessage(
        change({ activeChanged: true, isActive: false, roleChanged: true, role: "Applicant" }),
      ),
    ).toBe("Your account was deactivated and role changed to Applicant by a Super Admin.");
  });
});
