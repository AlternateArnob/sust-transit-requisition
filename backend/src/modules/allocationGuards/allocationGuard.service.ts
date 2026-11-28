import type { DbExecutor } from "../../db/transaction.js";
import type { OffDayLike, StudentTransportSchedule } from "../../types/index.js";

/** The off-day being created or changed (the vehicle is passed separately). */
export type OffDayInput = Pick<OffDayLike, "type" | "date" | "weekday">;

/**
 * Stops a change to a vehicle, an off-day or the student-transport schedule from stranding trips
 * already allocated to the vehicle (Part 1 §11.9).
 *
 * STUBS until Step 18: every method accepts everything. Callers already run them inside their
 * transaction, after locking the vehicle row, so the real checks will see the rows they lock.
 */
export const allocationGuardService = {
  async assertVehicleCanBecomeUnavailable(
    _vehicleId: string,
    _executor?: DbExecutor,
  ): Promise<void> {
    // Implemented in Step 18 (throws 409 VEHICLE_HAS_UPCOMING_ALLOCATIONS).
  },

  async assertOffDayAllowed(
    _vehicleId: string,
    _offDay: OffDayInput,
    _executor?: DbExecutor,
  ): Promise<void> {
    // Implemented in Step 18 (throws 409 OFFDAY_CLASHES_WITH_ALLOCATIONS).
  },

  async assertScheduleAllowed(
    _vehicleId: string,
    _schedule: StudentTransportSchedule,
    _executor?: DbExecutor,
  ): Promise<void> {
    // Implemented in Step 18 (throws 409 SCHEDULE_CLASHES_WITH_ALLOCATIONS).
  },
};
