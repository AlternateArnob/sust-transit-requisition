import "dotenv/config";
import { z } from "zod";
import { DEFAULT_SEED_ADMIN_PASSWORD } from "./constants.js";

/** "true" / "false" strings -> boolean. Defaults are applied to the parsed boolean. */
const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const port = z.coerce.number().int().min(1).max(65535);
const positiveInt = z.coerce.number().int().min(1);

const clientOrigins = z
  .string()
  .min(1)
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        z.string().refine(
          (origin) => {
            try {
              return new URL(origin).origin === origin;
            } catch {
              return false;
            }
          },
          {
            message:
              "must be an exact origin such as http://localhost:5173 (no path, no trailing slash)",
          },
        ),
      )
      .min(1),
  );

const baseSchema = z.object({
  // --- Server ---
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: port.default(4000),
  API_BASE_PATH: z
    .string()
    .regex(/^\/[A-Za-z0-9_\-/]*$/, "must start with / and contain only letters, digits, - _ /")
    .refine((value) => value === "/" || !value.endsWith("/"), "must not end with /")
    .default("/api/v1"),
  CLIENT_ORIGIN: clientOrigins,
  TRUST_PROXY: booleanString.default(false),

  // --- Database ---
  DB_HOST: z.string().min(1).default("127.0.0.1"),
  DB_PORT: port.default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_POOL_MIN: z.coerce.number().int().min(0).default(2),
  DB_POOL_MAX: positiveInt.default(10),
  DB_TIMEZONE: z.string().min(1).default("Z"),

  // --- Auth ---
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z
    .string()
    .regex(/^\d+[smhd]$/, "must look like 15m, 1h, 30s or 7d")
    .default("15m"),
  REFRESH_TOKEN_TTL_DAYS: positiveInt.max(90).default(14),
  REFRESH_COOKIE_NAME: z.string().min(1).default("sust_rt"),
  COOKIE_SECURE: booleanString.default(false),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  BCRYPT_COST: z.coerce.number().int().min(4).max(20).default(12),
  PASSWORD_MIN_LENGTH: positiveInt.default(8),

  // --- OTP ---
  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_TTL_MINUTES: positiveInt.default(10),
  OTP_MAX_ATTEMPTS: positiveInt.default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(60),
  OTP_DEV_ECHO: booleanString.default(true),

  // --- Email (SMTP) ---
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: port.default(1025),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  MAIL_FROM: z.string().min(1).default("SUST Transport <no-reply@sust.edu>"),

  // --- Files ---
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  MAX_SIGNATURE_BYTES: positiveInt.default(1_048_576),
  MAX_DOCUMENT_BYTES: positiveInt.default(5_242_880),

  // --- Seed ---
  SEED_ADMIN_PASSWORD: z.string().min(1).default(DEFAULT_SEED_ADMIN_PASSWORD),
});

export const envSchema = baseSchema.superRefine((cfg, ctx) => {
  if (cfg.DB_POOL_MIN > cfg.DB_POOL_MAX) {
    ctx.addIssue({
      code: "custom",
      path: ["DB_POOL_MIN"],
      message: "must not be greater than DB_POOL_MAX",
    });
  }
  if (cfg.COOKIE_SAMESITE === "none" && !cfg.COOKIE_SECURE) {
    ctx.addIssue({
      code: "custom",
      path: ["COOKIE_SECURE"],
      message: "must be true when COOKIE_SAMESITE=none",
    });
  }
  if (cfg.NODE_ENV === "production") {
    if (cfg.OTP_DEV_ECHO) {
      ctx.addIssue({
        code: "custom",
        path: ["OTP_DEV_ECHO"],
        message: "must be false in production (it would leak OTP codes in API responses)",
      });
    }
    if (!cfg.COOKIE_SECURE) {
      ctx.addIssue({
        code: "custom",
        path: ["COOKIE_SECURE"],
        message: "must be true in production (HTTPS only cookies)",
      });
    }
    if (cfg.JWT_ACCESS_SECRET.length < 32) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_ACCESS_SECRET"],
        message: "must be at least 32 characters in production",
      });
    }
  }
});

export type Env = z.output<typeof envSchema>;

export class EnvValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((line) => `  - ${line}`).join("\n")}`);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

/** Pure parser (used directly by tests). Throws EnvValidationError with one line per problem. */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => {
    const name = issue.path.length > 0 ? issue.path.join(".") : "(env)";
    const missing = issue.code === "invalid_type" && source[String(issue.path[0])] === undefined;
    return `${name}: ${missing ? "is required but missing" : issue.message}`;
  });
  throw new EnvValidationError(issues);
}

/** Parses process.env once; prints a readable message and exits when it is invalid. */
export function loadEnv(): Env {
  try {
    return parseEnv(process.env);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(
        `\n${error.message}\n\nFix your .env file (see .env.example) and start again.\n`,
      );
      process.exit(1);
    }
    throw error;
  }
}

export const env: Env = loadEnv();
