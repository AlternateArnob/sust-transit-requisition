import useLocalStorageCollection from "./useLocalStorageCollection";
import type { Vehicle } from "../types";
import { STORAGE_KEYS } from "../data/storageKeys";

const STORAGE_KEY = STORAGE_KEYS.vehicles;

export default function useVehicles() {
  const { items, add, update, remove } = useLocalStorageCollection<Vehicle>(STORAGE_KEY);

  return {
    vehicles: items,
    addVehicle: add,
    updateVehicle: update,
    deleteVehicle: remove,
  };
}
