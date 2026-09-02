import { useState } from "react";

import useVehicles from "../hooks/useVehicles";
import useRoutes from "../hooks/useRoutes";
import useOffDays from "../hooks/useOffDays";

import Modal from "../components/Modal";
import RouteForm from "../components/RouteFrom";
import OffDayForm from "../components/OffDayForm";

import type { RecurringRoute } from "../types";

type Tab = "routes" | "offdays";

export default function RoutesPage() {
  const { vehicles } = useVehicles();
  const { routes, addRoute, updateRoute, deleteRoute, toggleRouteActive } =
    useRoutes();
  const { offDays, addOffDay, deleteOffDay } = useOffDays();

  const [tab, setTab] = useState<Tab>("routes");

  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RecurringRoute | null>(null);
  const [isAddOffDayOpen, setIsAddOffDayOpen] = useState(false);

  function getVehicleLabel(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);

    return vehicle
      ? `${vehicle.registrationNumber} (${vehicle.category})`
      : "Unknown Vehicle";
  }

  function handleRouteSubmit(route: RecurringRoute) {
    if (editingRoute) {
      updateRoute(route);
      setEditingRoute(null);
    } else {
      addRoute(route);
      setIsAddRouteOpen(false);
    }
  }

  function handleDeleteRoute(route: RecurringRoute) {
    const confirmed = window.confirm(
      `Delete this route for ${getVehicleLabel(route.vehicleId)}?`,
    );

    if (confirmed) {
      deleteRoute(route.id);
    }
  }

  function handleDeleteOffDay(offDayId: string) {
    const confirmed = window.confirm("Remove this off-day entry?");

    if (confirmed) {
      deleteOffDay(offDayId);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E293B]">
            Routes & Off-Days
          </h1>

          <p className="mt-1 text-sm text-[#64748B]">
            Manage recurring vehicle routes and off-day exclusions
          </p>
        </div>

        {/* Dynamic Add Button based on active tab */}
        {tab === "routes" ? (
          <button
            type="button"
            onClick={() => setIsAddRouteOpen(true)}
            className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
          >
            + Add Route
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddOffDayOpen(true)}
            className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
          >
            + Mark Off-Day
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => setTab("routes")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "routes"
              ? "border-b-2 border-[#0F2747] text-[#0F2747]"
              : "text-[#64748B] hover:text-[#1E293B]"
          }`}
        >
          Recurring Routes ({routes.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("offdays")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "offdays"
              ? "border-b-2 border-[#0F2747] text-[#0F2747]"
              : "text-[#64748B] hover:text-[#1E293B]"
          }`}
        >
          Vehicle Off-Days ({offDays.length})
        </button>
      </div>

      {/* Routes Tab */}
      {tab === "routes" && (
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0F2747] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Slot</th>
                  <th className="px-4 py-3 font-medium">Weekdays</th>
                  <th className="px-4 py-3 font-medium">Campus Dep.</th>
                  <th className="px-4 py-3 font-medium">Point Dep.</th>
                  <th className="px-4 py-3 font-medium">Route Sequence</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {routes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <p className="font-medium text-[#1E293B]">
                        No routes found
                      </p>

                      <p className="mt-1 text-sm text-[#64748B]">
                        Add a recurring route to get started.
                      </p>
                    </td>
                  </tr>
                ) : (
                  routes.map((route, index) => (
                    <tr
                      key={route.id}
                      className={`border-t border-[#E2E8F0] ${
                        index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-[#1E293B]">
                        {getVehicleLabel(route.vehicleId)}
                      </td>

                      <td className="px-4 py-3 text-[#64748B]">{route.slot}</td>

                      <td className="px-4 py-3 text-[#64748B]">
                        {route.weekdays.join(", ")}
                      </td>

                      <td className="px-4 py-3 text-[#64748B]">
                        {route.campusDeparture ?? "—"}
                      </td>

                      <td className="px-4 py-3 text-[#64748B]">
                        {route.pointDeparture ?? "—"}
                      </td>

                      <td
                        className="max-w-xs truncate px-4 py-3 text-[#64748B]"
                        title={route.stops.join(" → ")}
                      >
                        {route.stops.join(" → ")}
                      </td>

                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleRouteActive(route.id)}
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            route.isActive
                              ? "bg-[#DCFCE7] text-[#15803D]"
                              : "bg-[#FEE2E2] text-[#B91C1C]"
                          }`}
                        >
                          {route.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setEditingRoute(route)}
                            className="text-sm font-medium text-[#334E68] hover:underline"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRoute(route)}
                            className="text-sm font-medium text-[#B91C1C] hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Off-Days Tab */}
      {tab === "offdays" && (
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0F2747] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Date / Weekday</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {offDays.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <p className="font-medium text-[#1E293B]">
                        No off-days found
                      </p>

                      <p className="mt-1 text-sm text-[#64748B]">
                        Mark a vehicle unavailable for a date or weekday.
                      </p>
                    </td>
                  </tr>
                ) : (
                  offDays.map((offDay, index) => (
                    <tr
                      key={offDay.id}
                      className={`border-t border-[#E2E8F0] ${
                        index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-[#1E293B]">
                        {getVehicleLabel(offDay.vehicleId)}
                      </td>

                      <td className="px-4 py-3 text-[#64748B]">
                        {offDay.type}
                      </td>

                      <td className="px-4 py-3 text-[#64748B]">
                        {offDay.type === "One-time"
                          ? offDay.date
                          : offDay.weekday}
                      </td>

                      <td className="px-4 py-3 text-[#64748B]">
                        {offDay.reason ?? "—"}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteOffDay(offDay.id)}
                          className="text-sm font-medium text-[#B91C1C] hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Route Modal */}
      {isAddRouteOpen && (
        <Modal title="Add Route" onClose={() => setIsAddRouteOpen(false)}>
          <RouteForm
            onSubmit={handleRouteSubmit}
            onCancel={() => setIsAddRouteOpen(false)}
          />
        </Modal>
      )}

      {/* Edit Route Modal */}
      {editingRoute && (
        <Modal title="Edit Route" onClose={() => setEditingRoute(null)}>
          <RouteForm
            route={editingRoute}
            onSubmit={handleRouteSubmit}
            onCancel={() => setEditingRoute(null)}
          />
        </Modal>
      )}

      {/* Add Off-Day Modal */}
      {isAddOffDayOpen && (
        <Modal title="Mark Off-Day" onClose={() => setIsAddOffDayOpen(false)}>
          <OffDayForm
            onSubmit={(offDay) => {
              addOffDay(offDay);
              setIsAddOffDayOpen(false);
            }}
            onCancel={() => setIsAddOffDayOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
