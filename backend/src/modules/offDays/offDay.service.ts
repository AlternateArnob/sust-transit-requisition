import { v4 as uuid } from "uuid";
import type { OffDayType, Weekday } from "../../config/constants.js";
import { withTransaction, type Trx } from "../../db/transaction.js";
import { offDayFallsInRange } from "../../domain/schedule.js";
import { notFound, validation, type ErrorDetail } from "../../errors/AppError.js";
import { audit, type AuditEntry } from "../../services/audit.js";
import { allocationGuardService } from "../allocationGuards/allocationGuard.service.js";
import { findVehicle } from "../vehicles/vehicle.repository.js";
import { toOffDayDto, type OffDayDto, type OffDayRow } from "./offDay.mapper.js";
import {
  deleteOffDayRow,
  findOffDayRow,
  insertOffDayRow,
  listOffDayRows,
  updateOffDayRow,
} from "./offDay.repository.js";
import type { CreateOffDayBody, ListOffDaysQuery, UpdateOffDayBody } from "./offDay.schemas.js";

// Vehicle off-days (Part 1 §12.11). Every write is one transaction together with its audit row.
// The vehicle row is locked first so that the allocation guard (Step 18) and the write see the
// same allocations; two requests for the same vehicle therefore run one after the other.

type RequestContext = Pick<AuditEntry, "actor" | "ip" | "requestId"> & {
  actor: NonNullable<AuditEntry["actor"]>;
};

const offDayNotFound = () => notFound("Off-day not found.");

const snapshot = (row: OffDayRow) => ({
  vehicleId: row.vehicle_id,
  type: row.type,
  date: row.off_date,
  weekday: row.weekday,
  reason: row.reason,
});

interface Shape {
  type: OffDayType;
  date: string | null;
  weekday: Weekday | null;
}

/**
 * The off-day a PATCH would leave behind. Switching the type needs the new type's field in the
 * same request, and the old type's field is dropped. A field that does not belong to the final
 * type is refused, so a typo never half-applies.
 */
function resolveShape(current: OffDayRow, body: UpdateOffDayBody): Shape {
  const type = body.type ?? current.type;
  const issues: ErrorDetail[] = [];

  if (type === "One-time") {
    if (body.weekday !== undefined) {
      issues.push({ path: "weekday", message: "A one-time off-day cannot have a weekday." });
    }
    const date = body.date ?? (current.type === "One-time" ? current.off_date : null);
    if (!date) issues.push({ path: "date", message: "A one-time off-day needs a date." });
    if (issues.length > 0) throw validation(issues);
    return { type, date, weekday: null };
  }

  if (body.date !== undefined) {
    issues.push({ path: "date", message: "A recurring off-day cannot have a date." });
  }
  const weekday = body.weekday ?? (current.type === "Recurring" ? current.weekday : null);
  if (!weekday) issues.push({ path: "weekday", message: "A recurring off-day needs a weekday." });
  if (issues.length > 0) throw validation(issues);
  return { type, date: null, weekday };
}

export async function list(query: ListOffDaysQuery): Promise<{ data: OffDayDto[] }> {
  const rows = await listOffDayRows({ vehicleId: query.vehicleId });
  const range = { from: query.from, to: query.to };
  return {
    data: rows
      .filter((row) =>
        offDayFallsInRange({ type: row.type, date: row.off_date, weekday: row.weekday }, range),
      )
      .map(toOffDayDto),
  };
}

export async function create(ctx: RequestContext, body: CreateOffDayBody): Promise<OffDayDto> {
  return withTransaction(async (trx) => {
    const vehicle = await findVehicle(body.vehicleId, trx, { forUpdate: true });
    if (!vehicle) {
      throw validation([{ path: "vehicleId", message: "Vehicle not found." }]);
    }

    const shape: Shape = {
      type: body.type,
      date: body.date ?? null,
      weekday: body.weekday ?? null,
    };
    await allocationGuardService.assertOffDayAllowed(body.vehicleId, shape, trx);

    const id = uuid();
    await insertOffDayRow(trx, {
      id,
      vehicle_id: body.vehicleId,
      type: shape.type,
      off_date: shape.date,
      weekday: shape.weekday,
      reason: body.reason,
    });

    const created = (await findOffDayRow(id, trx))!;
    await audit.log(trx, {
      ...ctx,
      action: "off_day.created",
      entityType: "off_day",
      entityId: id,
      after: snapshot(created),
    });
    return toOffDayDto(created);
  });
}

/**
 * Finds an off-day and locks, in this order, its vehicle and then the off-day itself. Returns null
 * when it does not exist (or was deleted while this request waited for the vehicle lock).
 */
async function lockOffDay(trx: Trx, id: string): Promise<OffDayRow | null> {
  const peek = await findOffDayRow(id, trx);
  if (!peek) return null;
  await findVehicle(peek.vehicle_id, trx, { forUpdate: true });
  return findOffDayRow(id, trx, { forUpdate: true });
}

export async function update(
  ctx: RequestContext,
  id: string,
  body: UpdateOffDayBody,
): Promise<OffDayDto> {
  return withTransaction(async (trx) => {
    const before = await lockOffDay(trx, id);
    if (!before) throw offDayNotFound();

    const shape = resolveShape(before, body);
    const reason = body.reason === undefined ? before.reason : body.reason;

    // A request that changes nothing writes nothing.
    const unchanged =
      shape.type === before.type &&
      shape.date === before.off_date &&
      shape.weekday === before.weekday &&
      reason === before.reason;
    if (unchanged) return toOffDayDto(before);

    await allocationGuardService.assertOffDayAllowed(before.vehicle_id, shape, trx);
    await updateOffDayRow(trx, id, {
      type: shape.type,
      off_date: shape.date,
      weekday: shape.weekday,
      reason,
    });

    const after = (await findOffDayRow(id, trx))!;
    await audit.log(trx, {
      ...ctx,
      action: "off_day.updated",
      entityType: "off_day",
      entityId: id,
      before: snapshot(before),
      after: snapshot(after),
    });
    return toOffDayDto(after);
  });
}

/** Deleting an off-day only frees the vehicle, so no allocation guard applies. */
export async function remove(ctx: RequestContext, id: string): Promise<void> {
  await withTransaction(async (trx) => {
    const before = await lockOffDay(trx, id);
    if (!before) throw offDayNotFound();

    await deleteOffDayRow(trx, id);
    await audit.log(trx, {
      ...ctx,
      action: "off_day.deleted",
      entityType: "off_day",
      entityId: id,
      before: snapshot(before),
    });
  });
}
