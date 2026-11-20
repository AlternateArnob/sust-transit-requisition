import useLocalStorageCollection from "@/shared/hooks/useLocalStorageCollection";
import type { Driver } from "@/types";
import { STORAGE_KEYS } from "@/shared/config/storageKeys";

const STORAGE_KEY = STORAGE_KEYS.driver;

export default function useDrivers() {
  const { items, add, update, remove } = useLocalStorageCollection<Driver>(STORAGE_KEY);

  function deactivateDriver(id: string) {
    const member = items.find((item) => item.id === id);

    if (member) {
      update({ ...member, status: "Inactive", permanentVehicleId: undefined });
    }
  }

  function activateDriver(id: string) {
    const member = items.find((item) => item.id === id);

    if (member) {
      update({ ...member, status: "Active" });
    }
  }

  return {
    drivers: items,
    addDriver: add,
    updateDriver: update,
    deactivateDriver,
    activateDriver,
    deleteDriver: remove,
  };
}
