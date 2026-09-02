import { useEffect, useState } from "react";

import useVehicles from "../hooks/useVehicles";
import useRoutes from "../hooks/useRoutes";

import { hasDuplicateRouteSlot } from "../utils/routeUtils";

import {
  ROUTE_SLOTS,
  WEEKDAYS,
  type RecurringRoute,
  type RouteSlot,
  type Weekday,
} from "../types";

interface RouteFormProps {
  route?: RecurringRoute;
  onSubmit: (route: RecurringRoute) => void;
  onCancel: () => void;
}

interface FormErrors {
  vehicleId?: string;
  slot?: string;
  weekdays?: string;
  stops?: string;
}

export default function RouteForm({
  route,
  onSubmit,
  onCancel,
}: RouteFormProps) {
  const isEditing = Boolean(route);

  const { vehicles } = useVehicles();
  const { routes } = useRoutes();

  const eligibleVehicles = vehicles.filter(
    (vehicle) => vehicle.operationalStatus === "Active",
  );

  const [vehicleId, setVehicleId] = useState(route?.vehicleId ?? "");
  const [slot, setSlot] = useState<RouteSlot>(route?.slot ?? ROUTE_SLOTS[0]);
  const [campusDeparture, setCampusDeparture] = useState(
    route?.campusDeparture ?? "",
  );
  const [pointDeparture, setPointDeparture] = useState(
    route?.pointDeparture ?? "",
  );
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    route?.weekdays ?? WEEKDAYS.filter((day) => day !== "Fri"),
  );
  const [stops, setStops] = useState<string[]>(route?.stops ?? [""]);
  const [isActive, setIsActive] = useState(route?.isActive ?? true);
  const [notes, setNotes] = useState(route?.notes ?? "");

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setVehicleId(route?.vehicleId ?? "");
    setSlot(route?.slot ?? ROUTE_SLOTS[0]);
    setCampusDeparture(route?.campusDeparture ?? "");
    setPointDeparture(route?.pointDeparture ?? "");
    setWeekdays(route?.weekdays ?? WEEKDAYS.filter((day) => day !== "Fri"));
    setStops(route?.stops ?? [""]);
    setIsActive(route?.isActive ?? true);
    setNotes(route?.notes ?? "");
    setErrors({});
    setSubmitError("");
  }, [route]);

  function toggleWeekday(day: Weekday) {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  }

  function updateStop(index: number, value: string) {
    setStops((current) =>
      current.map((stop, stopIndex) => (stopIndex === index ? value : stop)),
    );
  }

  function addStop() {
    setStops((current) => [...current, ""]);
  }

  function removeStop(index: number) {
    setStops((current) =>
      current.filter((_, stopIndex) => stopIndex !== index),
    );
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!vehicleId) {
      newErrors.vehicleId = "Vehicle is required.";
    }

    if (!slot) {
      newErrors.slot = "Slot is required.";
    }

    if (weekdays.length === 0) {
      newErrors.weekdays = "Select at least one weekday.";
    }

    const cleanedStops = stops.map((stop) => stop.trim()).filter(Boolean);

    if (cleanedStops.length === 0) {
      newErrors.stops = "Add at least one stop.";
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

    if (
      isActive &&
      hasDuplicateRouteSlot(routes, vehicleId, slot, weekdays, route?.id)
    ) {
      setSubmitError(
        "This vehicle already has an active route in this slot on an overlapping weekday.",
      );
      return;
    }

    const routeData: RecurringRoute = {
      id: route?.id ?? crypto.randomUUID(),
      vehicleId,
      slot,
      campusDeparture: campusDeparture.trim() || undefined,
      pointDeparture: pointDeparture.trim() || undefined,
      weekdays,
      stops: stops.map((stop) => stop.trim()).filter(Boolean),
      isActive,
      notes: notes.trim() || undefined,
    };

    onSubmit(routeData);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Vehicle */}
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

          {eligibleVehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.registrationNumber} — {vehicle.category}
            </option>
          ))}
        </select>

        {errors.vehicleId && (
          <p className="mt-1 text-xs text-[#B91C1C]">{errors.vehicleId}</p>
        )}
      </div>

      {/* Slot */}
      <div>
        <label
          htmlFor="slot"
          className="mb-1.5 block text-sm font-medium text-[#1E293B]"
        >
          Slot
        </label>

        <select
          id="slot"
          value={slot}
          onChange={(event) => setSlot(event.target.value as RouteSlot)}
          className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
        >
          {ROUTE_SLOTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        {errors.slot && (
          <p className="mt-1 text-xs text-[#B91C1C]">{errors.slot}</p>
        )}
      </div>

      {/* Times */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="campusDeparture"
            className="mb-1.5 block text-sm font-medium text-[#1E293B]"
          >
            Campus Departure
          </label>

          <input
            id="campusDeparture"
            type="text"
            value={campusDeparture}
            onChange={(event) => setCampusDeparture(event.target.value)}
            placeholder="e.g. 07:45 AM"
            className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none placeholder:text-[#64748B] focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
          />
        </div>

        <div>
          <label
            htmlFor="pointDeparture"
            className="mb-1.5 block text-sm font-medium text-[#1E293B]"
          >
            Point Departure
          </label>

          <input
            id="pointDeparture"
            type="text"
            value={pointDeparture}
            onChange={(event) => setPointDeparture(event.target.value)}
            placeholder="e.g. 08:25 AM"
            className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none placeholder:text-[#64748B] focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
          />
        </div>
      </div>

      {/* Weekdays */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[#1E293B]">
          Recurring Weekdays
        </label>

        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((day) => (
            <label
              key={day}
              className="flex items-center gap-1.5 text-sm text-[#1E293B]"
            >
              <input
                type="checkbox"
                checked={weekdays.includes(day)}
                onChange={() => toggleWeekday(day)}
              />
              {day}
            </label>
          ))}
        </div>

        {errors.weekdays && (
          <p className="mt-1 text-xs text-[#B91C1C]">{errors.weekdays}</p>
        )}
      </div>

      {/* Stops */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
          Route Sequence (Stops)
        </label>

        <div className="space-y-2">
          {stops.map((stop, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={stop}
                onChange={(event) => updateStop(index, event.target.value)}
                placeholder={`Stop ${index + 1}`}
                className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none placeholder:text-[#64748B] focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
              />

              {stops.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStop(index)}
                  className="h-10 rounded-md border border-[#E2E8F0] px-3 text-sm font-medium text-[#B91C1C] hover:bg-[#F8FAFC]"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addStop}
          className="mt-2 text-sm font-medium text-[#334E68] hover:underline"
        >
          + Add Stop
        </button>

        {errors.stops && (
          <p className="mt-1 text-xs text-[#B91C1C]">{errors.stops}</p>
        )}
      </div>

      {/* Active */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[#1E293B]">
          Status
        </label>

        <div className="flex gap-5">
          <label className="flex items-center gap-2 text-sm text-[#1E293B]">
            <input
              type="radio"
              name="isActive"
              checked={isActive}
              onChange={() => setIsActive(true)}
            />
            Active
          </label>

          <label className="flex items-center gap-2 text-sm text-[#1E293B]">
            <input
              type="radio"
              name="isActive"
              checked={!isActive}
              onChange={() => setIsActive(false)}
            />
            Inactive
          </label>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="notes"
          className="mb-1.5 block text-sm font-medium text-[#1E293B]"
        >
          Notes (optional)
        </label>

        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          placeholder="e.g. Library Trip, Staff Trip"
          className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-sm text-[#1E293B] outline-none placeholder:text-[#64748B] focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
        />
      </div>

      {/* Submit Error */}
      {submitError && (
        <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
          <p className="text-sm text-[#B91C1C]">{submitError}</p>
        </div>
      )}

      {/* Buttons */}
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
          {isEditing ? "Save Changes" : "Add Route"}
        </button>
      </div>
    </form>
  );
}
