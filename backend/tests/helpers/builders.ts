import type {
  AllocationLike,
  OffDayLike,
  RequisitionLike,
  TripLike,
  VehicleLike,
} from "../../src/types/index.js";

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

export const trip = (overrides: Partial<TripLike> = {}): TripLike => ({
  id: nextId("trip"),
  date: "2026-10-22",
  startTime: "09:00",
  endTime: "11:00",
  status: "Pending",
  vehicleCategory: "Any",
  ...overrides,
});

export const requisition = (overrides: Partial<RequisitionLike> = {}): RequisitionLike => ({
  id: "TRS-2026-001",
  status: "Pending on Transport Office",
  requisitionType: "Personal",
  applicantProfile: "Teacher",
  trips: [],
  ...overrides,
});

export const vehicle = (overrides: Partial<VehicleLike> = {}): VehicleLike => ({
  id: "veh-1",
  category: "Microbus",
  operationalStatus: "Active",
  availableForRequisition: true,
  permanentDriverId: "drv-1",
  ...overrides,
});

export const allocation = (overrides: Partial<AllocationLike> = {}): AllocationLike => ({
  id: nextId("alloc"),
  requisitionId: "TRS-2026-001",
  tripId: nextId("trip"),
  vehicleId: "veh-1",
  driverId: "drv-1",
  date: "2026-10-22",
  startTime: "09:00",
  endTime: "11:00",
  ...overrides,
});

export const offDay = (overrides: Partial<OffDayLike> = {}): OffDayLike => ({
  vehicleId: "veh-1",
  type: "One-time",
  date: "2026-10-22",
  ...overrides,
});
