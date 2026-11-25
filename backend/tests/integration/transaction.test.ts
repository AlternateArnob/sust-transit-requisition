import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { withTransaction } from "../../src/db/transaction.js";
import { db, truncateAll } from "../helpers/db.js";

beforeEach(truncateAll);
afterAll(async () => {
  await db.destroy();
});

const count = async () => Number((await db("directory_units").count({ n: "*" }).first())?.n);

describe("withTransaction", () => {
  it("commits and returns the callback's value", async () => {
    const result = await withTransaction(async (trx) => {
      await trx("directory_units").insert({ kind: "Department", name: "Physics" });
      return "done";
    });
    expect(result).toBe("done");
    expect(await count()).toBe(1);
  });

  it("rolls back every write and re-throws when the callback throws", async () => {
    await expect(
      withTransaction(async (trx) => {
        await trx("directory_units").insert({ kind: "Department", name: "Physics" });
        await trx("directory_units").insert({ kind: "Office", name: "Registrar" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await count()).toBe(0);
  });

  it("rolls back when a database constraint fails part-way through", async () => {
    await expect(
      withTransaction(async (trx) => {
        await trx("directory_units").insert({ kind: "Department", name: "Chemistry" });
        await trx("directory_units").insert({ kind: "Department", name: "Chemistry" });
      }),
    ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    expect(await count()).toBe(0);
  });

  it("does not expose uncommitted writes to other connections", async () => {
    await withTransaction(async (trx) => {
      await trx("directory_units").insert({ kind: "Department", name: "Botany" });
      expect(await count()).toBe(0);
    });
    expect(await count()).toBe(1);
  });
});

describe("truncateAll", () => {
  it("empties every table, resets auto-increment and keeps foreign-key checks on afterwards", async () => {
    await db("directory_units").insert({ kind: "Department", name: "Zoology" });
    await truncateAll();
    expect(await count()).toBe(0);
    const inserted = await db("directory_units").insert({ kind: "Department", name: "Zoology" });
    expect(inserted[0]).toBe(1);

    const [rows] = (await db.raw("SELECT @@foreign_key_checks AS fk")) as [
      { fk: number }[],
      unknown,
    ];
    expect(rows[0]?.fk).toBe(1);
  });

  it("keeps Knex's migration bookkeeping", async () => {
    await truncateAll();
    expect(Number((await db("knex_migrations").count({ n: "*" }).first())?.n)).toBe(6);
  });
});
