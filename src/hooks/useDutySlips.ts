import useLocalStorageCollection from "./useLocalStorageCollection";
import type { DutySlip } from "../types";

const STORAGE_KEY = "sust-transit-duty-slips";

export default function useDutySlips() {
  const { items, add } = useLocalStorageCollection<DutySlip>(STORAGE_KEY);

  return {
    dutySlips: items,
    addDutySlip: add,
  };
}
