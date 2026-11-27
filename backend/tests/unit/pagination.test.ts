import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DEFAULT_PAGE_SIZE,
  escapeLike,
  MAX_PAGE_SIZE,
  offsetFor,
  paginationShape,
  toPage,
} from "../../src/http/pagination.js";

const schema = z.strictObject(paginationShape);

describe("paginationShape (Part 1 §7.3)", () => {
  it("defaults to page 1 and 20 items", () => {
    expect(schema.parse({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });

  it("coerces query strings", () => {
    expect(schema.parse({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50 });
  });

  it("caps pageSize at 100", () => {
    expect(MAX_PAGE_SIZE).toBe(100);
    expect(schema.safeParse({ pageSize: "100" }).success).toBe(true);
    expect(schema.safeParse({ pageSize: "101" }).success).toBe(false);
  });

  it.each([{ page: "0" }, { page: "-1" }, { page: "1.5" }, { page: "abc" }, { pageSize: "0" }])(
    "rejects %o",
    (input) => {
      expect(schema.safeParse(input).success).toBe(false);
    },
  );
});

describe("helpers", () => {
  it("offsetFor", () => {
    expect(offsetFor(1, 20)).toBe(0);
    expect(offsetFor(3, 20)).toBe(40);
  });

  it("toPage wraps rows with meta", () => {
    expect(toPage(["a"], 2, 10, 11)).toEqual({
      data: ["a"],
      meta: { page: 2, pageSize: 10, total: 11 },
    });
  });

  it("escapeLike makes wildcards literal", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(escapeLike("plain")).toBe("plain");
  });
});
