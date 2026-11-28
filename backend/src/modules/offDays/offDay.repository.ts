import type { OffDayType, Weekday } from "../../config/constants.js";
import { db } from "../../db/knex.js";
import type { DbExecutor } from "../../db/transaction.js";
import type { OffDayRow } from "./offDay.mapper.js";

const COLUMNS = ["id", "vehicle_id", "type", "off_date", "weekday", "reason"];

/** Oldest first, so the list is stable between calls. */
export async function listOffDayRows(
  filters: { vehicleId?: string },
  executor: DbExecutor = db,
): Promise<OffDayRow[]> {
  const query = executor("vehicle_off_days").select<OffDayRow[]>(COLUMNS);
  if (filters.vehicleId) query.where("vehicle_id", filters.vehicleId);
  return query.orderBy("created_at").orderBy("id");
}

/** Every off-day of every vehicle that applies on `date` (a one-time match) or `weekday` (recurring). */
export async function listOffDayRowsApplyingOn(
  date: string,
  weekday: Weekday,
  executor: DbExecutor = db,
): Promise<OffDayRow[]> {
  return executor("vehicle_off_days")
    .select<OffDayRow[]>(COLUMNS)
    .where((builder) =>
      builder.where({ type: "One-time", off_date: date }).orWhere({ type: "Recurring", weekday }),
    )
    .orderBy("created_at")
    .orderBy("id");
}

export async function findOffDayRow(
  id: string,
  executor: DbExecutor = db,
  options: { forUpdate?: boolean } = {},
): Promise<OffDayRow | null> {
  const query = executor("vehicle_off_days").select<OffDayRow[]>(COLUMNS).where({ id });
  if (options.forUpdate) query.forUpdate();
  const row = await query.first();
  return row ?? null;
}

export interface OffDayColumns {
  type: OffDayType;
  off_date: string | null;
  weekday: Weekday | null;
  reason: string | null;
}

export async function insertOffDayRow(
  executor: DbExecutor,
  row: OffDayColumns & { id: string; vehicle_id: string },
): Promise<void> {
  await executor("vehicle_off_days").insert(row);
}

export async function updateOffDayRow(
  executor: DbExecutor,
  id: string,
  columns: OffDayColumns,
): Promise<void> {
  await executor("vehicle_off_days").where({ id }).update(columns);
}

export async function deleteOffDayRow(executor: DbExecutor, id: string): Promise<void> {
  await executor("vehicle_off_days").where({ id }).delete();
}
