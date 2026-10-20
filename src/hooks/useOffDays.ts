import useLocalStorageCollection from "./useLocalStorageCollection";
import type { VehicleOffDay } from "../types";

const STORAGE_KEY = "sust-transit-offdays";

export default function useOffDays() {
  const { items, add, remove } =
    useLocalStorageCollection<VehicleOffDay>(STORAGE_KEY);

  return {
    offDays: items,
    addOffDay: add,
    deleteOffDay: remove,
  };
}
