import useLocalStorageCollection from "./useLocalStorageCollection";
import type { MileageEntry } from "../types";
import { STORAGE_KEYS } from "../data/storageKeys";

const STORAGE_KEY = STORAGE_KEYS.mileage;

export default function useMileageEntries() {
  const { items, add } = useLocalStorageCollection<MileageEntry>(STORAGE_KEY);

  return {
    mileageEntries: items,
    addMileageEntry: add,
  };
}
