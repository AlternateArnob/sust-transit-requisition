import useLocalStorageCollection from "./useLocalStorageCollection";
import type { DutySlip } from "../types";
import { STORAGE_KEYS } from "../data/storageKeys";

const STORAGE_KEY = STORAGE_KEYS.dutySlips;

export default function useDutySlips() {
  const { items, add } = useLocalStorageCollection<DutySlip>(STORAGE_KEY);

  return {
    dutySlips: items,
    addDutySlip: add,
  };
}
