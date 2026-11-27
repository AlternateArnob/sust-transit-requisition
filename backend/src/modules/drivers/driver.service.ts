import { v4 as uuid } from "uuid";
import { withTransaction } from "../../db/transaction.js";
import { conflict, notFound } from "../../errors/AppError.js";
import { audit, type AuditEntry } from "../../services/audit.js";
import { toDriverDto, type DriverDto, type DriverRow } from "./driver.mapper.js";
import {
  clearVehicleLink,
  countDriverReferences,
  deleteDriverRow,
  findDriver,
  insertDriver,
  listDrivers,
  updateDriverColumns,
  type DriverColumns,
} from "./driver.repository.js";
import type { CreateDriverBody, ListDriversQuery, UpdateDriverBody } from "./driver.schemas.js";

// Driver management (Part 1 §12.6). Every write runs in one transaction together with its audit
// row, and starts by locking the driver row, so two admins cannot act on stale data.

type RequestContext = Pick<AuditEntry, "actor" | "ip" | "requestId"> & {
  actor: NonNullable<AuditEntry["actor"]>;
};

const driverNotFound = () => notFound("Driver not found.");

/** What an audit row records for a driver. */
const snapshot = (row: DriverRow) => ({
  name: row.name,
  designation: row.designation,
  phone: row.phone,
  status: row.status,
  permanentVehicleId: row.permanent_vehicle_id,
});

export async function list(query: ListDriversQuery): Promise<{ data: DriverDto[] }> {
  const rows = await listDrivers({ status: query.status, q: query.q });
  return { data: rows.map(toDriverDto) };
}

export async function create(ctx: RequestContext, body: CreateDriverBody): Promise<DriverDto> {
  return withTransaction(async (trx) => {
    const id = uuid();
    await insertDriver(trx, {
      id,
      name: body.name,
      designation: body.designation,
      phone: body.phone,
    });

    const created = (await findDriver(id, trx))!;
    await audit.log(trx, {
      ...ctx,
      action: "driver.created",
      entityType: "driver",
      entityId: id,
      after: snapshot(created),
    });
    return toDriverDto(created);
  });
}

/** Name, designation and phone. Status and the vehicle link have their own endpoints. */
export async function update(
  ctx: RequestContext,
  id: string,
  body: UpdateDriverBody,
): Promise<DriverDto> {
  return withTransaction(async (trx) => {
    const before = await findDriver(id, trx, { forUpdate: true });
    if (!before) throw driverNotFound();

    const columns: DriverColumns = {};
    if (body.name !== undefined && body.name !== before.name) columns.name = body.name;
    if (body.designation !== undefined && body.designation !== before.designation) {
      columns.designation = body.designation;
    }
    if (body.phone !== undefined && body.phone !== before.phone) columns.phone = body.phone;

    // A request that changes nothing writes nothing.
    if (Object.keys(columns).length === 0) return toDriverDto(before);

    await updateDriverColumns(trx, id, columns);
    const after = (await findDriver(id, trx))!;
    await audit.log(trx, {
      ...ctx,
      action: "driver.updated",
      entityType: "driver",
      entityId: id,
      before: snapshot(before),
      after: snapshot(after),
    });
    return toDriverDto(after);
  });
}

/**
 * Sets the driver Inactive and frees their vehicle, both in one transaction (Part 1 §12.6).
 * Calling it on an inactive driver changes nothing.
 */
export async function deactivate(ctx: RequestContext, id: string): Promise<DriverDto> {
  return withTransaction(async (trx) => {
    const before = await findDriver(id, trx, { forUpdate: true });
    if (!before) throw driverNotFound();
    if (before.status === "Inactive") return toDriverDto(before);

    await updateDriverColumns(trx, id, { status: "Inactive" });
    await clearVehicleLink(trx, id);

    const after = (await findDriver(id, trx))!;
    await audit.log(trx, {
      ...ctx,
      action: "driver.deactivated",
      entityType: "driver",
      entityId: id,
      before: snapshot(before),
      after: snapshot(after),
    });
    return toDriverDto(after);
  });
}

/** Sets the driver Active again. The vehicle link is not restored; assign it on the vehicle. */
export async function activate(ctx: RequestContext, id: string): Promise<DriverDto> {
  return withTransaction(async (trx) => {
    const before = await findDriver(id, trx, { forUpdate: true });
    if (!before) throw driverNotFound();
    if (before.status === "Active") return toDriverDto(before);

    await updateDriverColumns(trx, id, { status: "Active" });
    const after = (await findDriver(id, trx))!;
    await audit.log(trx, {
      ...ctx,
      action: "driver.activated",
      entityType: "driver",
      entityId: id,
      before: snapshot(before),
      after: snapshot(after),
    });
    return toDriverDto(after);
  });
}

/**
 * Deletes a driver that nothing refers to. A driver named on a vehicle, an allocation, a duty slip
 * or in the allocation history is kept (`409 DRIVER_IN_USE`): deactivate such a driver instead.
 */
export async function remove(ctx: RequestContext, id: string): Promise<void> {
  await withTransaction(async (trx) => {
    const before = await findDriver(id, trx, { forUpdate: true });
    if (!before) throw driverNotFound();

    const references = await countDriverReferences(trx, id);
    if (Object.values(references).some((count) => count > 0)) {
      throw conflict(
        "DRIVER_IN_USE",
        "This driver is assigned to a vehicle or appears in allocations or slips, so it cannot be deleted. Deactivate the driver instead.",
        references,
      );
    }

    await deleteDriverRow(trx, id);
    await audit.log(trx, {
      ...ctx,
      action: "driver.deleted",
      entityType: "driver",
      entityId: id,
      before: snapshot(before),
    });
  });
}
