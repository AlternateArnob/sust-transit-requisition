import useLocalStorageCollection from "./useLocalStorageCollection";
import type { RecurringRoute } from "../types";

const STORAGE_KEY = "sust-transit-routes";

export default function useRoutes() {
  const { items, add, update, remove } =
    useLocalStorageCollection<RecurringRoute>(STORAGE_KEY);

  function toggleRouteActive(routeId: string) {
    const route = items.find((item) => item.id === routeId);

    if (route) {
      update({ ...route, isActive: !route.isActive });
    }
  }

  return {
    routes: items,
    addRoute: add,
    updateRoute: update,
    deleteRoute: remove,
    toggleRouteActive,
  };
}
