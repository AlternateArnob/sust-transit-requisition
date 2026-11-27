import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { forbidden, invalidState } from "../../src/errors/AppError.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { createRateLimiter } from "../../src/middleware/rateLimit.js";
import { requestId } from "../../src/middleware/requestId.js";
import { validate } from "../../src/middleware/validate.js";

/** A tiny app that exercises the middleware in isolation from the real routes. */
function buildApp(register: (app: express.Express) => void) {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  register(app);
  app.use(errorHandler);
  return app;
}

describe("validate()", () => {
  const app = buildApp((a) => {
    a.post(
      "/items/:id",
      validate({
        params: z.strictObject({ id: z.string().uuid() }),
        query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
        body: z.strictObject({
          name: z.string().min(1),
          trips: z.array(z.strictObject({ startTime: z.string() })).default([]),
        }),
      }),
      (req, res) => {
        res.json({ params: req.params, query: req.query, body: req.body });
      },
    );
  });
  const id = "6f1d5c1e-6c3a-4a53-9c7a-0c2b6a3a9a10";

  it("passes valid input and exposes the parsed (coerced, defaulted) values", async () => {
    const res = await request(app).post(`/items/${id}?page=3`).send({ name: "Bus" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      params: { id },
      query: { page: 3 },
      body: { name: "Bus", trips: [] },
    });
  });

  it("applies query defaults when the query string is empty", async () => {
    const res = await request(app).post(`/items/${id}`).send({ name: "Bus" });
    expect(res.body.query).toEqual({ page: 1 });
  });

  it("returns 422 VALIDATION_ERROR with path/message details", async () => {
    const res = await request(app)
      .post(`/items/${id}`)
      .send({ trips: [{}] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.requestId).toEqual(expect.any(String));
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toContain("name");
    expect(paths).toContain("trips.0.startTime");
    for (const detail of res.body.error.details) {
      expect(detail).toEqual({ path: expect.any(String), message: expect.any(String) });
    }
  });

  it("rejects unknown body keys (strict schemas)", async () => {
    const res = await request(app).post(`/items/${id}`).send({ name: "Bus", status: "Approved" });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toContainEqual({ path: "status", message: "Unrecognized key" });
  });

  it("treats a missing body as an empty object", async () => {
    const res = await request(app).post(`/items/${id}`);
    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain("name");
  });

  it("prefixes params and query problems and reports them together with body problems", async () => {
    const res = await request(app).post("/items/not-a-uuid?page=0").send({});
    expect(res.status).toBe(422);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["params.id", "query.page", "name"]));
  });
});

describe("errorHandler", () => {
  it("renders AppError with its status, code and details", async () => {
    const app = buildApp((a) => {
      a.get("/forbidden", () => {
        throw forbidden("Nope");
      });
      a.get("/state", () => {
        throw invalidState();
      });
    });
    const forbiddenRes = await request(app).get("/forbidden");
    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error).toMatchObject({ code: "FORBIDDEN", message: "Nope" });
    const stateRes = await request(app).get("/state");
    expect(stateRes.status).toBe(409);
    expect(stateRes.body.error.code).toBe("INVALID_STATE");
  });

  it("maps MySQL duplicate-key errors to 409 CONFLICT", async () => {
    const app = buildApp((a) => {
      a.get("/dup", () => {
        throw Object.assign(new Error("Duplicate entry 'a@b.c' for key 'users.email'"), {
          code: "ER_DUP_ENTRY",
        });
      });
    });
    const res = await request(app).get("/dup");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.error.message).not.toContain("a@b.c");
  });

  it("maps async rejections too (Express 5)", async () => {
    const app = buildApp((a) => {
      a.get("/async", async () => {
        throw forbidden("async nope");
      });
    });
    const res = await request(app).get("/async");
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("async nope");
  });

  it("hides the details of unexpected errors behind a generic 500", async () => {
    const app = buildApp((a) => {
      a.get("/boom", () => {
        throw new Error("secret database password is hunter2");
      });
    });
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
    expect(res.body.error.requestId).toEqual(expect.any(String));
  });

  it("logs the full error for 500s", async () => {
    const error = new Error("kaboom");
    const log = { error: vi.fn() };
    const app = buildApp((a) => {
      a.use((req, _res, next) => {
        (req as unknown as { log: typeof log }).log = log;
        next();
      });
      a.get("/boom", () => {
        throw error;
      });
    });
    await request(app).get("/boom");
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: error }),
      expect.any(String),
    );
  });
});

describe("createRateLimiter()", () => {
  it("answers 429 RATE_LIMITED in the uniform format once the limit is exceeded", async () => {
    const app = buildApp((a) => {
      a.use(createRateLimiter({ windowMs: 60_000, limit: 2, message: "Slow down" }));
      a.get("/limited", (_req, res) => {
        res.json({ ok: true });
      });
    });
    expect((await request(app).get("/limited")).status).toBe(200);
    expect((await request(app).get("/limited")).status).toBe(200);
    const res = await request(app).get("/limited");
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ code: "RATE_LIMITED", message: "Slow down" });
    expect(res.body.error.requestId).toEqual(expect.any(String));
  });
});
