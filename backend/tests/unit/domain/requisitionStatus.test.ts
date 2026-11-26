import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES, type ApplicationStatus } from "../../../src/config/constants.js";
import { AppError } from "../../../src/errors/AppError.js";
import {
  TRANSITIONS,
  assertTransition,
  canGenerateSlips,
  canTransition,
  computeApplicationStatus,
  computeStatusAfterTripCompletion,
  isInActiveQueue,
  isInTransportAdministratorQueue,
  isInTransportInChargeQueue,
  type RequisitionAction,
} from "../../../src/domain/requisitionStatus.js";
import { requisition, trip } from "../../helpers/builders.js";

const trips = (...statuses: string[]) =>
  statuses.map((status) => trip({ status: status as never }));

describe("computeApplicationStatus (Part 1 §11.5)", () => {
  it("is Approved when every trip is approved", () => {
    expect(computeApplicationStatus(trips("Approved", "Approved"), "Pending Administrator")).toBe(
      "Approved",
    );
  });

  it("is Rejected when every trip is rejected", () => {
    expect(computeApplicationStatus(trips("Rejected", "Rejected"), "Pending Administrator")).toBe(
      "Rejected",
    );
  });

  it("is Partially Approved for a mix of approved and rejected", () => {
    expect(computeApplicationStatus(trips("Approved", "Rejected"), "Pending Administrator")).toBe(
      "Partially Approved",
    );
  });

  it("is Partially Approved when some trips are decided and some still Pending", () => {
    expect(computeApplicationStatus(trips("Approved", "Pending"), "Pending Administrator")).toBe(
      "Partially Approved",
    );
    expect(computeApplicationStatus(trips("Rejected", "Pending"), "Pending Administrator")).toBe(
      "Partially Approved",
    );
  });

  it("keeps the current status when no trip is decided", () => {
    for (const current of [
      "Pending Administrator",
      "Recommended",
      "Pending on Transport Office",
    ] as const) {
      expect(computeApplicationStatus(trips("Pending", "Pending"), current)).toBe(current);
    }
  });

  it("keeps the current status when there are no trips", () => {
    expect(computeApplicationStatus([], "Draft")).toBe("Draft");
  });

  it("a single approved or rejected trip decides the whole requisition", () => {
    expect(computeApplicationStatus(trips("Approved"), "Pending Administrator")).toBe("Approved");
    expect(computeApplicationStatus(trips("Rejected"), "Pending Administrator")).toBe("Rejected");
  });

  it("resetting the last decided trip to Pending falls back to the current status", () => {
    expect(computeApplicationStatus(trips("Pending", "Pending"), "Partially Approved")).toBe(
      "Partially Approved",
    );
  });

  describe("Completed trips", () => {
    it("count as approved, so deciding a sibling afterwards does not demote the requisition", () => {
      expect(computeApplicationStatus(trips("Completed", "Approved"), "Partially Approved")).toBe(
        "Approved",
      );
    });

    it("leave the status to the completion rules when every trip is Completed", () => {
      expect(computeApplicationStatus(trips("Completed", "Completed"), "Completed")).toBe(
        "Completed",
      );
      expect(computeApplicationStatus(trips("Completed", "Completed"), "Ready for Accounts")).toBe(
        "Ready for Accounts",
      );
    });

    it("stay Partially Approved while a sibling is Pending or Rejected", () => {
      expect(computeApplicationStatus(trips("Completed", "Pending"), "Partially Approved")).toBe(
        "Partially Approved",
      );
      expect(computeApplicationStatus(trips("Completed", "Rejected"), "Partially Approved")).toBe(
        "Partially Approved",
      );
    });
  });
});

describe("computeStatusAfterTripCompletion (§11.7)", () => {
  it("becomes Completed when no trip is left Approved or Pending", () => {
    expect(computeStatusAfterTripCompletion(trips("Completed", "Completed"), "Approved")).toBe(
      "Completed",
    );
    expect(
      computeStatusAfterTripCompletion(trips("Completed", "Rejected"), "Partially Approved"),
    ).toBe("Completed");
  });

  it("stays as it is while a trip is still Approved or Pending", () => {
    expect(computeStatusAfterTripCompletion(trips("Completed", "Approved"), "Approved")).toBe(
      "Approved",
    );
    expect(
      computeStatusAfterTripCompletion(trips("Completed", "Pending"), "Partially Approved"),
    ).toBe("Partially Approved");
  });

  it("never regresses from Ready for Accounts", () => {
    expect(computeStatusAfterTripCompletion(trips("Completed"), "Ready for Accounts")).toBe(
      "Ready for Accounts",
    );
  });

  it("keeps the status when there are no trips", () => {
    expect(computeStatusAfterTripCompletion([], "Approved")).toBe("Approved");
  });
});

describe("queues (§11.5)", () => {
  it("In-Charge queue is Recommended and Pending on Transport Office only", () => {
    for (const status of APPLICATION_STATUSES) {
      expect(isInTransportInChargeQueue({ status }), status).toBe(
        status === "Recommended" || status === "Pending on Transport Office",
      );
    }
  });

  it("Administrator queue includes Pending Administrator", () => {
    expect(isInTransportAdministratorQueue(requisition({ status: "Pending Administrator" }))).toBe(
      true,
    );
  });

  it("Partially Approved is in the Administrator queue while a trip is still Pending", () => {
    const r = requisition({ status: "Partially Approved", trips: trips("Approved", "Pending") });
    expect(isInTransportAdministratorQueue(r)).toBe(true);
  });

  it("Partially Approved is OUT of the Administrator queue once nothing is Pending", () => {
    const r = requisition({ status: "Partially Approved", trips: trips("Approved", "Rejected") });
    expect(isInTransportAdministratorQueue(r)).toBe(false);
  });

  it("Partially Approved with no trips at all is not in the queue", () => {
    expect(isInTransportAdministratorQueue(requisition({ status: "Partially Approved" }))).toBe(
      false,
    );
  });

  it("no other status is in the Administrator queue", () => {
    for (const status of APPLICATION_STATUSES) {
      if (status === "Pending Administrator" || status === "Partially Approved") continue;
      expect(
        isInTransportAdministratorQueue(requisition({ status, trips: trips("Pending") })),
        status,
      ).toBe(false);
    }
  });

  it("the active queue is the union of both queues", () => {
    expect(isInActiveQueue(requisition({ status: "Recommended" }))).toBe(true);
    expect(isInActiveQueue(requisition({ status: "Pending Administrator" }))).toBe(true);
    expect(
      isInActiveQueue(
        requisition({ status: "Partially Approved", trips: trips("Approved", "Pending") }),
      ),
    ).toBe(true);
    expect(
      isInActiveQueue(
        requisition({ status: "Partially Approved", trips: trips("Approved", "Rejected") }),
      ),
    ).toBe(false);
    expect(isInActiveQueue(requisition({ status: "Approved" }))).toBe(false);
    expect(isInActiveQueue(requisition({ status: "Draft" }))).toBe(false);
  });
});

describe("canGenerateSlips", () => {
  it("is true from Approved onwards and false before", () => {
    const allowed: ApplicationStatus[] = [
      "Approved",
      "Partially Approved",
      "Completed",
      "Ready for Accounts",
    ];
    for (const status of APPLICATION_STATUSES) {
      expect(canGenerateSlips({ status }), status).toBe(allowed.includes(status));
    }
  });
});

describe("allowed transitions (Part 1 §11.2)", () => {
  // Written out independently of the implementation, straight from the table in the spec.
  const EXPECTED: Record<RequisitionAction, ApplicationStatus[]> = {
    edit_draft: ["Draft"],
    submit: ["Draft"],
    recommend: ["Pending Recommendation"],
    reject_by_head: ["Pending Recommendation"],
    send_back_by_head: ["Pending Recommendation"],
    send_back_by_in_charge: ["Recommended", "Pending on Transport Office"],
    resubmit: ["Information Requested"],
    forward: ["Recommended", "Pending on Transport Office"],
    assign_vehicle: ["Recommended", "Pending on Transport Office"],
    decide_trip: ["Pending Administrator", "Partially Approved"],
    send_back_to_in_charge: ["Pending Administrator", "Partially Approved"],
    complete_trip: ["Approved", "Partially Approved", "Completed"],
    record_mileage: ["Approved", "Partially Approved", "Completed"],
  };

  it("covers exactly the documented actions", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const [action, from] of Object.entries(EXPECTED) as [
    RequisitionAction,
    ApplicationStatus[],
  ][]) {
    it(`${action} is allowed from exactly: ${from.join(", ")}`, () => {
      for (const status of APPLICATION_STATUSES) {
        expect(canTransition(action, status), `${action} from ${status}`).toBe(
          from.includes(status),
        );
      }
    });
  }

  it("assertTransition passes silently when the action is allowed", () => {
    expect(() => assertTransition("recommend", "Pending Recommendation")).not.toThrow();
    expect(() => assertTransition("forward", "Recommended")).not.toThrow();
  });

  it("assertTransition throws AppError 409 INVALID_STATE naming the status otherwise", () => {
    let caught: unknown;
    try {
      assertTransition("forward", "Approved");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect(caught).toMatchObject({ status: 409, code: "INVALID_STATE" });
    expect((caught as AppError).message).toContain("Approved");
  });

  it("nothing can be edited, submitted or recommended once approved", () => {
    for (const action of ["edit_draft", "submit", "recommend", "resubmit"] as const) {
      expect(() => assertTransition(action, "Approved")).toThrow(AppError);
    }
  });

  it("a rejected requisition has no way forward", () => {
    for (const action of Object.keys(TRANSITIONS) as RequisitionAction[]) {
      expect(canTransition(action, "Rejected"), action).toBe(false);
    }
  });
});
