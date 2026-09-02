import useLocalStorageCollection from "./useLocalStorageCollection";
import type { Staff } from "../types";

const STORAGE_KEY = "sust-transit-staff";

export default function useStaff() {
  const { items, add, update, remove } =
    useLocalStorageCollection<Staff>(STORAGE_KEY);

  function deactivateStaff(id: string) {
    const member = items.find((item) => item.id === id);

    if (member) {
      update({ ...member, status: "Inactive", permanentVehicleId: undefined });
    }
  }

  return {
    staff: items,
    addStaff: add,
    updateStaff: update,
    deactivateStaff,
    deleteStaff: remove,
  };
}
