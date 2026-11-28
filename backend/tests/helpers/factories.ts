import { randomUUID } from "node:crypto";
import { db } from "./db.js";

type Row = Record<string, unknown>;

let sequence = 0;
const next = () => ++sequence;

export async function createUser(overrides: Row = {}): Promise<Row> {
  const id = randomUUID();
  const row = { id, email: `user-${id}@sust.edu`, role: "Applicant", ...overrides };
  await db("users").insert(row);
  return row;
}

export async function createDriver(overrides: Row = {}): Promise<Row> {
  const row = { id: randomUUID(), name: `Driver ${next()}`, designation: "Driver", ...overrides };
  await db("drivers").insert(row);
  return row;
}

export async function createVehicle(overrides: Row = {}): Promise<Row> {
  const row = {
    id: randomUUID(),
    registration_number: `DHAKA-METRO-${next()}`,
    category: "Microbus",
    ...overrides,
  };
  await db("vehicles").insert(row);
  return row;
}

export async function createOffDay(vehicleId: string, overrides: Row = {}): Promise<Row> {
  const row = {
    id: randomUUID(),
    vehicle_id: vehicleId,
    type: "One-time",
    off_date: "2026-10-22",
    ...overrides,
  };
  await db("vehicle_off_days").insert(row);
  return row;
}

/** A student-transport entry for a vehicle, e.g. `{ Mon: "18:50", Thu: "17:00" }`. */
export async function createScheduleEntry(
  vehicleId: string,
  schedule: Record<string, string>,
): Promise<Row> {
  const row = { id: randomUUID(), vehicle_id: vehicleId };
  await db("student_transport_vehicles").insert(row);
  const slots = Object.entries(schedule).map(([weekday, free_after]) => ({
    entry_id: row.id,
    weekday,
    free_after,
  }));
  if (slots.length > 0) await db("student_transport_slots").insert(slots);
  return row;
}

export async function createRequisition(requesterId: string, overrides: Row = {}): Promise<Row> {
  const row = {
    id: `TRS-2026-${String(next()).padStart(3, "0")}`,
    requester_id: requesterId,
    requester_name: "Test Requester",
    requisition_type: "Personal",
    purpose: "Test purpose",
    status: "Pending on Transport Office",
    ...overrides,
  };
  await db("requisitions").insert(row);
  return row;
}

export async function createTrip(requisitionId: string, overrides: Row = {}): Promise<Row> {
  const row = {
    id: randomUUID(),
    requisition_id: requisitionId,
    position: 0,
    trip_date: "2026-10-22",
    start_time: "09:00",
    end_time: "11:00",
    route: "Campus to Zindabazar and Return to Campus",
    stoppage_sequence: JSON.stringify(["Campus", "Zindabazar", "Campus"]),
    passenger_groups: "[]",
    ...overrides,
  };
  await db("trips").insert(row);
  return row;
}

export async function createAllocation(
  args: { requisitionId: string; tripId: string; vehicleId: string; allocatedBy: string },
  overrides: Row = {},
): Promise<Row> {
  const row = {
    id: randomUUID(),
    requisition_id: args.requisitionId,
    trip_id: args.tripId,
    vehicle_id: args.vehicleId,
    alloc_date: "2026-10-22",
    start_time: "09:00",
    end_time: "11:00",
    allocated_by: args.allocatedBy,
    allocated_at: new Date(),
    ...overrides,
  };
  await db("allocations").insert(row);
  return row;
}

/** A user + requisition + trip + vehicle, the usual starting point for allocation-style tests. */
export async function createScenario() {
  const requester = await createUser();
  const admin = await createUser({ role: "TransportInCharge" });
  const requisition = await createRequisition(requester.id as string);
  const trip = await createTrip(requisition.id as string);
  const vehicle = await createVehicle();
  return { requester, admin, requisition, trip, vehicle };
}
