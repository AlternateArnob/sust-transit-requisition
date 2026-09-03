import { useState } from "react";

import useVehicles from "../hooks/useVehicles";
import useRoutes from "../hooks/useRoutes";
import useOffDays from "../hooks/useOffDays";

import Modal from "../components/Modal";
import RouteForm from "../components/RouteForm";
import OffDayForm from "../components/OffDayForm";

import {
  formatTimeDisplay,
  formatScheduledDays,
  getScheduledDays,
} from "../utils/routeUtils";
import type {
  StudentTransportVehicle,
  StudentTransportSchedule,
} from "../types";

type Tab = "schedule" | "offdays";

export default function RoutesPage() {
  const { vehicles } = useVehicles();
  const { routes, addRoute, updateRoute, deleteRoute } = useRoutes();
  const { offDays, addOffDay, deleteOffDay } = useOffDays();

  const [tab, setTab] = useState<Tab>("schedule");

  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<StudentTransportVehicle | null>(
    null,
  );
  const [isAddOffDayOpen, setIsAddOffDayOpen] = useState(false);

  function getVehicle(vehicleId: string) {
    return vehicles.find((item) => item.id === vehicleId);
  }

  function getVehicleLabel(vehicleId: string) {
    const vehicle = getVehicle(vehicleId);

    return vehicle
      ? `${vehicle.registrationNumber} (${vehicle.category})`
      : "Unknown Vehicle";
  }

  function handleRouteSubmit(entry: StudentTransportVehicle) {
    if (editingRoute) {
      updateRoute(entry);
      setEditingRoute(null);
    } else {
      addRoute(entry);
      setIsAddRouteOpen(false);
    }
  }

  function formatFreeAfterSummary(schedule: StudentTransportSchedule) {
    const days = getScheduledDays(schedule);

    if (days.length === 0) {
      return "—";
    }

    const first = days[0];
    const firstTime = schedule[first];
    const allSame = days.every((day) => schedule[day] === firstTime);

    if (allSame && firstTime) {
      return formatTimeDisplay(firstTime);
    }

    return days.map((day) => (
      <div key={day} className="text-xs leading-5">
        <span className="font-medium text-[#1E293B]">{day}:</span>{" "}
        <span className="text-[#334E68]">
          {formatTimeDisplay(schedule[day] ?? "")}
        </span>
      </div>
    ));
  }

  function handleDeleteRoute(entry: StudentTransportVehicle) {
    const confirmed = window.confirm(
      `Remove ${getVehicleLabel(entry.vehicleId)} from the student transport schedule?`,
    );

    if (confirmed) {
      deleteRoute(entry.id);
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
            Transport Schedule
          </h1>

          <p className="mt-1 text-sm text-[#64748B]">
            Vehicles used for regular student transportation, and when each
            becomes free for requisition
          </p>
        </div>

        {tab === "schedule" ? (
          <button
            type="button"
            onClick={() => setIsAddRouteOpen(true)}
            className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
          >
            + Add Vehicle
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
          onClick={() => setTab("schedule")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "schedule"
              ? "border-b-2 border-[#0F2747] text-[#0F2747]"
              : "text-[#64748B] hover:text-[#1E293B]"
          }`}
        >
          Student Transport Vehicles ({routes.length})
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

      {/* Schedule Tab */}
      {tab === "schedule" && (
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0F2747] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Vehicle Number</th>
                  <th className="px-4 py-3 font-medium">Vehicle Category</th>
                  <th className="px-4 py-3 font-medium">Scheduled Days</th>
                  <th className="px-4 py-3 font-medium">Free After</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {routes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <p className="font-medium text-[#1E293B]">
                        No student transport vehicles found
                      </p>

                      <p className="mt-1 text-sm text-[#64748B]">
                        Add a vehicle used for regular student transportation.
                      </p>
                    </td>
                  </tr>
                ) : (
                  routes.map((entry, index) => {
                    const vehicle = getVehicle(entry.vehicleId);

                    return (
                      <tr
                        key={entry.id}
                        className={`border-t border-[#E2E8F0] ${
                          index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-[#1E293B]">
                          {vehicle?.registrationNumber ?? "Unknown Vehicle"}
                        </td>

                        <td className="px-4 py-3 text-[#64748B]">
                          {vehicle?.category ?? "—"}
                        </td>

                        <td className="px-4 py-3 font-medium text-[#334E68]">
                          {formatScheduledDays(entry.schedule)}
                        </td>

                        <td className="px-4 py-3">
                          {formatFreeAfterSummary(entry.schedule)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setEditingRoute(entry)}
                              className="text-sm font-medium text-[#334E68] hover:underline"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRoute(entry)}
                              className="text-sm font-medium text-[#B91C1C] hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Off-Days Tab — unchanged */}
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

      {/* Add Vehicle Modal */}
      {isAddRouteOpen && (
        <Modal title="Add Student Transport Vehicle" onClose={() => setIsAddRouteOpen(false)}>
          <RouteForm
            onSubmit={handleRouteSubmit}
            onCancel={() => setIsAddRouteOpen(false)}
          />
        </Modal>
      )}

      {/* Edit Vehicle Modal */}
      {editingRoute && (
        <Modal title="Edit Student Transport Schedule" onClose={() => setEditingRoute(null)}>
          <RouteForm
            route={editingRoute}
            onSubmit={handleRouteSubmit}
            onCancel={() => setEditingRoute(null)}
          />
        </Modal>
      )}

      {/* Add Off-Day Modal — unchanged */}
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
