import { describe, expect, it } from "vitest";
import {
  canForwardToAdministrator,
  getTripsMissingVehicleAssignment,
  getVehicleEligibility,
  timeRangesOverlap,
  type EligibilityContext,
} from "../../../src/domain/vehicleEligibility.js";
import { allocation, offDay, requisition, trip, vehicle } from "../../helpers/builders.js";

describe("timeRangesOverlap", () => {
  it("back-to-back ranges do NOT overlap (09:00-11:00 and 11:00-13:00)", () => {
    expect(timeRangesOverlap("09:00", "11:00", "11:00", "13:00")).toBe(false);
    expect(timeRangesOverlap("11:00", "13:00", "09:00", "11:00")).toBe(false);
  });

  it("partially overlapping ranges overlap (09:00-11:00 and 10:00-12:00)", () => {
    expect(timeRangesOverlap("09:00", "11:00", "10:00", "12:00")).toBe(true);
    expect(timeRangesOverlap("10:00", "12:00", "09:00", "11:00")).toBe(true);
  });

  it("contained and identical ranges overlap", () => {
    expect(timeRangesOverlap("09:00", "13:00", "10:00", "11:00")).toBe(true);
    expect(timeRangesOverlap("10:00", "11:00", "09:00", "13:00")).toBe(true);
    expect(timeRangesOverlap("09:00", "11:00", "09:00", "11:00")).toBe(true);
  });

  it("disjoint ranges do not overlap", () => {
    expect(timeRangesOverlap("08:00", "09:00", "10:00", "11:00")).toBe(false);
  });

  it("understands HH:mm:ss as MySQL returns it (seconds are ignored; trip times are HH:mm)", () => {
    expect(timeRangesOverlap("09:00:00", "11:00:00", "11:00:00", "13:00:00")).toBe(false);
    expect(timeRangesOverlap("09:00:00", "11:00:00", "10:00:00", "12:00:00")).toBe(true);
  });
});

describe("getVehicleEligibility (Part 1 §11.6)", () => {
  const tripToAssign = trip({ date: "2026-10-22", startTime: "09:00", endTime: "11:00" }); // Thursday
  const empty: EligibilityContext = { allocations: [], offDays: [], studentTransport: [] };
  const check = (v = vehicle(), context: Partial<EligibilityContext> = {}, t = tripToAssign) =>
    getVehicleEligibility(v, t, { ...empty, ...context });

  it("a healthy, free vehicle is eligible with no blockers or warnings", () => {
    expect(check()).toEqual({ eligible: true, blockers: [], warnings: [] });
  });

  describe("blockers (each one alone)", () => {
    it("1a. vehicle under maintenance", () => {
      const result = check(vehicle({ operationalStatus: "Under Maintenance" }));
      expect(result.eligible).toBe(false);
      expect(result.blockers).toEqual(["Vehicle is Under Maintenance"]);
    });

    it("1b. vehicle out of service", () => {
      expect(check(vehicle({ operationalStatus: "Out-of-Service" })).blockers).toEqual([
        "Vehicle is Out-of-Service",
      ]);
    });

    it("1c. vehicle not available for requisition", () => {
      const result = check(vehicle({ availableForRequisition: false }));
      expect(result.eligible).toBe(false);
      expect(result.blockers).toEqual(["Vehicle is not available for requisition"]);
    });

    it("2. no permanent driver", () => {
      for (const permanentDriverId of [null, undefined, ""]) {
        const result = check(vehicle({ permanentDriverId }));
        expect(result.eligible).toBe(false);
        expect(result.blockers).toEqual(["No permanent driver assigned to this vehicle"]);
      }
    });

    it("3a. one-time off-day on the trip date", () => {
      const result = check(vehicle(), {
        offDays: [offDay({ type: "One-time", date: "2026-10-22" })],
      });
      expect(result.eligible).toBe(false);
      expect(result.blockers).toEqual(["Vehicle marked off-day on this date"]);
    });

    it("3b. recurring off-day on the trip's weekday", () => {
      const result = check(vehicle(), {
        offDays: [offDay({ type: "Recurring", date: null, weekday: "Thu" })],
      });
      expect(result.eligible).toBe(false);
      expect(result.blockers).toEqual(["Vehicle has a recurring off-day (every Thu)"]);
    });

    it("4. overlapping allocation of the same vehicle on the same date", () => {
      const result = check(vehicle(), {
        allocations: [allocation({ startTime: "10:00", endTime: "12:00" })],
      });
      expect(result.eligible).toBe(false);
      expect(result.blockers).toEqual(["Already allocated to another trip at an overlapping time"]);
    });

    it("5. student transport: trip starts before the vehicle is free", () => {
      const result = check(vehicle(), {
        studentTransport: [{ vehicleId: "veh-1", schedule: { Thu: "14:30" } }],
      });
      expect(result.eligible).toBe(false);
      expect(result.blockers).toHaveLength(1);
      expect(result.blockers[0]).toContain("2:30 PM");
      expect(result.blockers[0]).toContain("2026-10-22");
      expect(result.blockers[0]).toContain("not free yet");
    });
  });

  describe("things that must NOT block", () => {
    it("back-to-back trips on the same vehicle are allowed", () => {
      expect(
        check(vehicle(), { allocations: [allocation({ startTime: "11:00", endTime: "13:00" })] })
          .eligible,
      ).toBe(true);
      expect(
        check(vehicle(), { allocations: [allocation({ startTime: "07:00", endTime: "09:00" })] })
          .eligible,
      ).toBe(true);
    });

    it("an allocation of another vehicle or on another date does not block", () => {
      const context = {
        allocations: [allocation({ vehicleId: "veh-2" }), allocation({ date: "2026-10-23" })],
      };
      expect(check(vehicle(), context).eligible).toBe(true);
    });

    it("reassigning excludes the trip's own allocation", () => {
      const own = allocation({ startTime: "09:00", endTime: "11:00" });
      expect(check(vehicle(), { allocations: [own] }).eligible).toBe(false);
      expect(check(vehicle(), { allocations: [own], excludeAllocationId: own.id }).eligible).toBe(
        true,
      );
    });

    it("excluding one allocation still respects the others", () => {
      const own = allocation({ startTime: "09:00", endTime: "11:00" });
      const other = allocation({ startTime: "10:00", endTime: "12:00" });
      const result = check(vehicle(), { allocations: [own, other], excludeAllocationId: own.id });
      expect(result.eligible).toBe(false);
    });

    it("an off-day for another vehicle, another date or another weekday does not block", () => {
      const context = {
        offDays: [
          offDay({ vehicleId: "veh-2" }),
          offDay({ type: "One-time", date: "2026-10-23" }),
          offDay({ type: "Recurring", date: null, weekday: "Fri" }),
        ],
      };
      expect(check(vehicle(), context).eligible).toBe(true);
    });

    it("a trip starting exactly when the vehicle becomes free is allowed", () => {
      const context = { studentTransport: [{ vehicleId: "veh-1", schedule: { Thu: "09:00" } }] };
      expect(check(vehicle(), context).eligible).toBe(true);
    });

    it("a student-transport schedule on another weekday does not block", () => {
      const context = { studentTransport: [{ vehicleId: "veh-1", schedule: { Mon: "23:00" } }] };
      expect(check(vehicle(), context).eligible).toBe(true);
    });
  });

  describe("warning", () => {
    it("category mismatch is a warning only, never a blocker", () => {
      const result = check(
        vehicle({ category: "Microbus" }),
        {},
        trip({ vehicleCategory: "Hino Bus" }),
      );
      expect(result.eligible).toBe(true);
      expect(result.blockers).toEqual([]);
      expect(result.warnings).toEqual(["Category mismatch — requisition asked for Hino Bus"]);
    });

    it("no warning when the category matches or the trip asked for Any", () => {
      expect(
        check(vehicle({ category: "Jeep" }), {}, trip({ vehicleCategory: "Jeep" })).warnings,
      ).toEqual([]);
      expect(
        check(vehicle({ category: "Jeep" }), {}, trip({ vehicleCategory: "Any" })).warnings,
      ).toEqual([]);
    });
  });

  it("reports every blocker at once", () => {
    const result = check(
      vehicle({ operationalStatus: "Out-of-Service", permanentDriverId: null }),
      { offDays: [offDay({ type: "One-time", date: "2026-10-22" })] },
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers).toHaveLength(3);
  });

  it("a blocker and a warning can appear together", () => {
    const result = check(
      vehicle({ category: "Microbus", permanentDriverId: null }),
      {},
      trip({ vehicleCategory: "Jeep" }),
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });
});

describe("forwarding to the Administrator", () => {
  const t1 = trip({ id: "t1", status: "Pending" });
  const t2 = trip({ id: "t2", status: "Pending" });
  const r = requisition({ id: "TRS-2026-001", trips: [t1, t2] });
  const alloc = (tripId: string, requisitionId = "TRS-2026-001") =>
    allocation({ tripId, requisitionId });

  it("lists trips without an allocation", () => {
    expect(getTripsMissingVehicleAssignment(r, [alloc("t1")]).map((t) => t.id)).toEqual(["t2"]);
    expect(getTripsMissingVehicleAssignment(r, [])).toHaveLength(2);
  });

  it("rejected trips do not need a vehicle", () => {
    const rejected = requisition({
      trips: [trip({ id: "a", status: "Rejected" }), trip({ id: "b", status: "Pending" })],
    });
    expect(getTripsMissingVehicleAssignment(rejected, [alloc("b")])).toEqual([]);
  });

  it("allocations of another requisition do not count", () => {
    expect(
      getTripsMissingVehicleAssignment(r, [
        alloc("t1", "TRS-2026-999"),
        alloc("t2", "TRS-2026-999"),
      ]),
    ).toHaveLength(2);
  });

  it("can forward only when every non-rejected trip has an allocation", () => {
    expect(canForwardToAdministrator(r, [alloc("t1")])).toBe(false);
    expect(canForwardToAdministrator(r, [alloc("t1"), alloc("t2")])).toBe(true);
  });

  it("a requisition whose trips are all rejected can be forwarded vacuously", () => {
    const allRejected = requisition({ trips: [trip({ status: "Rejected" })] });
    expect(canForwardToAdministrator(allRejected, [])).toBe(true);
  });
});
