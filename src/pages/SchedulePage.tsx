import { useState } from "react";

import useVehicles from "../hooks/useVehicles";
import useDriver from "../hooks/useDriver";
import useRoutes from "../hooks/useRoutes";
import useOffDays from "../hooks/useOffDays";

import {
  getWeekdayFromDate,
  getOffDayForVehicleOnDate,
  getStudentTransportTimeForDate,
  formatTimeDisplay,
} from "../utils/routeUtils";

type LookupMode = "vehicle" | "driver";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SchedulePage() {
  const { vehicles } = useVehicles();
  const { driver } = useDriver();
  const { routes } = useRoutes();
  const { offDays } = useOffDays();

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
      <div>
        <h1 className="text-2xl font-semibold text-[#1E293B]">
          Schedule Lookup
        </h1>

        <p className="mt-1 text-sm text-[#64748B]">
          Check a vehicle's or driver's commitments on a specific date
        </p>
      </div>

      {/* Controls */}
      <div className="rounded-lg border border-[#E2E8F0] bg-white p-5">
        {/* Mode Toggle */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("vehicle")}
            className={`h-9 rounded-md px-4 text-sm font-medium ${
              mode === "vehicle"
                ? "bg-[#0F2747] text-white"
                : "border border-[#E2E8F0] text-[#334E68] hover:bg-[#F8FAFC]"
            }`}
          >
            By Vehicle
          </button>

          <button
            type="button"
            onClick={() => setMode("driver")}
            className={`h-9 rounded-md px-4 text-sm font-medium ${
              mode === "driver"
                ? "bg-[#0F2747] text-white"
                : "border border-[#E2E8F0] text-[#334E68] hover:bg-[#F8FAFC]"
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
                className="mb-1.5 block text-sm font-medium text-[#1E293B]"
              >
                Vehicle
              </label>

              <select
                id="vehicleSelect"
                value={selectedVehicleId}
                onChange={(event) => setSelectedVehicleId(event.target.value)}
                className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
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
                className="mb-1.5 block text-sm font-medium text-[#1E293B]"
              >
                Driver
              </label>

              <select
                id="driverSelect"
                value={selectedDriverId}
                onChange={(event) => setSelectedDriverId(event.target.value)}
                className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
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
              className="mb-1.5 block text-sm font-medium text-[#1E293B]"
            >
              Date
            </label>

            <input
              id="dateSelect"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
            />
          </div>
        </div>
      </div>

      {/* Empty state: driver picked but no vehicle assigned */}
      {mode === "driver" &&
        selectedDriver &&
        !selectedDriver.permanentVehicleId && (
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center">
            <p className="font-medium text-[#1E293B]">
              {selectedDriver.name} has no permanently assigned vehicle
            </p>

            <p className="mt-1 text-sm text-[#64748B]">
              Assign a vehicle to this driver from Vehicle Management to see their
              schedule.
            </p>
          </div>
        )}

      {/* Empty state: nothing selected yet */}
      {!targetVehicleId && !(mode === "driver" && selectedDriver) && (
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center">
          <p className="font-medium text-[#1E293B]">Nothing selected yet</p>

          <p className="mt-1 text-sm text-[#64748B]">
            Choose a {mode === "vehicle" ? "vehicle" : "driver"} and a date to
            view their schedule.
          </p>
        </div>
      )}

      {/* Results */}
      {targetVehicle && date && (
        <div className="rounded-lg border border-[#E2E8F0] bg-white">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
            <div>
              <p className="font-medium text-[#1E293B]">
                {targetVehicle.registrationNumber} — {targetVehicle.category}
              </p>

              <p className="mt-0.5 text-sm text-[#64748B]">
                {formatDate(date)} ({weekday})
                {assignedDriver
                  ? ` · Driver: ${assignedDriver.name}`
                  : " · No permanent driver assigned"}
              </p>
            </div>

            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                targetVehicle.operationalStatus === "Active"
                  ? "bg-[#DCFCE7] text-[#15803D]"
                  : "bg-[#FEF3C7] text-[#B45309]"
              }`}
            >
              {targetVehicle.operationalStatus}
            </span>
          </div>

          <div className="space-y-4 p-5">
            {/* Under Maintenance / Out-of-Service warning */}
            {targetVehicle.operationalStatus !== "Active" && (
              <div className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
                <p className="text-sm font-medium text-[#B45309]">
                  This vehicle is {targetVehicle.operationalStatus} and is not
                  eligible for requisition allocation.
                </p>
              </div>
            )}

            {/* Off-day warning */}
            {offDay && (
              <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
                <p className="text-sm font-medium text-[#B91C1C]">
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
              <p className="mb-2 text-sm font-medium text-[#1E293B]">
                Student Transport
              </p>

              {studentTransportTime ? (
                <div
                  className={`rounded-md border px-4 py-3 ${
                    offDay
                      ? "border-[#E2E8F0] bg-[#F8FAFC] opacity-70"
                      : "border-[#E2E8F0] bg-white"
                  }`}
                >
                  <p className="text-sm font-medium text-[#1E293B]">
                    Used for student transport on this day until{" "}
                    {formatTimeDisplay(studentTransportTime)}
                  </p>

                  <p className="mt-1 text-sm text-[#64748B]">
                    Requisition allocations cannot start before this time on{" "}
                    {weekday}.
                  </p>
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-[#E2E8F0] px-4 py-6 text-center text-sm text-[#64748B]">
                  This vehicle is free all day on {weekday ?? "this date"} —
                  no student transport schedule applies.
                </p>
              )}
            </div>

            <p className="text-xs text-[#64748B]">
              Requisition allocations for this date will also appear here once
              the Allocation module is built (Lesson 14).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
