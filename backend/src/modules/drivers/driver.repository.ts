import type { DriverDesignation, DriverStatus } from "../../config/constants.js";
import { db } from "../../db/knex.js";
import type { DbExecutor } from "../../db/transaction.js";
import { escapeLike } from "../../http/pagination.js";
import type { DriverRow } from "./driver.mapper.js";

const COLUMNS = [
  "d.id",
  "d.name",
  "d.designation",
  "d.phone",
  "d.status",
  "v.id as permanent_vehicle_id",
];

/** `drivers d LEFT JOIN vehicles v`: the only place the driver <-> vehicle link is read from. */
const baseQuery = (executor: DbExecutor) =>
  executor("drivers as d")
    .leftJoin("vehicles as v", "v.permanent_driver_id", "d.id")
    .select<DriverRow[]>(COLUMNS);

export interface DriverFilters {
  status?: DriverStatus;
  q?: string;
}

export async function listDrivers(
  filters: DriverFilters,
  executor: DbExecutor = db,
): Promise<DriverRow[]> {
  const query = baseQuery(executor);
  if (filters.status) query.where("d.status", filters.status);
  if (filters.q) {
    const like = `%${escapeLike(filters.q)}%`;
    query.where((builder) =>
      builder
        .whereRaw("d.name LIKE ? ESCAPE '\\\\'", [like])
        .orWhereRaw("d.designation LIKE ? ESCAPE '\\\\'", [like])
        .orWhereRaw("d.phone LIKE ? ESCAPE '\\\\'", [like]),
    );
  }
  return query.orderBy("d.name").orderBy("d.id");
}

/**
 * One driver with their vehicle link. `forUpdate` locks the driver row only (FOR UPDATE ... OF),
 * so the vehicle row is never locked from the driver side: everything that touches both locks
 * the driver first and the vehicle second.
 */
export async function findDriver(
  id: string,
  executor: DbExecutor = db,
  options: { forUpdate?: boolean } = {},
): Promise<DriverRow | null> {
  if (options.forUpdate) {
    const locked = await executor.raw("SELECT id FROM drivers WHERE id = ? FOR UPDATE", [id]);
    if ((locked[0] as unknown[]).length === 0) return null;
  }
  const row = await baseQuery(executor).where("d.id", id).first();
  return row ?? null;
}

export interface NewDriver {
  id: string;
  name: string;
  designation: DriverDesignation;
  phone: string | null;
}

export async function insertDriver(executor: DbExecutor, driver: NewDriver): Promise<void> {
  await executor("drivers").insert({ ...driver, status: "Active" });
}

export type DriverColumns = Partial<{
  name: string;
  designation: DriverDesignation;
  phone: string | null;
  status: DriverStatus;
}>;

export async function updateDriverColumns(
  executor: DbExecutor,
  id: string,
  columns: DriverColumns,
): Promise<void> {
  await executor("drivers").where({ id }).update(columns);
}

export async function deleteDriverRow(executor: DbExecutor, id: string): Promise<void> {
  await executor("drivers").where({ id }).delete();
}

/** Drops the driver's permanent-vehicle link (the link lives on the vehicle row). */
export async function clearVehicleLink(executor: DbExecutor, driverId: string): Promise<number> {
  return executor("vehicles").where({ permanent_driver_id: driverId }).update({
    permanent_driver_id: null,
  });
}

export interface DriverReferences {
  vehicles: number;
  allocations: number;
  dutySlips: number;
  allocationHistory: number;
}

const countWhere = async (
  executor: DbExecutor,
  table: string,
  column: string,
  id: string,
): Promise<number> => {
  const row = await executor(table).where(column, id).count({ total: "*" }).first();
  return Number(row?.total ?? 0);
};

/**
 * Everything that still points at the driver. `allocations.driver_id` is `ON DELETE SET NULL` and
 * the slip and history tables have no foreign key at all, so the database would let a delete go
 * through and silently blank those rows; the service checks here instead (Part 1 §12.6).
 */
export async function countDriverReferences(
  executor: DbExecutor,
  id: string,
): Promise<DriverReferences> {
  const [vehicles, allocations, dutySlips, allocationHistory] = await Promise.all([
    countWhere(executor, "vehicles", "permanent_driver_id", id),
    countWhere(executor, "allocations", "driver_id", id),
    countWhere(executor, "duty_slips", "driver_id", id),
    countWhere(executor, "allocation_history", "driver_id", id),
  ]);
  return { vehicles, allocations, dutySlips, allocationHistory };
}
