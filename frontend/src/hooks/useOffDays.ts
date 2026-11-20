import useLocalStorageCollection from "./useLocalStorageCollection";
import type { VehicleOffDay } from "../types";
import { STORAGE_KEYS } from "../data/storageKeys";

const STORAGE_KEY = STORAGE_KEYS.offDays;

export default function useOffDays() {
  const { items, add, remove } = useLocalStorageCollection<VehicleOffDay>(STORAGE_KEY);

  return {
    offDays: items,
    addOffDay: add,
    deleteOffDay: remove,
  };
}
