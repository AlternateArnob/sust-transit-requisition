import { useState } from "react";
import type { Trip } from "../types";
import { isPositiveNumber } from "../utils/validators";

interface MileageEntryFormProps {
  trip: Trip;
  onSubmit: (distanceKm: number) => void;
  onCancel: () => void;
}

export default function MileageEntryForm({
  trip,
  onSubmit,
  onCancel,
}: MileageEntryFormProps) {
  const [distanceKm, setDistanceKm] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = Number(distanceKm);

  // ...
  if (!isPositiveNumber(distanceKm)) {
    setError("Enter a distance greater than 0.");
    return;
  }

    onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#1E293B]">
        <p className="font-medium">
          {trip.date} · {trip.startTime}–{trip.endTime}
        </p>

        <p className="mt-1 text-[#64748B]">{trip.route}</p>
      </div>

      <div>
        <label
          htmlFor="distanceKm"
          className="mb-1.5 block text-sm font-medium text-[#1E293B]"
        >
          Total Distance Travelled (km)
        </label>

        <input
          id="distanceKm"
          type="number"
          min="0"
          step="0.1"
          value={distanceKm}
          onChange={(event) => setDistanceKm(event.target.value)}
          className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
        />

        {error && <p className="mt-1 text-xs text-[#B91C1C]">{error}</p>}
      </div>

      <p className="text-xs text-[#64748B]">
        Billing rate is calculated separately by the Accounts Department — only
        distance is recorded here.
      </p>

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
          Record Mileage
        </button>
      </div>
    </form>
  );
}
