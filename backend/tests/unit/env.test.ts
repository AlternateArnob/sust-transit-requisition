import { describe, expect, it, vi } from "vitest";
import { EnvValidationError, loadEnv, parseEnv } from "../../src/config/env.js";

const valid = {
  DB_USER: "sust_transit",
  DB_PASSWORD: "change-me",
  DB_NAME: "sust_transit",
  JWT_ACCESS_SECRET: "x".repeat(32),
  CLIENT_ORIGIN: "http://localhost:5173",
};

const production = {
  ...valid,
  NODE_ENV: "production",
  OTP_DEV_ECHO: "false",
  COOKIE_SECURE: "true",
};

function issuesFor(source: Record<string, string>): string[] {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvValidationError) return error.issues;
    throw error;
  }
  return [];
}

describe("parseEnv", () => {
  it("accepts a minimal valid config and applies the documented defaults", () => {
    const env = parseEnv(valid);
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(4000);
    expect(env.API_BASE_PATH).toBe("/api/v1");
    expect(env.DB_HOST).toBe("127.0.0.1");
    expect(env.DB_PORT).toBe(3306);
    expect(env.JWT_ACCESS_TTL).toBe("15m");
    expect(env.REFRESH_COOKIE_NAME).toBe("sust_rt");
    expect(env.PASSWORD_MIN_LENGTH).toBe(8);
    expect(env.OTP_LENGTH).toBe(6);
    expect(env.MAX_SIGNATURE_BYTES).toBe(1_048_576);
    expect(env.MAX_DOCUMENT_BYTES).toBe(5_242_880);
  });

  it("parses numbers and booleans from strings", () => {
    const env = parseEnv({
      ...valid,
      PORT: "5050",
      TRUST_PROXY: "true",
      COOKIE_SECURE: "false",
      OTP_DEV_ECHO: "false",
    });
    expect(env.PORT).toBe(5050);
    expect(env.TRUST_PROXY).toBe(true);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.OTP_DEV_ECHO).toBe(false);
  });

  it("rejects booleans that are not exactly true/false", () => {
    expect(issuesFor({ ...valid, TRUST_PROXY: "yes" }).join("\n")).toContain("TRUST_PROXY");
  });

  it("splits CLIENT_ORIGIN on commas into an allow-list", () => {
    const env = parseEnv({
      ...valid,
      CLIENT_ORIGIN: "http://localhost:5173, https://transit.sust.edu",
    });
    expect(env.CLIENT_ORIGIN).toEqual(["http://localhost:5173", "https://transit.sust.edu"]);
  });

  it.each(["http://localhost:5173/", "localhost:5173", "http://localhost:5173/app"])(
    "rejects CLIENT_ORIGIN that is not an exact origin (%s)",
    (origin) => {
      expect(issuesFor({ ...valid, CLIENT_ORIGIN: origin }).join("\n")).toContain("CLIENT_ORIGIN");
    },
  );

  it.each(["DB_USER", "DB_PASSWORD", "DB_NAME", "JWT_ACCESS_SECRET", "CLIENT_ORIGIN"])(
    "reports a readable message when %s is missing",
    (name) => {
      const source: Record<string, string> = { ...valid };
      delete source[name];
      expect(issuesFor(source)).toContain(`${name}: is required but missing`);
    },
  );

  it("collects every problem in one error, not just the first", () => {
    const issues = issuesFor({ PORT: "abc" });
    expect(issues.length).toBeGreaterThanOrEqual(6);
  });

  it("rejects invalid values", () => {
    expect(issuesFor({ ...valid, PORT: "70000" }).join("\n")).toContain("PORT");
    expect(issuesFor({ ...valid, NODE_ENV: "staging" }).join("\n")).toContain("NODE_ENV");
    expect(issuesFor({ ...valid, JWT_ACCESS_TTL: "fifteen" }).join("\n")).toContain(
      "JWT_ACCESS_TTL",
    );
    expect(issuesFor({ ...valid, API_BASE_PATH: "api/v1" }).join("\n")).toContain("API_BASE_PATH");
    expect(issuesFor({ ...valid, API_BASE_PATH: "/api/v1/" }).join("\n")).toContain(
      "API_BASE_PATH",
    );
    expect(issuesFor({ ...valid, COOKIE_SAMESITE: "maybe" }).join("\n")).toContain(
      "COOKIE_SAMESITE",
    );
  });

  it("rejects a pool where min is greater than max", () => {
    expect(issuesFor({ ...valid, DB_POOL_MIN: "20", DB_POOL_MAX: "5" }).join("\n")).toContain(
      "DB_POOL_MIN",
    );
  });

  it("requires COOKIE_SECURE=true when COOKIE_SAMESITE=none", () => {
    expect(issuesFor({ ...valid, COOKIE_SAMESITE: "none" }).join("\n")).toContain("COOKIE_SECURE");
    expect(() =>
      parseEnv({ ...valid, COOKIE_SAMESITE: "none", COOKIE_SECURE: "true" }),
    ).not.toThrow();
  });
});

describe("parseEnv in production", () => {
  it("accepts a safe production config", () => {
    expect(() => parseEnv(production)).not.toThrow();
  });

  it("requires OTP_DEV_ECHO=false (and defaults to true, so it must be set explicitly)", () => {
    const withoutEcho: Record<string, string> = { ...production };
    delete withoutEcho.OTP_DEV_ECHO;
    expect(issuesFor(withoutEcho).join("\n")).toContain("OTP_DEV_ECHO");
    expect(issuesFor({ ...production, OTP_DEV_ECHO: "true" }).join("\n")).toContain("OTP_DEV_ECHO");
  });

  it("requires COOKIE_SECURE=true", () => {
    expect(issuesFor({ ...production, COOKIE_SECURE: "false" }).join("\n")).toContain(
      "COOKIE_SECURE",
    );
  });

  it("requires a JWT_ACCESS_SECRET of at least 32 characters", () => {
    expect(issuesFor({ ...production, JWT_ACCESS_SECRET: "short" }).join("\n")).toContain(
      "JWT_ACCESS_SECRET",
    );
    expect(() => parseEnv({ ...production, JWT_ACCESS_SECRET: "y".repeat(32) })).not.toThrow();
  });

  it("does not apply the production rules in development", () => {
    expect(() => parseEnv({ ...valid, JWT_ACCESS_SECRET: "short" })).not.toThrow();
  });
});

describe("loadEnv", () => {
  it("prints a readable message and exits with code 1 when the config is invalid", () => {
    const original = { ...process.env };
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    delete process.env.DB_PASSWORD;
    try {
      expect(() => loadEnv()).toThrow("process.exit called");
      expect(exit).toHaveBeenCalledWith(1);
      const printed = log.mock.calls.flat().join("\n");
      expect(printed).toContain("Invalid environment configuration");
      expect(printed).toContain("DB_PASSWORD: is required but missing");
    } finally {
      process.env = original;
      exit.mockRestore();
      log.mockRestore();
    }
  });
});
