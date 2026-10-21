import { useState } from "react";

import useVehicles from "../hooks/useVehicles";
import useTransportSchedule from "../hooks/useTransportSchedule";
import useOffDays from "../hooks/useOffDays";

import Modal from "../components/Modal";
import TransportScheduleForm from "../components/TransportScheduleForm";
import OffDayForm from "../components/OffDayForm";

import {
  formatTimeDisplay,
  formatScheduledDays,
  getScheduledDays,
} from "../utils/scheduleUtils";
import type {
  StudentTransportVehicle,
  StudentTransportSchedule,
} from "../types";
import { buttonClass } from "../components/ui/buttonStyles";
import PageTitle from "../components/ui/PageTitle";

type Tab = "schedule" | "offdays";

export default function TransportSchedulePage() {
  const { vehicles } = useVehicles();
  const { routes, addRoute, updateRoute, deleteRoute } = useTransportSchedule();
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
        <span className="font-medium text-text">{day}:</span>{" "}
        <span className="text-secondary">
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
        <PageTitle title="Transport Schedule" subtitle="Vehicles used for regular student transportation, and when each becomes free for requisition" />

        {tab === "schedule" ? (
          <button
            type="button"
            onClick={() => setIsAddRouteOpen(true)}
            className={buttonClass("primary")}
          >
            + Add Vehicle
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddOffDayOpen(true)}
            className={buttonClass("primary")}
          >
            + Mark Off-Day
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("schedule")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "schedule"
              ? "border-b-2 border-primary text-primary"
              : "text-text-muted hover:text-text"
          }`}
        >
          Student Transport Vehicles ({routes.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("offdays")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "offdays"
              ? "border-b-2 border-primary text-primary"
              : "text-text-muted hover:text-text"
          }`}
        >
          Vehicle Off-Days ({offDays.length})
        </button>
      </div>

      {/* Schedule Tab */}
      {tab === "schedule" && (
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Vehicle Number</th>
                  <th className="px-4 py-3 font-semibold">Vehicle Category</th>
                  <th className="px-4 py-3 font-semibold">Scheduled Days</th>
                  <th className="px-4 py-3 font-semibold">Free After</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody>
                {routes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <p className="font-medium text-text">
                        No student transport vehicles found
                      </p>

                      <p className="mt-1 text-sm text-text-muted">
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
                        className={`border-t border-border ${
                          index % 2 === 1 ? "bg-surface" : "bg-white"
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-text">
                          {vehicle?.registrationNumber ?? "Unknown Vehicle"}
                        </td>

                        <td className="px-4 py-3 text-text-muted">
                          {vehicle?.category ?? "—"}
                        </td>

                        <td className="px-4 py-3 font-medium text-secondary">
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
                              className="text-sm font-medium text-secondary hover:underline"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRoute(entry)}
                              className="text-sm font-medium text-error hover:underline"
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
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Vehicle</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Date / Weekday</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody>
                {offDays.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <p className="font-medium text-text">
                        No off-days found
                      </p>

                      <p className="mt-1 text-sm text-text-muted">
                        Mark a vehicle unavailable for a date or weekday.
                      </p>
                    </td>
                  </tr>
                ) : (
                  offDays.map((offDay, index) => (
                    <tr
                      key={offDay.id}
                      className={`border-t border-border ${
                        index % 2 === 1 ? "bg-surface" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-text">
                        {getVehicleLabel(offDay.vehicleId)}
                      </td>

                      <td className="px-4 py-3 text-text-muted">
                        {offDay.type}
                      </td>

                      <td className="px-4 py-3 text-text-muted">
                        {offDay.type === "One-time"
                          ? offDay.date
                          : offDay.weekday}
                      </td>

                      <td className="px-4 py-3 text-text-muted">
                        {offDay.reason ?? "—"}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteOffDay(offDay.id)}
                          className="text-sm font-medium text-error hover:underline"
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
          <TransportScheduleForm
            onSubmit={handleRouteSubmit}
            onCancel={() => setIsAddRouteOpen(false)}
          />
        </Modal>
      )}

      {/* Edit Vehicle Modal */}
      {editingRoute && (
        <Modal title="Edit Student Transport Schedule" onClose={() => setEditingRoute(null)}>
          <TransportScheduleForm
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
