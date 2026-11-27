import type { Request, RequestHandler } from "express";
import type { ZodError, ZodType } from "zod";
import { validation, type ErrorDetail } from "../errors/AppError.js";

type Part = "params" | "query" | "body";

export interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

function toDetails(error: ZodError, part: Part): ErrorDetail[] {
  const prefix = part === "body" ? [] : [part];
  const details: ErrorDetail[] = [];
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        details.push({
          path: [...prefix, ...issue.path, key].map(String).join("."),
          message: "Unrecognized key",
        });
      }
    } else {
      details.push({
        path: [...prefix, ...issue.path].map(String).join("."),
        message: issue.message,
      });
    }
  }
  return details;
}

/**
 * Validates and replaces req.params / req.query / req.body with the parsed values.
 * Body schemas should be z.strictObject(...) so unknown keys are rejected (Part 1 §7.1).
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res, next) => {
    const details: ErrorDetail[] = [];
    const parsed: Partial<Record<Part, unknown>> = {};

    for (const part of ["params", "query", "body"] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const input = part === "body" ? (req.body ?? {}) : req[part];
      const result = schema.safeParse(input);
      if (result.success) parsed[part] = result.data;
      else details.push(...toDetails(result.error, part));
    }

    if (details.length > 0) {
      throw validation(details, "Request validation failed");
    }

    if ("params" in parsed) req.params = parsed.params as Request["params"];
    if ("body" in parsed) req.body = parsed.body;
    if ("query" in parsed) {
      // Express 5 exposes req.query as a read-only getter, so shadow it on the instance.
      Object.defineProperty(req, "query", {
        value: parsed.query,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
}
