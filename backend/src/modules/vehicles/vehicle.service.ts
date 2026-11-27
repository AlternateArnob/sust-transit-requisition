import { v4 as uuid } from "uuid";
import { withTransaction, type DbExecutor } from "../../db/transaction.js";
import { becomesUnavailable } from "../../domain/vehicleEligibility.js";
import { conflict, notFound, validation } from "../../errors/AppError.js";
import { audit, type AuditEntry } from "../../services/audit.js";
import { findDriver } from "../drivers/driver.repository.js";
import { allocationGuardService } from "../allocationGuards/allocationGuard.service.js";
import {
  toVehicleDetailDto,
  toVehicleDto,
  type VehicleDetailDto,
  type VehicleDto,
  type VehicleRow,
} from "./vehicle.mapper.js";
import {
  countVehicleReferences,
  deleteVehicleRow,
  findIdByRegistration,
  findVehicle,
  insertVehicle,
  listVehicles,
  updateVehicleColumns,
  type VehicleColumns,
} from "./vehicle.repository.js";
import type { CreateVehicleBody, ListVehiclesQuery, UpdateVehicleBody } from "./vehicle.schemas.js";

// Vehicle management (Part 1 §12.5). Every write is one transaction together with its audit row.
// Lock order when a driver is involved: driver row first, vehicle row second (same as Step 8).

type RequestContext = Pick<AuditEntry, "actor" | "ip" | "requestId"> & {
  actor: NonNullable<AuditEntry["actor"]>;
};

const vehicleNotFound = () => notFound("Vehicle not found.");

const duplicateRegistration = () =>
  conflict("DUPLICATE_REGISTRATION", "A vehicle with this registration number already exists.");

const snapshot = (row: VehicleRow) => ({
  registrationNumber: row.registration_number,
  category: row.category,
  fuelType: row.fuel_type,
  operationalStatus: row.operational_status,
  availableForRequisition: Boolean(row.available_for_requisition),
  permanentDriverId: row.permanent_driver_id,
});

const isDuplicateKey = (error: unknown): error is { sqlMessage?: string } =>
  (error as { code?: string } | null)?.code === "ER_DUP_ENTRY";

/** Maps a unique-key race to the right 409; anything else is rethrown. */
function mapDuplicate(error: unknown): never {
  if (isDuplicateKey(error)) {
    const message = String(error.sqlMessage ?? "");
    if (message.includes("uq_vehicle_driver")) {
      throw conflict(
        "DRIVER_ALREADY_ASSIGNED",
        "This driver is already the permanent driver of another vehicle.",
      );
    }
    throw duplicateRegistration();
  }
  throw error;
}

/**
 * Port of `useVehicleDriverAssignment` (Part 1 §12.5): the driver must exist, be Active and not be
 * the permanent driver of another vehicle. Locks the driver row, so two requests cannot both win.
 */
async function assertDriverAssignable(
  trx: DbExecutor,
  driverId: string,
  vehicleId: string | null,
): Promise<void> {
  const driver = await findDriver(driverId, trx, { forUpdate: true });
  if (!driver) {
    throw validation([{ path: "permanentDriverId", message: "Driver not found." }]);
  }
  if (driver.status !== "Active") {
    throw validation([
      { path: "permanentDriverId", message: "Only an Active driver can be assigned." },
    ]);
  }
  if (driver.permanent_vehicle_id && driver.permanent_vehicle_id !== vehicleId) {
    throw conflict(
      "DRIVER_ALREADY_ASSIGNED",
      "This driver is already the permanent driver of another vehicle.",
      { vehicleId: driver.permanent_vehicle_id },
    );
  }
}

export async function list(query: ListVehiclesQuery): Promise<{ data: VehicleDto[] }> {
  const rows = await listVehicles({
    q: query.q,
    category: query.category,
    status: query.status,
  });
  return { data: rows.map(toVehicleDto) };
}

export async function get(id: string): Promise<VehicleDetailDto> {
  const row = await findVehicle(id);
  if (!row) throw vehicleNotFound();
  return toVehicleDetailDto(row);
}

export async function create(ctx: RequestContext, body: CreateVehicleBody): Promise<VehicleDto> {
  return withTransaction(async (trx) => {
    if (body.permanentDriverId) await assertDriverAssignable(trx, body.permanentDriverId, null);
    if (await findIdByRegistration(body.registrationNumber, trx)) throw duplicateRegistration();

    const id = uuid();
    try {
      await insertVehicle(trx, {
        id,
        registration_number: body.registrationNumber,
        category: body.category,
        fuel_type: body.fuelType,
        operational_status: body.operationalStatus,
        available_for_requisition: body.availableForRequisition ? 1 : 0,
        permanent_driver_id: body.permanentDriverId,
      });
    } catch (error) {
      mapDuplicate(error);
    }

    const created = (await findVehicle(id, trx))!;
    await audit.log(trx, {
      ...ctx,
      action: "vehicle.created",
      entityType: "vehicle",
      entityId: id,
      after: snapshot(created),
    });
    return toVehicleDto(created);
  });
}

export async function update(
  ctx: RequestContext,
  id: string,
  body: UpdateVehicleBody,
): Promise<VehicleDto> {
  return withTransaction(async (trx) => {
    // Driver first (when one is named), vehicle second.
    if (body.permanentDriverId) {
      const current = await findVehicle(id, trx);
      if (!current) throw vehicleNotFound();
      if (body.permanentDriverId !== current.permanent_driver_id) {
        await assertDriverAssignable(trx, body.permanentDriverId, id);
      }
    }

    const before = await findVehicle(id, trx, { forUpdate: true });
    if (!before) throw vehicleNotFound();

    const columns: VehicleColumns = {};
    if (body.registrationNumber !== undefined) {
      if (body.registrationNumber !== before.registration_number) {
        const owner = await findIdByRegistration(body.registrationNumber, trx);
        if (owner && owner !== id) throw duplicateRegistration();
        columns.registration_number = body.registrationNumber;
      }
    }
    if (body.category !== undefined && body.category !== before.category) {
      columns.category = body.category;
    }
    if (body.fuelType !== undefined && body.fuelType !== before.fuel_type) {
      columns.fuel_type = body.fuelType;
    }
    if (
      body.operationalStatus !== undefined &&
      body.operationalStatus !== before.operational_status
    ) {
      columns.operational_status = body.operationalStatus;
    }
    if (
      body.availableForRequisition !== undefined &&
      body.availableForRequisition !== Boolean(before.available_for_requisition)
    ) {
      columns.available_for_requisition = body.availableForRequisition ? 1 : 0;
    }
    if (
      body.permanentDriverId !== undefined &&
      body.permanentDriverId !== before.permanent_driver_id
    ) {
      columns.permanent_driver_id = body.permanentDriverId;
    }

    // A request that changes nothing writes nothing.
    if (Object.keys(columns).length === 0) return toVehicleDto(before);

    const nextState = {
      operationalStatus: columns.operational_status ?? before.operational_status,
      availableForRequisition:
        columns.available_for_requisition !== undefined
          ? Boolean(columns.available_for_requisition)
          : Boolean(before.available_for_requisition),
    };
    if (
      becomesUnavailable(
        {
          operationalStatus: before.operational_status,
          availableForRequisition: Boolean(before.available_for_requisition),
        },
        nextState,
      )
    ) {
      await allocationGuardService.assertVehicleCanBecomeUnavailable(id, trx);
    }

    try {
      await updateVehicleColumns(trx, id, columns);
    } catch (error) {
      mapDuplicate(error);
    }

    const after = (await findVehicle(id, trx))!;
    await audit.log(trx, {
      ...ctx,
      action: "vehicle.updated",
      entityType: "vehicle",
      entityId: id,
      before: snapshot(before),
      after: snapshot(after),
    });
    return toVehicleDto(after);
  });
}

/** Deletes a vehicle nothing refers to; otherwise `409 VEHICLE_HAS_HISTORY` (§10.3, §12.5). */
export async function remove(ctx: RequestContext, id: string): Promise<void> {
  await withTransaction(async (trx) => {
    const before = await findVehicle(id, trx, { forUpdate: true });
    if (!before) throw vehicleNotFound();

    const references = await countVehicleReferences(trx, id);
    if (references.allocations > 0 || references.allocationHistory > 0) {
      throw conflict(
        "VEHICLE_HAS_HISTORY",
        "This vehicle appears in allocations or allocation history, so it cannot be deleted. Mark it Out-of-Service instead.",
        references,
      );
    }

    await deleteVehicleRow(trx, id);
    await audit.log(trx, {
      ...ctx,
      action: "vehicle.deleted",
      entityType: "vehicle",
      entityId: id,
      before: snapshot(before),
    });
  });
}
