import useLocalStorageCollection from "@/shared/hooks/useLocalStorageCollection";
import type { DutySlip } from "@/types";
import { STORAGE_KEYS } from "@/shared/config/storageKeys";

const STORAGE_KEY = STORAGE_KEYS.dutySlips;

export default function useDutySlips() {
  const { items, add } = useLocalStorageCollection<DutySlip>(STORAGE_KEY);

  return {
    dutySlips: items,
    addDutySlip: add,
  };
}
