import { useState } from "react";

import useVehicles from "../hooks/useVehicles";
import useAllocations from "../hooks/useAllocations";

import { getWeekdayFromDate, todayString } from "../utils/scheduleUtils";

import {
  WEEKDAYS,
  type VehicleOffDay,
  type OffDayType,
  type Weekday,
} from "../types";
import { buttonClass } from "./ui/buttonStyles";

interface OffDayFormProps {
  onSubmit: (offDay: VehicleOffDay) => void;
  onCancel: () => void;
}

interface FormErrors {
  vehicleId?: string;
  date?: string;
  weekday?: string;
}

export default function OffDayForm({ onSubmit, onCancel }: OffDayFormProps) {
  const { vehicles } = useVehicles();
  const { allocations } = useAllocations();

  const [vehicleId, setVehicleId] = useState("");
  const [type, setType] = useState<OffDayType>("One-time");
  const [date, setDate] = useState("");
  const [weekday, setWeekday] = useState<Weekday>(WEEKDAYS[0]);
  const [reason, setReason] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  function changeType(next: OffDayType) {
    setType(next);
    setErrors({});
    setSubmitError("");
  }

  function getConflictingAllocations() {
    if (!vehicleId) {
      return [];
    }

    // FR-44 blocks marking an off-day when it would strand an
    // already-scheduled trip — that only matters for today/future
    // allocations. Without this floor, a "Recurring: Monday" off-day
    // could never be set for a vehicle that ever had so much as one
    // completed trip fall on a Monday, no matter how long ago.
    const upcoming = allocations.filter(
      (allocation) => allocation.date >= todayString(),
    );

    if (type === "One-time") {
      return upcoming.filter(
        (allocation) =>
          allocation.vehicleId === vehicleId && allocation.date === date,
      );
    }

    return upcoming.filter(
      (allocation) =>
        allocation.vehicleId === vehicleId &&
        getWeekdayFromDate(allocation.date) === weekday,
    );
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!vehicleId) {
      newErrors.vehicleId = "Vehicle is required.";
    }

    if (type === "One-time" && !date) {
      newErrors.date = "Date is required.";
    }

    if (type === "Recurring" && !weekday) {
      newErrors.weekday = "Weekday is required.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitError("");

    if (!validate()) {
      return;
    }

    const conflicts = getConflictingAllocations();

    if (conflicts.length > 0) {
      const dates = [
        ...new Set(conflicts.map((allocation) => allocation.date)),
      ].join(", ");
      setSubmitError(
        `Cannot mark this vehicle unavailable — it already has ${conflicts.length} allocation(s) on ${dates}. Reassign or remove those allocations first.`,
      );
      return;
    }

    const offDayData: VehicleOffDay = {
      id: crypto.randomUUID(),
      vehicleId,
      type,
      date: type === "One-time" ? date : undefined,
      weekday: type === "Recurring" ? weekday : undefined,
      reason: reason.trim() || undefined,
    };

    onSubmit(offDayData);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Vehicle */}
      <div>
        <label
          htmlFor="offDayVehicle"
          className="mb-1.5 block text-sm font-medium text-text"
        >
          Vehicle
        </label>

        <select
          id="offDayVehicle"
          value={vehicleId}
          onChange={(event) => setVehicleId(event.target.value)}
          className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
        >
          <option value="">Select a vehicle</option>

          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.registrationNumber} — {vehicle.category}
            </option>
          ))}
        </select>

        {errors.vehicleId && (
          <p className="mt-1 text-xs text-error">{errors.vehicleId}</p>
        )}
      </div>

      {/* Type */}
      <div>
        <label className="mb-2 block text-sm font-medium text-text">
          Off-Day Type
        </label>

        <div className="flex gap-5">
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="radio"
              name="offDayType"
              checked={type === "One-time"}
              onChange={() => changeType("One-time")}
            />
            One-time (specific date)
          </label>

          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="radio"
              name="offDayType"
              checked={type === "Recurring"}
              onChange={() => changeType("Recurring")}
            />
            Recurring (weekday)
          </label>
        </div>
      </div>

      {/* Date or Weekday */}
      {type === "One-time" ? (
        <div>
          <label
            htmlFor="offDayDate"
            className="mb-1.5 block text-sm font-medium text-text"
          >
            Date
          </label>

          <input
            id="offDayDate"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-10 w-full rounded-md border border-border px-3 text-sm text-text outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
          />

          {errors.date && (
            <p className="mt-1 text-xs text-error">{errors.date}</p>
          )}
        </div>
      ) : (
        <div>
          <label
            htmlFor="offDayWeekday"
            className="mb-1.5 block text-sm font-medium text-text"
          >
            Weekday
          </label>

          <select
            id="offDayWeekday"
            value={weekday}
            onChange={(event) => setWeekday(event.target.value as Weekday)}
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>

          {errors.weekday && (
            <p className="mt-1 text-xs text-error">{errors.weekday}</p>
          )}
        </div>
      )}

      {/* Reason */}
      <div>
        <label
          htmlFor="offDayReason"
          className="mb-1.5 block text-sm font-medium text-text"
        >
          Reason (optional)
        </label>

        <input
          id="offDayReason"
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Route duty, servicing"
          className="h-10 w-full rounded-md border border-border px-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-secondary focus:ring-1 focus:ring-secondary"
        />
      </div>

      {/* Submit Error */}
      {submitError && (
        <div className="rounded-md border border-error/30 bg-error-bg/50 px-3 py-2">
          <p className="text-sm text-error">{submitError}</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onCancel}
          className={buttonClass("secondary")}
        >
          Cancel
        </button>

        <button
          type="submit"
          className={buttonClass("primary")}
        >
          Mark Off-Day
        </button>
      </div>
    </form>
  );
}
