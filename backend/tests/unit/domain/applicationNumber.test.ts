import { describe, expect, it } from "vitest";
import {
  formatApplicationNumber,
  isApplicationNumber,
} from "../../../src/domain/applicationNumber.js";

describe("formatApplicationNumber", () => {
  it.each([
    [2026, 1, "TRS-2026-001"],
    [2026, 7, "TRS-2026-007"],
    [2026, 42, "TRS-2026-042"],
    [2026, 999, "TRS-2026-999"],
    [2027, 1, "TRS-2027-001"],
  ])("year %i, number %i -> %s", (year, n, expected) => {
    expect(formatApplicationNumber(year, n)).toBe(expected);
  });

  it("widens naturally past 999 instead of truncating", () => {
    expect(formatApplicationNumber(2026, 1000)).toBe("TRS-2026-1000");
    expect(formatApplicationNumber(2026, 12345)).toBe("TRS-2026-12345");
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects the sequence number %s", (n) => {
    expect(() => formatApplicationNumber(2026, n)).toThrow(RangeError);
  });

  it.each([26, 99999, 2026.5, Number.NaN])("rejects the year %s", (year) => {
    expect(() => formatApplicationNumber(year, 1)).toThrow(RangeError);
  });
});

describe("isApplicationNumber", () => {
  it("accepts well-formed numbers", () => {
    expect(isApplicationNumber("TRS-2026-001")).toBe(true);
    expect(isApplicationNumber("TRS-2026-1000")).toBe(true);
  });

  it.each([
    "TRS-2026-01",
    "trs-2026-001",
    "TRS-26-001",
    "TRS-2026-",
    "TRS-2026-001 ",
    "REQ-2026-001",
    "",
  ])("rejects %j", (value) => {
    expect(isApplicationNumber(value)).toBe(false);
  });
});
