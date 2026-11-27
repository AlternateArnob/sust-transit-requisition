import type { DbExecutor } from "../../db/transaction.js";

/**
 * Stops a change to a vehicle from stranding trips already allocated to it (Part 1 §11.9).
 * STUB until Step 18: it accepts everything. Callers already run it inside their transaction, so
 * the real check will see the same rows they lock.
 */
export const allocationGuardService = {
  async assertVehicleCanBecomeUnavailable(
    _vehicleId: string,
    _executor?: DbExecutor,
  ): Promise<void> {
    // Implemented in Step 18 (throws 409 VEHICLE_HAS_UPCOMING_ALLOCATIONS).
  },
};
