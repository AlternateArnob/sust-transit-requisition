import useLocalStorageCollection from "./useLocalStorageCollection";
import type { Allocation } from "../types";

const STORAGE_KEY = "sust-transit-allocations";

export default function useAllocations() {
  const { items, add, update, remove } =
    useLocalStorageCollection<Allocation>(STORAGE_KEY);

  return {
    allocations: items,
    addAllocation: add,
    updateAllocation: update,
    removeAllocation: remove,
  };
}
