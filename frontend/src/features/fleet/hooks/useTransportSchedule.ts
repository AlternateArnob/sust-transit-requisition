import useLocalStorageCollection from "@/shared/hooks/useLocalStorageCollection";
import type { StudentTransportVehicle, StudentTransportSchedule } from "@/types";
import { STORAGE_KEYS } from "@/shared/config/storageKeys";

// Storage key intentionally left as the original name — renaming it
// would silently drop any schedule entries already saved in a user's
// browser under the old key. Only the file/export name changed to shed
// the "Routes" nomenclature FR-38 retires.
const STORAGE_KEY = STORAGE_KEYS.routes;

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

export default function useTransportSchedule() {
  const { items, add, update, remove } = useLocalStorageCollection<
    StudentTransportVehicle & {
      freeAfterTime?: string;
      schedule?: StudentTransportSchedule;
    }
  >(STORAGE_KEY);

  const schedules = items.map(migrate);

  function addSchedule(entry: StudentTransportVehicle) {
    add(migrate(entry));
  }

  function updateSchedule(entry: StudentTransportVehicle) {
    update(migrate(entry));
  }

  return {
    schedules,
    addSchedule,
    updateSchedule,
    deleteSchedule: remove,
  };
}
