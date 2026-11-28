import type { Weekday } from "../../config/constants.js";
import { db } from "../../db/knex.js";
import type { DbExecutor } from "../../db/transaction.js";
import type { StudentTransportSchedule } from "../../types/index.js";
import type { ScheduleEntryRow, ScheduleSlotRow } from "./transportSchedule.mapper.js";

/** Every entry, ordered by the vehicle's registration number so the list is stable. */
export async function listEntries(executor: DbExecutor = db): Promise<ScheduleEntryRow[]> {
  return executor("student_transport_vehicles as e")
    .join("vehicles as v", "v.id", "e.vehicle_id")
    .select<ScheduleEntryRow[]>(["e.id", "e.vehicle_id"])
    .orderBy("v.registration_number")
    .orderBy("e.id");
}

export async function listAllSlots(executor: DbExecutor = db): Promise<ScheduleSlotRow[]> {
  return executor("student_transport_slots").select<ScheduleSlotRow[]>([
    "entry_id",
    "weekday",
    "free_after",
  ]);
}

export async function findEntryByVehicle(
  vehicleId: string,
  executor: DbExecutor = db,
  options: { forUpdate?: boolean } = {},
): Promise<ScheduleEntryRow | null> {
  const query = executor("student_transport_vehicles")
    .select<ScheduleEntryRow[]>(["id", "vehicle_id"])
    .where({ vehicle_id: vehicleId });
  if (options.forUpdate) query.forUpdate();
  const row = await query.first();
  return row ?? null;
}

export async function listSlots(
  entryId: string,
  executor: DbExecutor = db,
): Promise<ScheduleSlotRow[]> {
  return executor("student_transport_slots")
    .select<ScheduleSlotRow[]>(["entry_id", "weekday", "free_after"])
    .where({ entry_id: entryId });
}

/** The "free after" time of every vehicle that has one on `weekday` (for the schedule lookup). */
export async function listSlotsOnWeekday(
  weekday: Weekday,
  executor: DbExecutor = db,
): Promise<(ScheduleSlotRow & { vehicle_id: string })[]> {
  return executor("student_transport_slots as s")
    .join("student_transport_vehicles as e", "e.id", "s.entry_id")
    .select<(ScheduleSlotRow & { vehicle_id: string })[]>([
      "s.entry_id",
      "s.weekday",
      "s.free_after",
      "e.vehicle_id",
    ])
    .where("s.weekday", weekday);
}

export async function insertEntry(
  executor: DbExecutor,
  entry: { id: string; vehicle_id: string },
): Promise<void> {
  await executor("student_transport_vehicles").insert(entry);
}

/** Bumps `updated_at` (MySQL only does it when a column value changes). */
export async function touchEntry(executor: DbExecutor, id: string): Promise<void> {
  await executor("student_transport_vehicles")
    .where({ id })
    .update({ updated_at: executor.raw("CURRENT_TIMESTAMP(3)") });
}

/** Replaces all slots of an entry with `schedule` (delete, then insert). */
export async function replaceSlots(
  executor: DbExecutor,
  entryId: string,
  schedule: StudentTransportSchedule,
): Promise<void> {
  await executor("student_transport_slots").where({ entry_id: entryId }).delete();
  const rows = Object.entries(schedule).map(([weekday, freeAfter]) => ({
    entry_id: entryId,
    weekday,
    free_after: freeAfter,
  }));
  if (rows.length > 0) await executor("student_transport_slots").insert(rows);
}

/** The slots go with it (`ON DELETE CASCADE`). */
export async function deleteEntry(executor: DbExecutor, id: string): Promise<void> {
  await executor("student_transport_vehicles").where({ id }).delete();
}

export interface AllocationOnDateRow {
  vehicle_id: string;
  trip_id: string;
  requisition_id: string;
  start_time: string;
  end_time: string;
  purpose: string;
}

/** Allocations on one date, earliest first, with the requisition's purpose for the lookup page. */
export async function listAllocationsOnDate(
  date: string,
  executor: DbExecutor = db,
): Promise<AllocationOnDateRow[]> {
  return executor("allocations as a")
    .join("requisitions as r", "r.id", "a.requisition_id")
    .select<AllocationOnDateRow[]>([
      "a.vehicle_id",
      "a.trip_id",
      "a.requisition_id",
      "a.start_time",
      "a.end_time",
      "r.purpose",
    ])
    .where("a.alloc_date", date)
    .orderBy("a.start_time")
    .orderBy("a.id");
}
