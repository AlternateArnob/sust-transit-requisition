import { describe, expect, it } from "vitest";
import { APPLICANT_PROFILES, REQUISITION_TYPES } from "../../../src/config/constants.js";
import {
  getMileageColumnStatus,
  getTripsAwaitingMileage,
  isMileageEligibleRequisition,
} from "../../../src/domain/mileage.js";
import type { MileageEntryLike } from "../../../src/types/index.js";
import { requisition, trip } from "../../helpers/builders.js";

describe("isMileageEligibleRequisition", () => {
  it("is true only for Personal requisitions by a Teacher or Officer", () => {
    for (const requisitionType of REQUISITION_TYPES) {
      for (const applicantProfile of APPLICANT_PROFILES) {
        const expected =
          requisitionType === "Personal" &&
          (applicantProfile === "Teacher" || applicantProfile === "Officer");
        expect(
          isMileageEligibleRequisition({ requisitionType, applicantProfile }),
          `${requisitionType} + ${applicantProfile}`,
        ).toBe(expected);
      }
    }
  });

  it("is false without a profile", () => {
    expect(
      isMileageEligibleRequisition({ requisitionType: "Personal", applicantProfile: null }),
    ).toBe(false);
    expect(isMileageEligibleRequisition({ requisitionType: "Personal" })).toBe(false);
  });
});

describe("getMileageColumnStatus", () => {
  const entry = (
    tripId: string,
    distanceKm: number,
    requisitionId = "TRS-2026-001",
  ): MileageEntryLike => ({
    requisitionId,
    tripId,
    distanceKm,
  });
  const alloc = (tripId: string) => ({ tripId });

  it("is not-applicable for requisitions that are not mileage-eligible", () => {
    const student = requisition({
      applicantProfile: "Student",
      trips: [trip({ status: "Completed" })],
    });
    const official = requisition({
      requisitionType: "Departmental/Official",
      trips: [trip({ status: "Completed" })],
    });
    expect(getMileageColumnStatus(student, [], [])).toEqual({ kind: "not-applicable" });
    expect(getMileageColumnStatus(official, [], [])).toEqual({ kind: "not-applicable" });
  });

  it("is not-ready until a trip is Completed (Approved is not enough)", () => {
    const r = requisition({ trips: [trip({ id: "t1", status: "Approved" })] });
    expect(getMileageColumnStatus(r, [alloc("t1")], [])).toEqual({ kind: "not-ready" });
  });

  it("is awaiting for a Completed trip with an allocation and no entry", () => {
    const t1 = trip({ id: "t1", status: "Completed" });
    const r = requisition({ trips: [t1] });
    expect(getMileageColumnStatus(r, [alloc("t1")], [])).toEqual({ kind: "awaiting", trips: [t1] });
  });

  it("is recorded with the total once every Completed trip has an entry", () => {
    const r = requisition({
      trips: [trip({ id: "t1", status: "Completed" }), trip({ id: "t2", status: "Completed" })],
    });
    const status = getMileageColumnStatus(
      r,
      [alloc("t1"), alloc("t2")],
      [entry("t1", 12.5), entry("t2", 7.25)],
    );
    expect(status).toEqual({ kind: "recorded", distanceKm: 19.75 });
  });

  it("is awaiting only the trips still missing an entry", () => {
    const t1 = trip({ id: "t1", status: "Completed" });
    const t2 = trip({ id: "t2", status: "Completed" });
    const r = requisition({ trips: [t1, t2] });
    expect(getMileageColumnStatus(r, [alloc("t1"), alloc("t2")], [entry("t1", 10)])).toEqual({
      kind: "awaiting",
      trips: [t2],
    });
  });

  it("ignores trips that are not Completed when deciding whether everything is recorded", () => {
    const r = requisition({
      trips: [trip({ id: "t1", status: "Completed" }), trip({ id: "t2", status: "Approved" })],
    });
    expect(getMileageColumnStatus(r, [alloc("t1")], [entry("t1", 5)])).toEqual({
      kind: "recorded",
      distanceKm: 5,
    });
  });

  it("ignores entries that belong to another requisition", () => {
    const t1 = trip({ id: "t1", status: "Completed" });
    const r = requisition({ trips: [t1] });
    expect(getMileageColumnStatus(r, [alloc("t1")], [entry("t1", 99, "TRS-2026-777")])).toEqual({
      kind: "awaiting",
      trips: [t1],
    });
  });

  it("fails safe to not-ready when a Completed trip has no allocation on record", () => {
    const r = requisition({ trips: [trip({ id: "t1", status: "Completed" })] });
    expect(getMileageColumnStatus(r, [], [])).toEqual({ kind: "not-ready" });
  });

  it("a requisition with only rejected trips is not-ready", () => {
    const r = requisition({ trips: [trip({ status: "Rejected" })] });
    expect(getMileageColumnStatus(r, [], [])).toEqual({ kind: "not-ready" });
  });
});

describe("getTripsAwaitingMileage", () => {
  it("returns Completed trips that have an allocation and no entry", () => {
    const done = trip({ id: "done", status: "Completed" });
    const recorded = trip({ id: "recorded", status: "Completed" });
    const noAllocation = trip({ id: "noalloc", status: "Completed" });
    const approved = trip({ id: "approved", status: "Approved" });
    const r = requisition({ trips: [done, recorded, noAllocation, approved] });
    const result = getTripsAwaitingMileage(
      r,
      [{ tripId: "done" }, { tripId: "recorded" }, { tripId: "approved" }],
      [{ requisitionId: "TRS-2026-001", tripId: "recorded", distanceKm: 3 }],
    );
    expect(result).toEqual([done]);
  });
});
