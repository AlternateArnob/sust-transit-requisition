import { describe, expect, it } from "vitest";
import { isPositiveNumber, isRequired, isValidDateRange, isWithinHoldWindow } from "./validators";

describe("validators", () => {
  it("isRequired rejects blank strings", () => {
    expect(isRequired("  ")).toBe(false);
    expect(isRequired("a")).toBe(true);
  });

  it("isValidDateRange needs both dates and end >= start", () => {
    expect(isValidDateRange("2026-01-02", "2026-01-01")).toBe(false);
    expect(isValidDateRange("2026-01-01", "2026-01-01")).toBe(true);
    expect(isValidDateRange("", "2026-01-01")).toBe(false);
  });

  it("isPositiveNumber accepts only numbers above zero", () => {
    expect(isPositiveNumber("5")).toBe(true);
    expect(isPositiveNumber("0")).toBe(false);
    expect(isPositiveNumber("")).toBe(false);
    expect(isPositiveNumber("abc")).toBe(false);
  });

  it("isWithinHoldWindow limits a trip to the maximum hours", () => {
    expect(isWithinHoldWindow("09:00", "12:00")).toBe(true);
    expect(isWithinHoldWindow("09:00", "12:01")).toBe(false);
    expect(isWithinHoldWindow("12:00", "09:00")).toBe(false);
  });
});
