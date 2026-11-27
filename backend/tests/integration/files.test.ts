import { randomUUID } from "node:crypto";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { resetRateLimitStores } from "../../src/middleware/rateLimit.js";
import { insertFile } from "../../src/modules/files/file.repository.js";
import { detectFileType, writeStoredFile } from "../../src/services/fileStorage.js";
import { db, truncateAll } from "../helpers/db.js";
import { resetUploads, tinyJpeg, tinyPdf, tinyPng } from "../helpers/files.js";
import {
  bearer,
  createFileRow,
  createFreshApplicant,
  createUserWithPassword,
} from "../helpers/session.js";

const BASE = env.API_BASE_PATH;
const app = createApp();
const download = (id: string, token?: Record<string, string>) => {
  const req = request(app).get(`${BASE}/files/${id}`).buffer(true).parse(binaryParser);
  return token ? req.set(token) : req;
};

/** Collects the body as a Buffer instead of letting supertest guess. */
function binaryParser(res: request.Response, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

/** Stores real bytes on disk plus a `files` row, like the upload endpoints do. */
async function storeFile(
  ownerId: unknown,
  content: Buffer,
  overrides: Record<string, unknown> = {},
) {
  const detected = detectFileType(content);
  if (!detected) throw new Error("test content must be a known type");
  const written = await writeStoredFile(content, detected);
  const id = randomUUID();
  await insertFile({
    id,
    owner_user_id: String(ownerId),
    purpose: "signature",
    original_name: "signature.png",
    mime_type: detected.mime,
    size_bytes: written.sizeBytes,
    storage_name: written.storageName,
    sha256: written.sha256,
    ...overrides,
  });
  return { id, storageName: written.storageName };
}

beforeEach(async () => {
  await truncateAll();
  resetRateLimitStores();
  resetUploads();
});

afterAll(async () => {
  await db.destroy();
});

describe("GET /files/:id", () => {
  it("sends the owner their image with safe headers", async () => {
    const owner = await createUserWithPassword();
    const png = tinyPng();
    const file = await storeFile(owner.id, png);

    const res = await download(file.id, bearer(owner));

    expect(res.status).toBe(200);
    expect(Buffer.isBuffer(res.body) && res.body.equals(png)).toBe(true);
    expect(res.headers["content-type"]).toMatch(/^image\/png/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toBe("private, max-age=0, must-revalidate");
    expect(res.headers["content-disposition"]).toBe("inline");
    expect(res.headers["content-length"]).toBe(String(png.length));
  });

  it("serves a JPEG with its own type", async () => {
    const owner = await createUserWithPassword();
    const file = await storeFile(owner.id, tinyJpeg(), { original_name: "sig.jpg" });
    const res = await download(file.id, bearer(owner));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^image\/jpeg/);
  });

  it("sends a PDF as an attachment under its original name", async () => {
    const owner = await createUserWithPassword();
    const file = await storeFile(owner.id, tinyPdf(), {
      purpose: "supporting_document",
      original_name: "Approval letter.pdf",
    });
    const res = await download(file.id, bearer(owner));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/pdf/);
    expect(res.headers["content-disposition"]).toMatch(
      /^attachment; filename="Approval letter\.pdf"/,
    );
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("answers 404, not 403, for somebody else's file, so its existence is not revealed", async () => {
    const owner = await createUserWithPassword();
    const stranger = await createUserWithPassword();
    const file = await storeFile(owner.id, tinyPng());

    const theirs = await download(file.id, bearer(stranger));
    const missing = await download(randomUUID(), bearer(stranger));
    expect(theirs.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(JSON.parse(theirs.body.toString()).error.code).toBe("NOT_FOUND");
    expect(JSON.parse(theirs.body.toString()).error.message).toBe(
      JSON.parse(missing.body.toString()).error.message,
    );
  });

  it("answers 404 when the row exists but the file is gone from disk", async () => {
    const owner = await createUserWithPassword();
    const file = await storeFile(owner.id, tinyPng());
    unlinkSync(join(process.env.UPLOAD_DIR as string, file.storageName));
    const res = await download(file.id, bearer(owner));
    expect(res.status).toBe(404);
  });

  it("answers 404 for a row whose storage name is not a server-made name", async () => {
    const owner = await createUserWithPassword();
    const row = await createFileRow(owner.id, { storage_name: "../../etc/passwd" });
    const res = await download(String(row.id), bearer(owner));
    expect(res.status).toBe(404);
  });

  it("needs authentication", async () => {
    const owner = await createUserWithPassword();
    const file = await storeFile(owner.id, tinyPng());
    expect((await download(file.id)).status).toBe(401);
  });

  it("is not available to an onboarding token", async () => {
    const owner = await createFreshApplicant();
    const file = await storeFile(owner.id, tinyPng());
    expect((await download(file.id, bearer(owner, "onboarding"))).status).toBe(403);
  });

  it("rejects an id that is not a UUID", async () => {
    const owner = await createUserWithPassword();
    const res = await download("not-a-uuid", bearer(owner));
    expect(res.status).toBe(422);
  });

  it("serves the signature that POST /me/signature stored, at the URL it returned", async () => {
    const owner = await createUserWithPassword();
    const png = tinyPng();
    const uploaded = await request(app)
      .post(`${BASE}/me/signature`)
      .set(bearer(owner))
      .attach("file", png, { filename: "s.png", contentType: "image/png" });
    const res = await download(uploaded.body.signatureUrl.split("/").pop(), bearer(owner));
    expect(res.status).toBe(200);
    expect(Buffer.isBuffer(res.body) && res.body.equals(png)).toBe(true);
  });
});
