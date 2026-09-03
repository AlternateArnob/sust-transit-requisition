import { useState } from "react";
import type { Trip } from "../types";
import { isPositiveNumber } from "../utils/validators";

interface MileageEntryFormProps {
  /**
   * Every trip on this requisition still awaiting a recorded distance.
   * Almost always a single trip under the new single-journey form, but a
   * legacy multi-trip Club/Official requisition can have several — hence
   * the trip selector below.
   */
  trips: Trip[];
  onSubmit: (tripId: string, distanceKm: number) => void;
  onCancel: () => void;
}

export default function MileageEntryForm({
  trips,
  onSubmit,
  onCancel,
}: MileageEntryFormProps) {
  const [selectedTripId, setSelectedTripId] = useState(trips[0]?.id ?? "");
  const [distanceKm, setDistanceKm] = useState("");
  const [error, setError] = useState("");

  const selectedTrip =
    trips.find((trip) => trip.id === selectedTripId) ?? trips[0];

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTrip) {
      setError("Select a trip to record mileage for.");
      return;
    }

    if (!isPositiveNumber(distanceKm)) {
      setError("Enter a distance greater than 0.");
      return;
    }

    onSubmit(selectedTrip.id, Number(distanceKm));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {trips.length > 1 && (
        <div>
          <label
            htmlFor="mileageTrip"
            className="mb-1.5 block text-sm font-medium text-[#1E293B]"
          >
            Trip
          </label>

          <select
            id="mileageTrip"
            value={selectedTripId}
            onChange={(event) => setSelectedTripId(event.target.value)}
            className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
          >
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.date} · {trip.startTime}–{trip.endTime} · {trip.route}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedTrip && (
        <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#1E293B]">
          <p className="font-medium">
            {selectedTrip.date} · {selectedTrip.startTime}–
            {selectedTrip.endTime}
          </p>

          <p className="mt-1 text-[#64748B]">{selectedTrip.route}</p>
        </div>
      )}

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
