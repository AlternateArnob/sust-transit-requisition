import { useState } from "react";

import useVehicles from "../hooks/useVehicles";
import useDriver from "../hooks/useDriver";
import useTransportSchedule from "../hooks/useTransportSchedule";
import useOffDays from "../hooks/useOffDays";
import useAllocations from "../hooks/useAllocations";
import useRequisitions from "../hooks/useRequisitions";

import {
  getWeekdayFromDate,
  getOffDayForVehicleOnDate,
  getStudentTransportTimeForDate,
  formatTimeDisplay,
  todayString,
} from "../utils/scheduleUtils";
import PageTitle from "../components/ui/PageTitle";

type LookupMode = "vehicle" | "driver";

export default function SchedulePage() {
  const { vehicles } = useVehicles();
  const { driver } = useDriver();
  const { routes } = useTransportSchedule();
  const { offDays } = useOffDays();
  const { allocations } = useAllocations();
  const { requisitions } = useRequisitions();

  const [mode, setMode] = useState<LookupMode>("vehicle");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [date, setDate] = useState(todayString());

  const activeDrivers = driver.filter((member) => member.status === "Active");

  const selectedDriver = activeDrivers.find(
    (member) => member.id === selectedDriverId,
  );

  const targetVehicleId =
    mode === "vehicle" ? selectedVehicleId : selectedDriver?.permanentVehicleId;

  const targetVehicle = vehicles.find(
    (vehicle) => vehicle.id === targetVehicleId,
  );

  const weekday = date ? getWeekdayFromDate(date) : undefined;

  const offDay =
    targetVehicleId && date
      ? getOffDayForVehicleOnDate(targetVehicleId, date, offDays)
      : undefined;

  const studentTransportTime =
    targetVehicleId && date
      ? getStudentTransportTimeForDate(targetVehicleId, date, routes)
      : undefined;

  const assignedDriver = targetVehicle?.permanentDriverId
    ? driver.find((member) => member.id === targetVehicle.permanentDriverId)
    : undefined;

  const dayAllocations =
    targetVehicleId && date
      ? allocations
          .filter(
            (allocation) =>
              allocation.vehicleId === targetVehicleId &&
              allocation.date === date,
          )
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
      : [];

  function getRequisitionPurpose(requisitionId: string) {
    return (
      requisitions.find((item) => item.id === requisitionId)?.purpose ??
      "Unknown requisition"
    );
  }

  function formatDate(dateString: string) {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageTitle title="Schedule Lookup" subtitle="Check a vehicle's or driver's commitments on a specific date" />

      {/* Controls */}
      <div className="rounded-lg border border-border bg-white shadow-sm p-5">
        {/* Mode Toggle */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("vehicle")}
            className={`h-9 rounded-md px-4 text-sm font-medium ${
              mode === "vehicle"
                ? "bg-primary text-white"
                : "border border-border text-secondary hover:bg-surface"
            }`}
          >
            By Vehicle
          </button>

          <button
            type="button"
            onClick={() => setMode("driver")}
            className={`h-9 rounded-md px-4 text-sm font-medium ${
              mode === "driver"
                ? "bg-primary text-white"
                : "border border-border text-secondary hover:bg-surface"
            }`}
          >
            By Driver
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {mode === "vehicle" ? (
            <div>
              <label
                htmlFor="vehicleSelect"
                className="mb-1.5 block text-sm font-medium text-text"
              >
                Vehicle
              </label>

              <select
                id="vehicleSelect"
                value={selectedVehicleId}
                onChange={(event) => setSelectedVehicleId(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              >
                <option value="">Select a vehicle</option>

                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registrationNumber} — {vehicle.category}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label
                htmlFor="driverSelect"
                className="mb-1.5 block text-sm font-medium text-text"
              >
                Driver
              </label>

              <select
                id="driverSelect"
                value={selectedDriverId}
                onChange={(event) => setSelectedDriverId(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              >
                <option value="">Select a driver</option>

                {activeDrivers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} — {member.designation}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="dateSelect"
              className="mb-1.5 block text-sm font-medium text-text"
            >
              Date
            </label>

            <input
              id="dateSelect"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-10 w-full rounded-md border border-border px-3 text-sm text-text outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
          </div>
        </div>
      </div>

      {/* Empty state: driver picked but no vehicle assigned */}
      {mode === "driver" &&
        selectedDriver &&
        !selectedDriver.permanentVehicleId && (
          <div className="rounded-lg border border-border bg-white shadow-sm p-8 text-center">
            <p className="font-medium text-text">
              {selectedDriver.name} has no permanently assigned vehicle
            </p>

            <p className="mt-1 text-sm text-text-muted">
              Assign a vehicle to this driver from Vehicle Management to see their
              schedule.
            </p>
          </div>
        )}

      {/* Empty state: nothing selected yet */}
      {!targetVehicleId && !(mode === "driver" && selectedDriver) && (
        <div className="rounded-lg border border-border bg-white shadow-sm p-8 text-center">
          <p className="font-medium text-text">Nothing selected yet</p>

          <p className="mt-1 text-sm text-text-muted">
            Choose a {mode === "vehicle" ? "vehicle" : "driver"} and a date to
            view their schedule.
          </p>
        </div>
      )}

      {/* Results */}
      {targetVehicle && date && (
        <div className="rounded-lg border border-border bg-white shadow-sm">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="font-medium text-text">
                {targetVehicle.registrationNumber} — {targetVehicle.category}
              </p>

              <p className="mt-0.5 text-sm text-text-muted">
                {formatDate(date)} ({weekday})
                {assignedDriver
                  ? ` · Driver: ${assignedDriver.name}`
                  : " · No permanent driver assigned"}
              </p>
            </div>

            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                targetVehicle.operationalStatus === "Active"
                  ? "bg-success-bg text-success"
                  : "bg-warning-bg text-warning"
              }`}
            >
              {targetVehicle.operationalStatus}
            </span>
          </div>

          <div className="space-y-4 p-5">
            {/* Under Maintenance / Out-of-Service warning */}
            {targetVehicle.operationalStatus !== "Active" && (
              <div className="rounded-md border border-form-warn-border bg-form-warn-bg px-4 py-3">
                <p className="text-sm font-medium text-warning">
                  This vehicle is {targetVehicle.operationalStatus} and is not
                  eligible for requisition allocation.
                </p>
              </div>
            )}

            {/* Off-day warning */}
            {offDay && (
              <div className="rounded-md border border-error/30 bg-error-bg/50 px-4 py-3">
                <p className="text-sm font-medium text-error">
                  Marked unavailable on this date —{" "}
                  {offDay.type === "One-time"
                    ? "one-time off-day"
                    : `recurring off-day (every ${offDay.weekday})`}
                  {offDay.reason ? ` · ${offDay.reason}` : ""}
                </p>
              </div>
            )}

            {/* Student transport commitment */}
            <div>
              <p className="mb-2 text-sm font-medium text-text">
                Student Transport
              </p>

              {studentTransportTime ? (
                <div
                  className={`rounded-md border px-4 py-3 ${
                    offDay
                      ? "border-border bg-surface opacity-70"
                      : "border-border bg-white"
                  }`}
                >
                  <p className="text-sm font-medium text-text">
                    Used for student transport on this day until{" "}
                    {formatTimeDisplay(studentTransportTime)}
                  </p>

                  <p className="mt-1 text-sm text-text-muted">
                    Requisition allocations cannot start before this time on{" "}
                    {weekday}.
                  </p>
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
                  This vehicle is free all day on {weekday ?? "this date"} —
                  no student transport schedule applies.
                </p>
              )}
            </div>

            {/* Requisition allocations on this date */}
            <div>
              <p className="mb-2 text-sm font-medium text-text">
                Requisition Allocations
              </p>

              {dayAllocations.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
                  No requisition trips allocated to this vehicle on{" "}
                  {formatDate(date)}.
                </p>
              ) : (
                <ul className="space-y-2">
                  {dayAllocations.map((allocation) => (
                    <li
                      key={allocation.id}
                      className="rounded-md border border-border bg-white px-4 py-3"
                    >
                      <p className="text-sm font-medium text-text">
                        {formatTimeDisplay(allocation.startTime)}–
                        {formatTimeDisplay(allocation.endTime)}
                      </p>
                      <p className="mt-0.5 text-sm text-text-muted">
                        {getRequisitionPurpose(allocation.requisitionId)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
