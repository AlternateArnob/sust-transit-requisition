import useLocalStorageCollection from "./useLocalStorageCollection";
import type { MileageEntry } from "../types";

const STORAGE_KEY = "sust-transit-mileage";

export default function useMileageEntries() {
  const { items, add } = useLocalStorageCollection<MileageEntry>(STORAGE_KEY);

  return {
    mileageEntries: items,
    addMileageEntry: add,
  };
}
