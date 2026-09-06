import useLocalStorageCollection from "./useLocalStorageCollection";
import type { Allocation } from "../types";

const STORAGE_KEY = "sust-transit-allocations";

export default function useAllocations() {
  // Phase 8, §3 — deliberately does not expose `update`. Reassignment
  // should always be remove-then-add (see reassignAllocation() in
  // allocationUtils.ts) so history isn't lost by mutating an existing
  // Allocation in place; not exposing `update` here means a future call
  // site can't accidentally reintroduce that pattern.
  const { items, add, remove } = useLocalStorageCollection<Allocation>(
    STORAGE_KEY,
  );

  return {
    allocations: items,
    addAllocation: add,
    removeAllocation: remove,
  };
}
