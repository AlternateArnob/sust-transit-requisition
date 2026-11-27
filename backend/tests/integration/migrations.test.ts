import { afterAll, describe, expect, it } from "vitest";
import {
  ALLOCATION_EVENTS,
  APPLICANT_PROFILES,
  APPLICATION_STATUSES,
  DIRECTORY_KINDS,
  DRIVER_DESIGNATIONS,
  DRIVER_STATUSES,
  FILE_PURPOSES,
  OFF_DAY_TYPES,
  OTP_PURPOSES,
  REJECTION_REASONS,
  REQUESTED_VEHICLE_CATEGORIES,
  REQUISITION_TYPES,
  TRIP_STATUSES,
  USER_ROLES,
  VEHICLE_CATEGORIES,
  VEHICLE_OPERATIONAL_STATUSES,
  WEEKDAYS,
} from "../../src/config/constants.js";
import { db, listAppTables } from "../helpers/db.js";
import { migrateLatest, migrateRollbackAll } from "../helpers/migrate.js";

const EXPECTED_TABLES = [
  "allocation_history",
  "allocations",
  "audit_logs",
  "confirmation_slips",
  "directory_units",
  "drivers",
  "duty_slip_trips",
  "duty_slips",
  "files",
  "mileage_entries",
  "notifications",
  "otp_challenges",
  "refresh_tokens",
  "requisition_counters",
  "requisitions",
  "student_transport_slots",
  "student_transport_vehicles",
  "trips",
  "users",
  "vehicle_off_days",
  "vehicles",
].sort();

afterAll(async () => {
  await db.destroy();
});

describe("migrations", () => {
  it("creates all 21 tables from Part 1 §10.2", async () => {
    expect(await listAppTables()).toEqual(EXPECTED_TABLES);
    expect(EXPECTED_TABLES).toHaveLength(21);
  });

  it("migrates down to nothing and up again (up -> down -> up)", async () => {
    try {
      migrateRollbackAll();
      expect(await listAppTables()).toEqual([]);
    } finally {
      // Always leave the database migrated, even if the assertion above fails.
      migrateLatest();
    }
    expect(await listAppTables()).toEqual(EXPECTED_TABLES);
  });

  it("is a no-op when run again on an up-to-date database", () => {
    expect(migrateLatest()).toContain("Already up to date");
  });

  it("makes every table InnoDB with the utf8mb4_0900_ai_ci collation", async () => {
    const [rows] = (await db.raw(
      `SELECT table_name AS name, engine AS engine, table_collation AS collation
         FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name NOT LIKE 'knex\\_%'`,
    )) as [{ name: string; engine: string; collation: string }[], unknown];
    expect(rows).toHaveLength(21);
    for (const row of rows) {
      expect(row.engine, row.name).toBe("InnoDB");
      expect(row.collation, row.name).toBe("utf8mb4_0900_ai_ci");
    }
  });

  it("has no reserved_for column anywhere (feature removed from the product)", async () => {
    const [rows] = (await db.raw(
      `SELECT table_name AS name FROM information_schema.columns
        WHERE table_schema = DATABASE() AND column_name LIKE '%reserved%'`,
    )) as [{ name: string }[], unknown];
    expect(rows).toEqual([]);
  });

  it("has no permanent_vehicle_id on drivers (the link lives only on vehicles)", async () => {
    const [rows] = (await db.raw(
      `SELECT column_name AS name FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'drivers' AND column_name LIKE 'permanent%'`,
    )) as [{ name: string }[], unknown];
    expect(rows).toEqual([]);
  });

  it("has the dedupe_key column that the notifications unique key needs", async () => {
    const [rows] = (await db.raw(
      `SELECT is_nullable AS nullable FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'notifications' AND column_name = 'dedupe_key'`,
    )) as [{ nullable: string }[], unknown];
    expect(rows).toEqual([{ nullable: "YES" }]);
  });
});

/** Parses MySQL's COLUMN_TYPE "enum('a','b')" into ["a", "b"]. */
function parseEnum(columnType: string): string[] {
  return [...columnType.matchAll(/'((?:[^']|'')*)'/g)].map((match) =>
    (match[1] ?? "").replace(/''/g, "'"),
  );
}

describe("ENUM columns match config/constants.ts (drift guard)", () => {
  const cases: [table: string, column: string, expected: readonly string[]][] = [
    ["directory_units", "kind", DIRECTORY_KINDS],
    ["users", "role", USER_ROLES],
    ["users", "applicant_profile", APPLICANT_PROFILES],
    ["otp_challenges", "purpose", OTP_PURPOSES],
    ["files", "purpose", FILE_PURPOSES],
    ["drivers", "designation", DRIVER_DESIGNATIONS],
    ["drivers", "status", DRIVER_STATUSES],
    ["vehicles", "category", VEHICLE_CATEGORIES],
    ["vehicles", "operational_status", VEHICLE_OPERATIONAL_STATUSES],
    ["vehicle_off_days", "type", OFF_DAY_TYPES],
    ["vehicle_off_days", "weekday", WEEKDAYS],
    ["student_transport_slots", "weekday", WEEKDAYS],
    ["requisitions", "applicant_profile", APPLICANT_PROFILES],
    ["requisitions", "requisition_type", REQUISITION_TYPES],
    ["requisitions", "status", APPLICATION_STATUSES],
    ["trips", "vehicle_category", REQUESTED_VEHICLE_CATEGORIES],
    ["trips", "status", TRIP_STATUSES],
    ["trips", "rejection_reason", REJECTION_REASONS],
    ["allocation_history", "event", ALLOCATION_EVENTS],
  ];

  it.each(cases)("%s.%s", async (table, column, expected) => {
    const [rows] = (await db.raw(
      `SELECT column_type AS type FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column],
    )) as [{ type: string }[], unknown];
    expect(rows).toHaveLength(1);
    expect(parseEnum(rows[0]?.type ?? "")).toEqual([...expected]);
  });
});
