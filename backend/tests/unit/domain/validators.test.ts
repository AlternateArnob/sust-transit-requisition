import { describe, expect, it } from "vitest";
import { AppError } from "../../../src/errors/AppError.js";
import {
  HOLD_LIMIT_MESSAGE,
  buildTripFromInput,
  isValidRoute,
  isWithinHoldWindow,
  parseRoute,
} from "../../../src/domain/validators.js";

describe("isWithinHoldWindow (3-hour rule)", () => {
  it("accepts exactly 3 hours", () => {
    expect(isWithinHoldWindow("09:00", "12:00")).toBe(true);
  });

  it("rejects 3 hours 1 minute", () => {
    expect(isWithinHoldWindow("09:00", "12:01")).toBe(false);
  });

  it("rejects an end before the start (a trip cannot cross midnight)", () => {
    expect(isWithinHoldWindow("23:00", "01:00")).toBe(false);
    expect(isWithinHoldWindow("11:00", "10:59")).toBe(false);
  });

  it("accepts a zero-length trip and short trips", () => {
    expect(isWithinHoldWindow("10:00", "10:00")).toBe(true);
    expect(isWithinHoldWindow("10:00", "10:30")).toBe(true);
  });

  it("accepts a 3-hour trip ending at 23:59 but not one that would need to pass midnight", () => {
    expect(isWithinHoldWindow("20:59", "23:59")).toBe(true);
    expect(isWithinHoldWindow("22:00", "00:30")).toBe(false);
  });

  it("understands HH:mm:ss times as MySQL returns them", () => {
    expect(isWithinHoldWindow("09:00:00", "12:00:00")).toBe(true);
    expect(isWithinHoldWindow("09:00:00", "12:01:00")).toBe(false);
  });

  it("honours a custom limit", () => {
    expect(isWithinHoldWindow("09:00", "10:30", 1)).toBe(false);
    expect(isWithinHoldWindow("09:00", "10:00", 1)).toBe(true);
  });

  it("lets missing times through (the request schema requires them separately)", () => {
    expect(isWithinHoldWindow("", "10:00")).toBe(true);
    expect(isWithinHoldWindow("09:00", "")).toBe(true);
  });

  it("rejects unparseable times instead of passing them", () => {
    expect(isWithinHoldWindow("nine", "ten")).toBe(false);
  });

  it("exposes the user-facing message", () => {
    expect(HOLD_LIMIT_MESSAGE).toBe("This trip exceeds the 3-hour vehicle-hold limit.");
  });
});

describe("parseRoute", () => {
  const stops = ["Campus", "Amborkhana", "Zindabazar"];

  it.each([
    ["->", "Campus -> Amborkhana -> Zindabazar"],
    ["→", "Campus → Amborkhana → Zindabazar"],
    ["=>", "Campus => Amborkhana => Zindabazar"],
    ["—>", "Campus —> Amborkhana —> Zindabazar"],
    [">", "Campus > Amborkhana > Zindabazar"],
    ["newline", "Campus\nAmborkhana\nZindabazar"],
    ["CRLF", "Campus\r\nAmborkhana\r\nZindabazar"],
    ["no spaces", "Campus->Amborkhana->Zindabazar"],
  ])("splits on %s", (_name, text) => {
    expect(parseRoute(text)).toEqual(stops);
  });

  it("accepts mixed separators", () => {
    expect(parseRoute("Campus -> Amborkhana\nZindabazar => Campus")).toEqual([
      "Campus",
      "Amborkhana",
      "Zindabazar",
      "Campus",
    ]);
  });

  it("trims stops and drops empty ones", () => {
    expect(parseRoute("  Campus  ->  ->  Zindabazar  ")).toEqual(["Campus", "Zindabazar"]);
    expect(parseRoute("\n\nCampus\n\nZindabazar\n")).toEqual(["Campus", "Zindabazar"]);
  });

  it("keeps stop names that contain spaces, dashes or commas", () => {
    expect(parseRoute("SUST Gate -> Mirboxtula, Sylhet -> Ambarkhana-Point")).toEqual([
      "SUST Gate",
      "Mirboxtula, Sylhet",
      "Ambarkhana-Point",
    ]);
  });

  it("returns nothing for blank text", () => {
    expect(parseRoute("")).toEqual([]);
    expect(parseRoute("  \n  ")).toEqual([]);
  });
});

describe("isValidRoute", () => {
  it("needs at least two stops", () => {
    expect(isValidRoute("Campus -> Zindabazar")).toBe(true);
    expect(isValidRoute("Campus")).toBe(false);
    expect(isValidRoute("")).toBe(false);
  });

  it("a trailing separator does not create a second stop", () => {
    expect(isValidRoute("Campus ->")).toBe(false);
    expect(isValidRoute("-> Campus")).toBe(false);
  });
});

describe("buildTripFromInput (Part 1 §11.10)", () => {
  it("builds a Personal route as Campus, destination, Campus", () => {
    expect(buildTripFromInput("Personal", { destination: "Zindabazar" })).toEqual({
      route: "Campus to Zindabazar and Return to Campus",
      stoppageSequence: ["Campus", "Zindabazar", "Campus"],
    });
  });

  it("trims the Personal destination and ignores routeText", () => {
    expect(
      buildTripFromInput("Personal", { destination: "  Airport  ", routeText: "A -> B -> C" }),
    ).toEqual({
      route: "Campus to Airport and Return to Campus",
      stoppageSequence: ["Campus", "Airport", "Campus"],
    });
  });

  it("rejects a Personal trip without a destination (422 at trips.N.destination)", () => {
    for (const input of [{}, { destination: "" }, { destination: "   " }, { destination: null }]) {
      let caught: unknown;
      try {
        buildTripFromInput("Personal", input, 0);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(AppError);
      expect(caught).toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
        details: [{ path: "trips.0.destination", message: expect.any(String) }],
      });
    }
  });

  it("builds a Departmental/Official route by joining the parsed stops with an arrow", () => {
    expect(
      buildTripFromInput("Departmental/Official", { routeText: "Campus -> Amborkhana => Campus" }),
    ).toEqual({
      route: "Campus → Amborkhana → Campus",
      stoppageSequence: ["Campus", "Amborkhana", "Campus"],
    });
  });

  it("treats Club requisitions like Departmental/Official", () => {
    expect(buildTripFromInput("Club", { routeText: "Campus\nRiver Side" })).toEqual({
      route: "Campus → River Side",
      stoppageSequence: ["Campus", "River Side"],
    });
  });

  it("rejects a route with a single stop and reports the trip index", () => {
    let caught: unknown;
    try {
      buildTripFromInput("Departmental/Official", { routeText: "Campus" }, 2);
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      details: [{ path: "trips.2.routeText" }],
    });
  });

  it("rejects a missing route for non-personal requisitions", () => {
    expect(() => buildTripFromInput("Club", {})).toThrow(AppError);
    expect(() => buildTripFromInput("Departmental/Official", { routeText: "  " })).toThrow(
      AppError,
    );
  });
});
