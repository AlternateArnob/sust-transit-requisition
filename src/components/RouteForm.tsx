import { useState } from "react";

import useVehicles from "../hooks/useVehicles";
import useRoutes from "../hooks/useRoutes";

import { WEEKDAYS } from "../types";
import type {
  StudentTransportVehicle,
  StudentTransportSchedule,
  Weekday,
} from "../types";

interface RouteFormProps {
  route?: StudentTransportVehicle;
  onSubmit: (entry: StudentTransportVehicle) => void;
  onCancel: () => void;
}

interface FormErrors {
  vehicleId?: string;
  days?: string;
  freeAfterTime?: string;
}

/*
 * Returns the unique non-empty time used by the schedule, or "" when
 * the schedule mixes times across days. Used to seed the shared
 * time picker when editing an existing entry.
 */
function singleTime(schedule: StudentTransportSchedule): string {
  const values = Object.values(schedule).filter((v) => Boolean(v));

  if (values.length === 0) {
    return "";
  }

  return values.every((v) => v === values[0]) ? (values[0] ?? "") : "";
}

export default function RouteForm({
  route,
  onSubmit,
  onCancel,
}: RouteFormProps) {
  const isEditing = Boolean(route);

  const { vehicles } = useVehicles();
  const { routes } = useRoutes();

  const initialDays: Record<Weekday, boolean> = {
    Sun: Boolean(route?.schedule.Sun),
    Mon: Boolean(route?.schedule.Mon),
    Tue: Boolean(route?.schedule.Tue),
    Wed: Boolean(route?.schedule.Wed),
    Thu: Boolean(route?.schedule.Thu),
    Fri: Boolean(route?.schedule.Fri),
    Sat: Boolean(route?.schedule.Sat),
  };

  const [vehicleId, setVehicleId] = useState(route?.vehicleId ?? "");
  const [days, setDays] = useState<Record<Weekday, boolean>>(initialDays);
  const [freeAfterTime, setFreeAfterTime] = useState(
    singleTime(route?.schedule ?? {}),
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  function toggleDay(day: Weekday, value: boolean) {
    setDays((current) => ({ ...current, [day]: value }));
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!vehicleId) {
      newErrors.vehicleId = "Vehicle is required.";
    }

    const hasDay = WEEKDAYS.some((day) => days[day]);

    if (!hasDay) {
      newErrors.days = "Select at least one weekday.";
    }

    if (hasDay && !freeAfterTime) {
      newErrors.freeAfterTime = "Free After time is required.";
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

    const duplicate = routes.find(
      (entry) => entry.vehicleId === vehicleId && entry.id !== route?.id,
    );

    if (duplicate) {
      setSubmitError(
        "This vehicle already has a student transport schedule. Edit that entry instead.",
      );
      return;
    }

    const schedule: StudentTransportSchedule = {};

    for (const day of WEEKDAYS) {
      if (days[day]) {
        schedule[day] = freeAfterTime;
      }
    }

    const entry: StudentTransportVehicle = {
      id: route?.id ?? crypto.randomUUID(),
      vehicleId,
      schedule,
    };

    onSubmit(entry);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="vehicleId"
          className="mb-1.5 block text-sm font-medium text-[#1E293B]"
        >
          Vehicle
        </label>

        <select
          id="vehicleId"
          value={vehicleId}
          onChange={(event) => setVehicleId(event.target.value)}
          className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
        >
          <option value="">Select a vehicle</option>

          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.registrationNumber} — {vehicle.category}
            </option>
          ))}
        </select>

        {errors.vehicleId && (
          <p className="mt-1 text-xs text-[#B91C1C]">{errors.vehicleId}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
          Scheduled Days
        </label>

        <p className="mb-2 text-xs text-[#64748B]">
          Select the weekdays the vehicle follows the student transport
          schedule. The same Free After time will apply to every selected day.
        </p>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {WEEKDAYS.map((day) => {
            const checked = days[day];

            return (
              <label
                key={day}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
                  checked
                    ? "border-[#0F2747] bg-[#0F2747] text-white"
                    : "border-[#E2E8F0] bg-white text-[#334E68] hover:bg-[#F8FAFC]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggleDay(day, event.target.checked)}
                  className="sr-only"
                />
                {day}
              </label>
            );
          })}
        </div>

        {errors.days && (
          <p className="mt-1 text-xs text-[#B91C1C]">{errors.days}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="freeAfterTime"
          className="mb-1.5 block text-sm font-medium text-[#1E293B]"
        >
          Free After
        </label>

        <input
          id="freeAfterTime"
          type="time"
          value={freeAfterTime}
          onChange={(event) => setFreeAfterTime(event.target.value)}
          className="h-10 w-full max-w-[200px] rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
        />

        <p className="mt-1 text-xs text-[#64748B]">
          Vehicle is unavailable for requisition before this time on every
          selected weekday.
        </p>

        {errors.freeAfterTime && (
          <p className="mt-1 text-xs text-[#B91C1C]">
            {errors.freeAfterTime}
          </p>
        )}
      </div>

      {submitError && (
        <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
          <p className="text-sm text-[#B91C1C]">{submitError}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC]"
        >
          Cancel
        </button>

        <button
          type="submit"
          className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
        >
          {isEditing ? "Save Changes" : "Add Vehicle"}
        </button>
      </div>
    </form>
  );
}
