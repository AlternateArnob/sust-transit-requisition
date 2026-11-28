import { v4 as uuid } from "uuid";
import { withTransaction } from "../../db/transaction.js";
import { notFound } from "../../errors/AppError.js";
import { audit, type AuditEntry } from "../../services/audit.js";
import type { StudentTransportSchedule } from "../../types/index.js";
import { allocationGuardService } from "../allocationGuards/allocationGuard.service.js";
import { findVehicle } from "../vehicles/vehicle.repository.js";
import {
  sameSchedule,
  toSchedule,
  toTransportScheduleDto,
  type ScheduleSlotRow,
  type TransportScheduleDto,
} from "./transportSchedule.mapper.js";
import {
  deleteEntry,
  findEntryByVehicle,
  insertEntry,
  listAllSlots,
  listEntries,
  listSlots,
  replaceSlots,
  touchEntry,
} from "./transportSchedule.repository.js";
import type { PutTransportScheduleBody } from "./transportSchedule.schemas.js";

// Student-transport schedule (Part 1 §12.12): per vehicle and weekday, the time the vehicle is
// "free after". Every write is one transaction together with its audit row, and starts by locking
// the vehicle row so the allocation guard (Step 18) and the write see the same allocations.

type RequestContext = Pick<AuditEntry, "actor" | "ip" | "requestId"> & {
  actor: NonNullable<AuditEntry["actor"]>;
};

const vehicleNotFound = () => notFound("Vehicle not found.");

const snapshot = (vehicleId: string, schedule: StudentTransportSchedule) => ({
  vehicleId,
  schedule,
});

export async function list(): Promise<{ data: TransportScheduleDto[] }> {
  const [entries, slots] = await Promise.all([listEntries(), listAllSlots()]);
  const slotsByEntry = new Map<string, ScheduleSlotRow[]>();
  for (const slot of slots) {
    slotsByEntry.set(slot.entry_id, [...(slotsByEntry.get(slot.entry_id) ?? []), slot]);
  }
  return {
    data: entries.map((entry) => toTransportScheduleDto(entry, slotsByEntry.get(entry.id) ?? [])),
  };
}

/**
 * Create-or-replace the entry of one vehicle. The weekdays in the body become the whole schedule:
 * a weekday that is no longer sent loses its slot. `created` tells the controller whether to
 * answer 201 or 200. Sending the schedule that is already stored writes nothing.
 */
export async function put(
  ctx: RequestContext,
  vehicleId: string,
  body: PutTransportScheduleBody,
): Promise<{ entry: TransportScheduleDto; created: boolean }> {
  return withTransaction(async (trx) => {
    if (!(await findVehicle(vehicleId, trx, { forUpdate: true }))) throw vehicleNotFound();

    const existing = await findEntryByVehicle(vehicleId, trx, { forUpdate: true });
    const before = existing ? toSchedule(await listSlots(existing.id, trx)) : undefined;

    if (existing && before && sameSchedule(before, body.schedule)) {
      return { entry: { id: existing.id, vehicleId, schedule: before }, created: false };
    }

    await allocationGuardService.assertScheduleAllowed(vehicleId, body.schedule, trx);

    const id = existing?.id ?? uuid();
    if (existing) await touchEntry(trx, id);
    else await insertEntry(trx, { id, vehicle_id: vehicleId });
    await replaceSlots(trx, id, body.schedule);

    await audit.log(trx, {
      ...ctx,
      action: existing ? "transport_schedule.updated" : "transport_schedule.created",
      entityType: "transport_schedule",
      entityId: id,
      ...(before ? { before: snapshot(vehicleId, before) } : {}),
      after: snapshot(vehicleId, body.schedule),
    });
    return {
      entry: { id, vehicleId, schedule: { ...body.schedule } },
      created: !existing,
    };
  });
}

/** Deleting makes the vehicle free all day, so no allocation guard applies. */
export async function remove(ctx: RequestContext, vehicleId: string): Promise<void> {
  await withTransaction(async (trx) => {
    if (!(await findVehicle(vehicleId, trx, { forUpdate: true }))) throw vehicleNotFound();

    const entry = await findEntryByVehicle(vehicleId, trx, { forUpdate: true });
    if (!entry) throw notFound("This vehicle has no student-transport schedule.");

    const before = toSchedule(await listSlots(entry.id, trx));
    await deleteEntry(trx, entry.id);
    await audit.log(trx, {
      ...ctx,
      action: "transport_schedule.deleted",
      entityType: "transport_schedule",
      entityId: entry.id,
      before: snapshot(vehicleId, before),
    });
  });
}
