import { describe, expect, it } from "vitest";
import { getEligibleDutySlipGroups, isDutySlipStale } from "../../../src/domain/slips.js";
import { allocation, requisition, trip } from "../../helpers/builders.js";

describe("getEligibleDutySlipGroups", () => {
  it("includes only Approved trips that have an allocation with a driver", () => {
    const approved = trip({ id: "approved", status: "Approved" });
    const r = requisition({
      trips: [
        approved,
        trip({ id: "pending", status: "Pending" }),
        trip({ id: "rejected", status: "Rejected" }),
        trip({ id: "completed", status: "Completed" }),
        trip({ id: "nodriver", status: "Approved" }),
        trip({ id: "noalloc", status: "Approved" }),
      ],
    });
    const allocations = [
      allocation({ tripId: "approved", driverId: "d1" }),
      allocation({ tripId: "pending", driverId: "d1" }),
      allocation({ tripId: "rejected", driverId: "d1" }),
      allocation({ tripId: "completed", driverId: "d1" }),
      allocation({ tripId: "nodriver", driverId: null }),
    ];
    const groups = getEligibleDutySlipGroups(r, allocations);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.driverId).toBe("d1");
    expect(groups[0]?.trips.map((t) => t.trip.id)).toEqual(["approved"]);
  });

  it("groups trips by driver", () => {
    const r = requisition({
      trips: [
        trip({ id: "a", status: "Approved" }),
        trip({ id: "b", status: "Approved" }),
        trip({ id: "c", status: "Approved" }),
      ],
    });
    const groups = getEligibleDutySlipGroups(r, [
      allocation({ tripId: "a", driverId: "d1" }),
      allocation({ tripId: "b", driverId: "d2" }),
      allocation({ tripId: "c", driverId: "d1" }),
    ]);
    expect(groups.map((g) => g.driverId).sort()).toEqual(["d1", "d2"]);
    expect(groups.find((g) => g.driverId === "d1")?.trips).toHaveLength(2);
  });

  it("sorts a driver's trips by date, then by start time", () => {
    const r = requisition({
      trips: [
        trip({ id: "late", status: "Approved", date: "2026-10-23", startTime: "08:00" }),
        trip({ id: "pm", status: "Approved", date: "2026-10-22", startTime: "14:00" }),
        trip({ id: "am", status: "Approved", date: "2026-10-22", startTime: "08:00" }),
      ],
    });
    const [group] = getEligibleDutySlipGroups(
      r,
      ["late", "pm", "am"].map((tripId) => allocation({ tripId, driverId: "d1" })),
    );
    expect(group?.trips.map((t) => t.trip.id)).toEqual(["am", "pm", "late"]);
  });

  it("returns nothing when no trip qualifies", () => {
    expect(getEligibleDutySlipGroups(requisition({ trips: [] }), [])).toEqual([]);
    const r = requisition({ trips: [trip({ id: "p", status: "Pending" })] });
    expect(getEligibleDutySlipGroups(r, [allocation({ tripId: "p" })])).toEqual([]);
  });
});

describe("isDutySlipStale", () => {
  const slip = { trips: [{ tripId: "t1", vehicleId: "veh-1" }] };

  it("is not stale while the allocation still has the same vehicle", () => {
    expect(isDutySlipStale(slip, [{ tripId: "t1", vehicleId: "veh-1" }])).toBe(false);
  });

  it("is stale when the vehicle was swapped after the slip was generated", () => {
    expect(isDutySlipStale(slip, [{ tripId: "t1", vehicleId: "veh-2" }])).toBe(true);
  });

  it("is stale when the allocation was removed", () => {
    expect(isDutySlipStale(slip, [])).toBe(true);
    expect(isDutySlipStale(slip, [{ tripId: "other", vehicleId: "veh-1" }])).toBe(true);
  });

  it("is stale if any one of several trips changed", () => {
    const multi = {
      trips: [
        { tripId: "t1", vehicleId: "veh-1" },
        { tripId: "t2", vehicleId: "veh-1" },
      ],
    };
    expect(
      isDutySlipStale(multi, [
        { tripId: "t1", vehicleId: "veh-1" },
        { tripId: "t2", vehicleId: "veh-9" },
      ]),
    ).toBe(true);
  });

  it("a slip with no trips is never stale", () => {
    expect(isDutySlipStale({ trips: [] }, [])).toBe(false);
  });
});
