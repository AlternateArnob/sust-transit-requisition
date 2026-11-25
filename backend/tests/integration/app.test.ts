import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import { db } from "../../src/db/knex.js";

const BASE = "/api/v1";

function expectUniformError(body: unknown, code: string) {
  expect(body).toMatchObject({
    error: { code, message: expect.any(String), requestId: expect.any(String) },
  });
}

afterAll(async () => {
  await db.destroy();
});

describe("GET /health", () => {
  it("returns 200 with db up", async () => {
    const res = await request(app).get(`${BASE}/health`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", db: "up" });
    expect(new Date(res.body.time).toISOString()).toBe(res.body.time);
  });

  it("returns 503 with db down when the database cannot be reached", async () => {
    const spy = vi.spyOn(db, "raw").mockRejectedValueOnce(new Error("connection refused"));
    const res = await request(app).get(`${BASE}/health`);
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "error", db: "down" });
  });
});

describe("GET /version", () => {
  it("returns the package name and version", async () => {
    const res = await request(app).get(`${BASE}/version`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "sust-transit-backend", version: expect.any(String) });
  });
});

describe("uniform errors", () => {
  it("returns 404 NOT_FOUND for an unknown route", async () => {
    const res = await request(app).get(`${BASE}/does-not-exist`);
    expect(res.status).toBe(404);
    expectUniformError(res.body, "NOT_FOUND");
  });

  it("returns 404 for a route outside the API base path", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(404);
    expectUniformError(res.body, "NOT_FOUND");
  });

  it("returns 400 BAD_REQUEST for malformed JSON", async () => {
    const res = await request(app)
      .post(`${BASE}/health`)
      .set("Content-Type", "application/json")
      .send('{"broken":');
    expect(res.status).toBe(400);
    expectUniformError(res.body, "BAD_REQUEST");
  });

  it("returns an error for a body over the 100kb limit", async () => {
    const res = await request(app)
      .post(`${BASE}/health`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ blob: "x".repeat(150_000) }));
    expect(res.status).toBe(413);
    expectUniformError(res.body, "BAD_REQUEST");
  });

  it("echoes the response header request id inside the error body", async () => {
    const res = await request(app).get(`${BASE}/does-not-exist`);
    expect(res.headers["x-request-id"]).toBe(res.body.error.requestId);
  });

  it("reuses a safe caller-supplied X-Request-Id", async () => {
    const res = await request(app)
      .get(`${BASE}/does-not-exist`)
      .set("X-Request-Id", "trace-abc-12345");
    expect(res.headers["x-request-id"]).toBe("trace-abc-12345");
    expect(res.body.error.requestId).toBe("trace-abc-12345");
  });

  it("replaces an unsafe caller-supplied X-Request-Id", async () => {
    const res = await request(app)
      .get(`${BASE}/does-not-exist`)
      .set("X-Request-Id", "bad id with spaces");
    expect(res.headers["x-request-id"]).not.toBe("bad id with spaces");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("security headers and CORS", () => {
  it("sets helmet headers and hides x-powered-by", async () => {
    const res = await request(app).get(`${BASE}/health`);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("allows the configured client origin with credentials", async () => {
    const res = await request(app).get(`${BASE}/health`).set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not grant CORS to other origins", async () => {
    const res = await request(app).get(`${BASE}/health`).set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("does not crash on repeated query parameters (hpp)", async () => {
    const res = await request(app).get(`${BASE}/health?a=1&a=2`);
    expect(res.status).toBe(200);
  });
});
