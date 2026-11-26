import { describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import { AppError } from "../../src/errors/AppError.js";
import {
  assertPasswordPolicy,
  burnPasswordCheck,
  hashPassword,
  PASSWORD_MAX_LENGTH,
  verifyPassword,
} from "../../src/services/password.js";

describe("hashPassword / verifyPassword", () => {
  it("round-trips and never stores the plain password", async () => {
    const hash = await hashPassword("Correct-Horse-9");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("Correct-Horse-9");
    expect(await verifyPassword(hash, "Correct-Horse-9")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("Correct-Horse-9");
    expect(await verifyPassword(hash, "correct-horse-9")).toBe(false);
    expect(await verifyPassword(hash, "")).toBe(false);
  });

  it("uses a random salt, so equal passwords give different hashes", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-password"),
      hashPassword("same-password"),
    ]);
    expect(a).not.toBe(b);
  });

  it("returns false (never throws) for a missing or malformed hash", async () => {
    expect(await verifyPassword(null, "x")).toBe(false);
    expect(await verifyPassword(undefined, "x")).toBe(false);
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });

  it("burnPasswordCheck resolves without throwing", async () => {
    await expect(burnPasswordCheck("anything")).resolves.toBeUndefined();
  });
});

describe("assertPasswordPolicy", () => {
  it("accepts a password of the minimum length", () => {
    expect(() => assertPasswordPolicy("a".repeat(env.PASSWORD_MIN_LENGTH))).not.toThrow();
  });

  it("rejects a short password with a 422 that names the field", () => {
    try {
      assertPasswordPolicy("a".repeat(env.PASSWORD_MIN_LENGTH - 1), "newPassword");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
        details: [
          {
            path: "newPassword",
            message: expect.stringContaining(String(env.PASSWORD_MIN_LENGTH)),
          },
        ],
      });
    }
  });

  it("rejects an absurdly long password", () => {
    expect(() => assertPasswordPolicy("a".repeat(PASSWORD_MAX_LENGTH + 1))).toThrow(AppError);
    expect(() => assertPasswordPolicy("a".repeat(PASSWORD_MAX_LENGTH))).not.toThrow();
  });

  it("defaults to a minimum of 8 characters (Part 1 §8.1)", () => {
    expect(env.PASSWORD_MIN_LENGTH).toBe(8);
  });
});
