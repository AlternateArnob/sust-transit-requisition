import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { resetRateLimitStores } from "../../src/middleware/rateLimit.js";
import { replaceSignature } from "../../src/modules/users/profile.service.js";
import { db, truncateAll } from "../helpers/db.js";
import { createUser } from "../helpers/factories.js";
import {
  listUploads,
  pngDataUrl,
  resetUploads,
  tinyJpeg,
  tinyPdf,
  tinyPng,
} from "../helpers/files.js";
import { bearer, createFreshApplicant, createUserWithPassword } from "../helpers/session.js";

const BASE = env.API_BASE_PATH;
const app = createApp();
const URL = `${BASE}/me/signature`;

const upload = (
  token: Record<string, string>,
  file: Buffer,
  name = "signature.png",
  type = "image/png",
) => request(app).post(URL).set(token).attach("file", file, { filename: name, contentType: type });
const sendJson = (token: Record<string, string>, body: unknown) =>
  request(app)
    .post(URL)
    .set(token)
    .send(body as object);
const userRow = (id: unknown) => db("users").where({ id }).first();
const fileRows = () => db("files").select();
const uploadPath = (storageName: string) => join(process.env.UPLOAD_DIR as string, storageName);

beforeEach(async () => {
  await truncateAll();
  resetRateLimitStores();
  resetUploads();
});

afterAll(async () => {
  await db.destroy();
});

describe("POST /me/signature: access", () => {
  it("needs authentication", async () => {
    const res = await request(app).post(URL).attach("file", tinyPng(), "s.png");
    expect(res.status).toBe(401);
    expect(listUploads()).toEqual([]);
  });

  it("accepts an onboarding token and a full token", async () => {
    const fresh = await createFreshApplicant();
    expect((await upload(bearer(fresh, "onboarding"), tinyPng())).status).toBe(200);
    const full = await createUserWithPassword();
    expect((await upload(bearer(full), tinyPng())).status).toBe(200);
  });

  it("refuses an unverified account and leaves no file behind", async () => {
    const user = await createUser({ is_verified: 0 });
    const res = await upload(bearer(user, "onboarding"), tinyPng());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_NOT_VERIFIED");
    expect(listUploads()).toEqual([]);
    expect(await fileRows()).toHaveLength(0);
  });

  it("refuses a deactivated account", async () => {
    const user = await createFreshApplicant({ is_active: 0 });
    const res = await upload(bearer(user, "onboarding"), tinyPng());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });
});

describe("POST /me/signature: multipart upload", () => {
  it("stores a PNG: file on disk under a random name, a files row, and the user pointed at it", async () => {
    const user = await createFreshApplicant();
    const png = tinyPng();
    const res = await upload(bearer(user, "onboarding"), png, "../../my signature.png");

    expect(res.status).toBe(200);
    const [row] = await fileRows();
    expect(res.body).toEqual({ hasSignature: true, signatureUrl: `${BASE}/files/${row.id}` });
    expect(row).toMatchObject({
      owner_user_id: user.id,
      purpose: "signature",
      original_name: "my signature.png",
      mime_type: "image/png",
      size_bytes: png.length,
    });
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row.storage_name).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(row.storage_name).not.toContain("signature");
    expect(listUploads()).toEqual([row.storage_name]);
    expect(statSync(uploadPath(row.storage_name)).mode & 0o777).toBe(0o600);
    expect((await userRow(user.id)).signature_file_id).toBe(row.id);
  });

  it("stores a JPEG with the .jpg extension and image/jpeg type", async () => {
    const user = await createFreshApplicant();
    const res = await upload(bearer(user, "onboarding"), tinyJpeg(), "sig.jpeg", "image/jpeg");
    expect(res.status).toBe(200);
    const [row] = await fileRows();
    expect(row).toMatchObject({ mime_type: "image/jpeg" });
    expect(row.storage_name).toMatch(/\.jpg$/);
  });

  it("decides the type from the bytes: a JPEG sent as 'image/png' is stored as a JPEG", async () => {
    const user = await createFreshApplicant();
    const res = await upload(bearer(user, "onboarding"), tinyJpeg(), "sig.png", "image/png");
    expect(res.status).toBe(200);
    expect((await fileRows())[0]).toMatchObject({ mime_type: "image/jpeg" });
  });

  it("makes the signature show up in GET /me", async () => {
    const user = await createUserWithPassword();
    await upload(bearer(user), tinyPng());
    const me = await request(app).get(`${BASE}/me`).set(bearer(user));
    expect(me.body.hasSignature).toBe(true);
    expect(me.body.signatureUrl).toMatch(new RegExp(`^${BASE}/files/[0-9a-f-]{36}$`));
  });

  describe("rejects files that are not a PNG or JPEG", () => {
    it.each([
      ["a text file named .png", Buffer.from("this is not an image"), "fake.png", "image/png"],
      [
        "an HTML page named .png",
        Buffer.from("<html><script>alert(1)</script></html>"),
        "x.png",
        "image/png",
      ],
      [
        "an SVG",
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        "x.svg",
        "image/svg+xml",
      ],
      ["a GIF", Buffer.from("GIF89a......"), "x.gif", "image/gif"],
      ["a PDF named .png", tinyPdf(), "x.png", "image/png"],
      [
        "a PNG header with no IHDR chunk",
        Buffer.concat([tinyPng().subarray(0, 8), Buffer.from("junkjunkjunk")]),
        "x.png",
        "image/png",
      ],
      ["an empty file", Buffer.alloc(0), "empty.png", "image/png"],
    ])("%s", async (_name, content, filename, type) => {
      const user = await createFreshApplicant();
      const res = await upload(bearer(user, "onboarding"), content, filename, type);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details).toEqual([
        { path: "file", message: "The signature must be a PNG or JPEG image." },
      ]);
      expect(listUploads()).toEqual([]);
      expect(await fileRows()).toHaveLength(0);
      expect((await userRow(user.id)).signature_file_id).toBeNull();
    });
  });

  describe("size limit", () => {
    const withSize = (bytes: number) => tinyPng(bytes - tinyPng().length);

    it("accepts a file of exactly MAX_SIGNATURE_BYTES", async () => {
      const user = await createFreshApplicant();
      const res = await upload(bearer(user, "onboarding"), withSize(env.MAX_SIGNATURE_BYTES));
      expect(res.status).toBe(200);
    });

    it("rejects one byte more with 413 and stores nothing", async () => {
      const user = await createFreshApplicant();
      const res = await upload(bearer(user, "onboarding"), withSize(env.MAX_SIGNATURE_BYTES + 1));
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
      expect(listUploads()).toEqual([]);
      expect(await fileRows()).toHaveLength(0);
    });

    it("rejects a file several times the limit the same way", async () => {
      const user = await createFreshApplicant();
      const res = await upload(bearer(user, "onboarding"), withSize(env.MAX_SIGNATURE_BYTES * 4));
      expect(res.status).toBe(413);
      expect(listUploads()).toEqual([]);
    });
  });

  describe("malformed requests", () => {
    it("rejects a file sent in the wrong field", async () => {
      const user = await createFreshApplicant();
      const res = await request(app)
        .post(URL)
        .set(bearer(user, "onboarding"))
        .attach("photo", tinyPng(), "s.png");
      expect(res.status).toBe(422);
      expect(res.body.error.details).toEqual([
        { path: "photo", message: 'Send the file in the "file" field' },
      ]);
      expect(listUploads()).toEqual([]);
    });

    it("rejects a multipart request with no file", async () => {
      const user = await createFreshApplicant();
      const res = await request(app)
        .post(URL)
        .set(bearer(user, "onboarding"))
        .set("Content-Type", "multipart/form-data; boundary=xyz")
        .send("--xyz--\r\n");
      expect(res.status).toBe(422);
      expect(res.body.error.details).toEqual([
        { path: "file", message: "A signature image is required." },
      ]);
    });

    it("rejects extra text fields next to the file", async () => {
      const user = await createFreshApplicant();
      const res = await request(app)
        .post(URL)
        .set(bearer(user, "onboarding"))
        .field("note", "hello")
        .attach("file", tinyPng(), "s.png");
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(listUploads()).toEqual([]);
    });

    it("rejects a second file", async () => {
      const user = await createFreshApplicant();
      const res = await request(app)
        .post(URL)
        .set(bearer(user, "onboarding"))
        .attach("file", tinyPng(), "a.png")
        .attach("file", tinyPng(), "b.png");
      expect(res.status).toBe(400);
      expect(listUploads()).toEqual([]);
    });

    it("answers 400, not 500, for a broken multipart body", async () => {
      const user = await createFreshApplicant();
      const res = await request(app)
        .post(URL)
        .set(bearer(user, "onboarding"))
        .set("Content-Type", "multipart/form-data; boundary=xyz")
        .send(
          '--xyz\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\n\r\ntruncated',
        );
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(listUploads()).toEqual([]);
    });

    it("answers 415 when the body is neither multipart nor JSON", async () => {
      const user = await createFreshApplicant();
      const text = await request(app)
        .post(URL)
        .set(bearer(user, "onboarding"))
        .set("Content-Type", "text/plain")
        .send("hello");
      expect(text.status).toBe(415);
      expect(text.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
      const none = await request(app).post(URL).set(bearer(user, "onboarding"));
      expect(none.status).toBe(415);
    });
  });
});

describe("POST /me/signature: transitional JSON upload", () => {
  it("accepts a PNG data URL", async () => {
    const user = await createFreshApplicant();
    const png = tinyPng();
    const res = await sendJson(bearer(user, "onboarding"), { signatureDataUrl: pngDataUrl(png) });
    expect(res.status).toBe(200);
    const [row] = await fileRows();
    expect(res.body).toEqual({ hasSignature: true, signatureUrl: `${BASE}/files/${row.id}` });
    expect(row).toMatchObject({
      mime_type: "image/png",
      size_bytes: png.length,
      original_name: "signature.png",
    });
    expect(listUploads()).toEqual([row.storage_name]);
  });

  it("accepts a data URL larger than the app-wide 100 kb JSON limit, up to the signature limit", async () => {
    const user = await createFreshApplicant();
    const big = tinyPng(300 * 1024);
    const res = await sendJson(bearer(user, "onboarding"), { signatureDataUrl: pngDataUrl(big) });
    expect(res.status).toBe(200);
    expect((await fileRows())[0]?.size_bytes).toBe(big.length);
  });

  it("rejects a decoded image over MAX_SIGNATURE_BYTES with 413", async () => {
    const user = await createFreshApplicant();
    const tooBig = tinyPng(env.MAX_SIGNATURE_BYTES);
    const res = await sendJson(bearer(user, "onboarding"), {
      signatureDataUrl: pngDataUrl(tooBig),
    });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(listUploads()).toEqual([]);
  });

  it("rejects a JSON body far beyond the limit before storing anything", async () => {
    const user = await createFreshApplicant();
    const huge = {
      signatureDataUrl: `data:image/png;base64,${"A".repeat(env.MAX_SIGNATURE_BYTES * 3)}`,
    };
    const res = await sendJson(bearer(user, "onboarding"), huge);
    expect(res.status).toBe(413);
    expect(listUploads()).toEqual([]);
  });

  it("does not parse a large JSON body for an unauthenticated caller", async () => {
    const res = await request(app)
      .post(URL)
      .send({ signatureDataUrl: pngDataUrl(tinyPng(300 * 1024)) });
    expect(res.status).toBe(401);
  });

  it.each([
    ["not a data URL", "hello"],
    ["an SVG data URL", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="],
    ["a data URL with invalid base64", "data:image/png;base64,@@@@"],
    ["an empty payload", "data:image/png;base64,"],
  ])("rejects %s", async (_name, value) => {
    const user = await createFreshApplicant();
    const res = await sendJson(bearer(user, "onboarding"), { signatureDataUrl: value });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].path).toBe("signatureDataUrl");
    expect(listUploads()).toEqual([]);
  });

  it("rejects a data URL that is labelled as an image but holds something else", async () => {
    const user = await createFreshApplicant();
    const spoofed = `data:image/png;base64,${Buffer.from("just some text").toString("base64")}`;
    const res = await sendJson(bearer(user, "onboarding"), { signatureDataUrl: spoofed });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([
      { path: "file", message: "The signature must be a PNG or JPEG image." },
    ]);
    expect(listUploads()).toEqual([]);
  });

  it("rejects a PDF hidden in an image data URL", async () => {
    const user = await createFreshApplicant();
    const res = await sendJson(bearer(user, "onboarding"), {
      signatureDataUrl: pngDataUrl(tinyPdf()),
    });
    expect(res.status).toBe(422);
  });

  it("rejects a missing key, an empty body and unknown keys", async () => {
    const user = await createFreshApplicant();
    for (const body of [
      {},
      { signature: pngDataUrl() },
      { signatureDataUrl: pngDataUrl(), extra: 1 },
    ]) {
      const res = await sendJson(bearer(user, "onboarding"), body);
      expect(res.status).toBe(422);
      expect(res.body.error.details).toEqual([
        { path: "file", message: "A signature image is required." },
      ]);
    }
  });
});

describe("POST /me/signature: replacing a signature", () => {
  it("removes the previous file from disk and from the database", async () => {
    const user = await createFreshApplicant();
    await upload(bearer(user, "onboarding"), tinyPng());
    const [first] = await fileRows();

    const res = await upload(bearer(user, "onboarding"), tinyJpeg(), "second.jpg", "image/jpeg");
    expect(res.status).toBe(200);

    const rows = await fileRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(first.id);
    expect(rows[0].storage_name).toMatch(/\.jpg$/);
    expect(existsSync(uploadPath(first.storage_name))).toBe(false);
    expect(listUploads()).toEqual([rows[0].storage_name]);
    expect((await userRow(user.id)).signature_file_id).toBe(rows[0].id);
    expect(res.body.signatureUrl).toBe(`${BASE}/files/${rows[0].id}`);
  });

  it("keeps the old signature when the new upload is rejected", async () => {
    const user = await createFreshApplicant();
    await upload(bearer(user, "onboarding"), tinyPng());
    const [first] = await fileRows();

    const res = await upload(bearer(user, "onboarding"), Buffer.from("not an image"));
    expect(res.status).toBe(422);

    expect((await userRow(user.id)).signature_file_id).toBe(first.id);
    expect(listUploads()).toEqual([first.storage_name]);
  });

  it("never touches another user's signature", async () => {
    const alice = await createFreshApplicant();
    const bob = await createFreshApplicant();
    await upload(bearer(alice, "onboarding"), tinyPng());
    await upload(bearer(bob, "onboarding"), tinyPng());
    await upload(bearer(bob, "onboarding"), tinyJpeg(), "b2.jpg", "image/jpeg");

    expect(await fileRows()).toHaveLength(2);
    const aliceFile = await db("files").where({ owner_user_id: alice.id }).first();
    expect(existsSync(uploadPath(aliceFile.storage_name))).toBe(true);
    expect((await userRow(alice.id)).signature_file_id).toBe(aliceFile.id);
  });

  it("does not leave an orphan file when the database step fails", async () => {
    // The account disappears after authentication but before the transaction: the service must
    // clean up the file it already wrote.
    await expect(
      replaceSignature("00000000-0000-4000-8000-000000000000", { buffer: tinyPng() }),
    ).rejects.toMatchObject({ status: 401 });
    expect(listUploads()).toEqual([]);
    expect(await fileRows()).toHaveLength(0);
  });
});

describe("POST /me/signature: rate limit", () => {
  it("allows 30 uploads per user per window, then answers 429", async () => {
    const user = await createFreshApplicant();
    const other = await createFreshApplicant();
    for (let i = 0; i < 30; i += 1) {
      const res = await sendJson(bearer(user, "onboarding"), { signatureDataUrl: pngDataUrl() });
      expect(res.status).toBe(200);
    }
    const blocked = await sendJson(bearer(user, "onboarding"), { signatureDataUrl: pngDataUrl() });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    // The limit is per user, not shared.
    expect(
      (await sendJson(bearer(other, "onboarding"), { signatureDataUrl: pngDataUrl() })).status,
    ).toBe(200);
  });
});
