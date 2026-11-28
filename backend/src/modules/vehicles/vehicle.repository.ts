import type { VehicleCategory, VehicleOperationalStatus } from "../../config/constants.js";
import { db } from "../../db/knex.js";
import type { DbExecutor } from "../../db/transaction.js";
import { escapeLike } from "../../http/pagination.js";
import type { VehicleRow } from "./vehicle.mapper.js";

const COLUMNS = [
  "v.id",
  "v.registration_number",
  "v.category",
  "v.fuel_type",
  "v.operational_status",
  "v.available_for_requisition",
  "v.permanent_driver_id",
  "d.name as driver_name",
  "d.designation as driver_designation",
  "d.phone as driver_phone",
  "d.status as driver_status",
];

const baseQuery = (executor: DbExecutor) =>
  executor("vehicles as v")
    .leftJoin("drivers as d", "d.id", "v.permanent_driver_id")
    .select<VehicleRow[]>(COLUMNS);

export interface VehicleFilters {
  q?: string;
  category?: VehicleCategory;
  status?: VehicleOperationalStatus;
}

export async function listVehicles(
  filters: VehicleFilters,
  executor: DbExecutor = db,
): Promise<VehicleRow[]> {
  const query = baseQuery(executor);
  if (filters.category) query.where("v.category", filters.category);
  if (filters.status) query.where("v.operational_status", filters.status);
  if (filters.q) {
    const like = `%${escapeLike(filters.q)}%`;
    query.where((builder) =>
      builder
        .whereRaw("v.registration_number LIKE ? ESCAPE '\\\\'", [like])
        .orWhereRaw("v.category LIKE ? ESCAPE '\\\\'", [like]),
    );
  }
  return query.orderBy("v.registration_number").orderBy("v.id");
}

/**
 * One vehicle with its driver. `forUpdate` locks the vehicle row only. Lock order everywhere that
 * touches both tables: driver first, vehicle second (see Step 8).
 */
export async function findVehicle(
  id: string,
  executor: DbExecutor = db,
  options: { forUpdate?: boolean } = {},
): Promise<VehicleRow | null> {
  if (options.forUpdate) {
    const locked = await executor.raw("SELECT id FROM vehicles WHERE id = ? FOR UPDATE", [id]);
    if ((locked[0] as unknown[]).length === 0) return null;
  }
  const row = await baseQuery(executor).where("v.id", id).first();
  return row ?? null;
}

/** Case-insensitive through the column collation; the value is already upper-cased. */
export async function findIdByRegistration(
  registrationNumber: string,
  executor: DbExecutor = db,
): Promise<string | null> {
  const row = await executor("vehicles")
    .where({ registration_number: registrationNumber })
    .select("id")
    .first();
  return row ? (row.id as string) : null;
}

export interface NewVehicle {
  id: string;
  registration_number: string;
  category: VehicleCategory;
  fuel_type: string | null;
  operational_status: VehicleOperationalStatus;
  available_for_requisition: number;
  permanent_driver_id: string | null;
}

export async function insertVehicle(executor: DbExecutor, vehicle: NewVehicle): Promise<void> {
  await executor("vehicles").insert(vehicle);
}

export type VehicleColumns = Partial<Omit<NewVehicle, "id">>;

export async function updateVehicleColumns(
  executor: DbExecutor,
  id: string,
  columns: VehicleColumns,
): Promise<void> {
  await executor("vehicles").where({ id }).update(columns);
}

export async function deleteVehicleRow(executor: DbExecutor, id: string): Promise<void> {
  await executor("vehicles").where({ id }).delete();
}

export interface VehicleReferences {
  allocations: number;
  allocationHistory: number;
}

const countWhere = async (executor: DbExecutor, table: string, id: string): Promise<number> => {
  const row = await executor(table).where("vehicle_id", id).count({ total: "*" }).first();
  return Number(row?.total ?? 0);
};

/** `allocation_history.vehicle_id` has no foreign key, so the database alone would not stop a delete. */
export async function countVehicleReferences(
  executor: DbExecutor,
  id: string,
): Promise<VehicleReferences> {
  const [allocations, allocationHistory] = await Promise.all([
    countWhere(executor, "allocations", id),
    countWhere(executor, "allocation_history", id),
  ]);
  return { allocations, allocationHistory };
}
