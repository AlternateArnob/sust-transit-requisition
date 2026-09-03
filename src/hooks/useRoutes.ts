import useLocalStorageCollection from "./useLocalStorageCollection";
import type {
  StudentTransportVehicle,
  StudentTransportSchedule,
} from "../types";

const STORAGE_KEY = "sust-transit-routes";

/*
 * Reshape any legacy entry that still carries a top-level freeAfterTime
 * into the new per-weekday schedule shape.
 *
 * Old shape:  { id, vehicleId, freeAfterTime: "18:50" }
 * New shape:  { id, vehicleId, schedule: { Sun: "18:50", ... } }
 */
function migrate(
  entry: StudentTransportVehicle & {
    freeAfterTime?: string;
    schedule?: StudentTransportSchedule;
  },
): StudentTransportVehicle {
  if (entry.schedule && typeof entry.schedule === "object") {
    return {
      id: entry.id,
      vehicleId: entry.vehicleId,
      schedule: entry.schedule,
    };
  }

  const legacy = entry.freeAfterTime;

  if (!legacy) {
    return { id: entry.id, vehicleId: entry.vehicleId, schedule: {} };
  }

  /*
   * Apply the legacy time to all seven weekdays so existing data
   * keeps its meaning after the migration.
   */
  const schedule: StudentTransportSchedule = {
    Sun: legacy,
    Mon: legacy,
    Tue: legacy,
    Wed: legacy,
    Thu: legacy,
    Fri: legacy,
    Sat: legacy,
  };

  return {
    id: entry.id,
    vehicleId: entry.vehicleId,
    schedule,
  };
}

export default function useRoutes() {
  const { items, add, update, remove } =
    useLocalStorageCollection<
      StudentTransportVehicle & {
        freeAfterTime?: string;
        schedule?: StudentTransportSchedule;
      }
    >(STORAGE_KEY);

  const routes = items.map(migrate);

  function addRoute(entry: StudentTransportVehicle) {
    add(migrate(entry));
  }

  function updateRoute(entry: StudentTransportVehicle) {
    update(migrate(entry));
  }

  return {
    routes,
    addRoute,
    updateRoute,
    deleteRoute: remove,
  };
}
