import useLocalStorageCollection from "./useLocalStorageCollection";
import type { Vehicle } from "../types";

const STORAGE_KEY = "sust-transit-vehicles";

export default function useVehicles() {
  const { items, add, update, remove } =
    useLocalStorageCollection<Vehicle>(STORAGE_KEY);

  return {
    vehicles: items,
    addVehicle: add,
    updateVehicle: update,
    deleteVehicle: remove,
  };
}
