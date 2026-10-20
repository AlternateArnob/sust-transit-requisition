import type { AssignmentResult } from "../types";
import useDriver from "./useDriver";

/**
 * Phase 2 (admin module) — the single place that enforces FRD §13's
 * vehicle<->driver assignment rules:
 *  - each vehicle has zero or one driver, each driver at most one vehicle
 *  - an inactive driver can never be assigned
 *  - a driver already assigned elsewhere can't be double-booked
 *  - replacing a driver cleanly unassigns the previous one
 *
 * Previously this logic was duplicated inline in `VehiclePage` (and a
 * second, broken copy sat here unused — it read `driver.permanentVehicleId`
 * off the whole `Driver[]` array instead of the matched driver, so the
 * "already assigned elsewhere" check silently never fired). This hook
 * replaces both.
 *
 * It intentionally only touches the *driver* side of the relationship
 * (`Driver.permanentVehicleId`). Callers own writing `Vehicle.permanentDriverId`
 * themselves via `useVehicles`, because a vehicle being created for the
 * first time doesn't exist in the `useVehicles` collection yet at the
 * moment this runs — looking it up here (as the old code did) would
 * silently no-op on add.
 */
export default function useVehicleDriverAssignment() {
  const { driver: drivers, updateDriver } = useDriver();

  function findDriver(driverId: string) {
    return drivers.find((item) => item.id === driverId);
  }

  /**
   * Validates and applies the driver-side half of an assignment change
   * for `vehicleId`, moving it from `currentDriverId` to `nextDriverId`
   * (either may be undefined). Returns success:false with a message
   * instead of throwing, so callers can surface it as a form error.
   */
  function applyDriverAssignment(
    currentDriverId: string | undefined,
    nextDriverId: string | undefined,
    vehicleId: string,
  ): AssignmentResult {
    if (currentDriverId === nextDriverId) {
      return { success: true, message: "No change." };
    }

    if (nextDriverId) {
      const targetDriver = findDriver(nextDriverId);

      if (!targetDriver) {
        return { success: false, message: "Selected driver was not found." };
      }

      if (targetDriver.status !== "Active") {
        return {
          success: false,
          message: "Inactive drivers cannot be assigned.",
        };
      }

      if (
        targetDriver.permanentVehicleId &&
        targetDriver.permanentVehicleId !== vehicleId
      ) {
        return {
          success: false,
          message: "This driver is already assigned to another vehicle.",
        };
      }
    }

    if (currentDriverId) {
      const previousDriver = findDriver(currentDriverId);

      if (previousDriver) {
        updateDriver({ ...previousDriver, permanentVehicleId: undefined });
      }
    }

    if (nextDriverId) {
      // Re-read rather than reuse the earlier lookup — updateDriver above
      // may have targeted a different record, this one is unaffected.
      const targetDriver = findDriver(nextDriverId);

      if (targetDriver) {
        updateDriver({ ...targetDriver, permanentVehicleId: vehicleId });
      }
    }

    return { success: true, message: "Driver assignment updated." };
  }

  return { applyDriverAssignment };
}
