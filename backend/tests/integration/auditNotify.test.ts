import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { withTransaction } from "../../src/db/transaction.js";
import { audit } from "../../src/services/audit.js";
import { notifyUser } from "../../src/services/notify.js";
import { db, truncateAll } from "../helpers/db.js";
import { createUser } from "../helpers/factories.js";

beforeEach(truncateAll);
afterAll(() => db.destroy());

describe("audit.log", () => {
  it("writes actor, action, entity, before/after JSON, ip and request id", async () => {
    const actor = await createUser({ role: "SuperAdmin" });
    await audit.log(db, {
      actor: { id: actor.id as string, role: "SuperAdmin" },
      action: "user.role_changed",
      entityType: "user",
      entityId: "abc",
      before: { role: "Applicant" },
      after: { role: "TransportInCharge" },
      ip: "10.1.2.3",
      requestId: "req-1",
    });

    const [row] = await db("audit_logs");
    expect(row).toMatchObject({
      actor_user_id: actor.id,
      actor_role: "SuperAdmin",
      action: "user.role_changed",
      entity_type: "user",
      entity_id: "abc",
      before_json: { role: "Applicant" },
      after_json: { role: "TransportInCharge" },
      ip: "10.1.2.3",
      request_id: "req-1",
    });
  });

  it("allows events with no actor and no before/after", async () => {
    await audit.log(db, { action: "auth.login_failed", entityType: "user", entityId: "x" });
    const [row] = await db("audit_logs");
    expect(row).toMatchObject({
      actor_user_id: null,
      actor_role: null,
      before_json: null,
      after_json: null,
      ip: null,
      request_id: null,
    });
  });

  it("commits and rolls back together with the surrounding transaction", async () => {
    await expect(
      withTransaction(async (trx) => {
        await audit.log(trx, { action: "a", entityType: "user", entityId: "1" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await db("audit_logs")).toHaveLength(0);

    await withTransaction((trx) =>
      audit.log(trx, { action: "b", entityType: "user", entityId: "1" }),
    );
    expect(await db("audit_logs")).toHaveLength(1);
  });

  it("stores nested values and keeps ids ascending", async () => {
    await audit.log(db, {
      action: "a",
      entityType: "e",
      entityId: "1",
      after: { x: { y: [1, 2] } },
    });
    await audit.log(db, { action: "b", entityType: "e", entityId: "1" });
    const rows = await db("audit_logs").orderBy("id");
    expect(rows[0].after_json).toEqual({ x: { y: [1, 2] } });
    expect(Number(rows[1].id)).toBeGreaterThan(Number(rows[0].id));
  });
});

describe("notifyUser", () => {
  it("creates an unread notification for exactly one recipient", async () => {
    const user = await createUser();
    await notifyUser(db, {
      recipientUserId: user.id as string,
      type: "Account Status Changed",
      message: "Your account was deactivated by a Super Admin.",
      linkType: "user",
      linkId: user.id as string,
    });

    const [row] = await db("notifications");
    expect(row).toMatchObject({
      recipient_user_id: user.id,
      type: "Account Status Changed",
      message: "Your account was deactivated by a Super Admin.",
      link_type: "user",
      link_id: user.id,
      is_read: 0,
      read_at: null,
      dedupe_key: null,
    });
  });

  it("ignores a second insert with the same dedupe key", async () => {
    const user = await createUser();
    const n = {
      recipientUserId: user.id as string,
      type: "Configuration" as const,
      message: "No Department Head is configured for Physics.",
      linkType: "requisition" as const,
      linkId: "TRS-2026-001",
      dedupeKey: "config:TRS-2026-001",
    };
    await notifyUser(db, n);
    await notifyUser(db, n);
    expect(await db("notifications")).toHaveLength(1);
  });

  it("allows many notifications without a dedupe key", async () => {
    const user = await createUser();
    const n = {
      recipientUserId: user.id as string,
      type: "New Requisition" as const,
      message: "m",
      linkType: "requisition" as const,
      linkId: "x",
    };
    await notifyUser(db, n);
    await notifyUser(db, n);
    expect(await db("notifications")).toHaveLength(2);
  });

  it("truncates an over-long message to the column size", async () => {
    const user = await createUser();
    await notifyUser(db, {
      recipientUserId: user.id as string,
      type: "Resubmission",
      message: "x".repeat(1500),
      linkType: "requisition",
      linkId: "x",
    });
    expect((await db("notifications").first()).message).toHaveLength(1000);
  });

  it("rolls back with the surrounding transaction", async () => {
    const user = await createUser();
    await expect(
      withTransaction(async (trx) => {
        await notifyUser(trx, {
          recipientUserId: user.id as string,
          type: "Trip Approved",
          message: "m",
          linkType: "requisition",
          linkId: "x",
        });
        throw new Error("boom");
      }),
    ).rejects.toThrow();
    expect(await db("notifications")).toHaveLength(0);
  });

  it("rejects an unknown recipient (foreign key)", async () => {
    await expect(
      notifyUser(db, {
        recipientUserId: randomUUID(),
        type: "Trip Approved",
        message: "m",
        linkType: "requisition",
        linkId: "x",
      }),
    ).rejects.toMatchObject({ code: "ER_NO_REFERENCED_ROW_2" });
  });
});
