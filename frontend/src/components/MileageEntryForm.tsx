import { useState } from "react";
import type { Trip } from "../types";
import { isPositiveNumber } from "../utils/validators";
import { buttonClass } from "./ui/buttonStyles";

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
            className="mb-1.5 block text-sm font-medium text-text"
          >
            Trip
          </label>

          <select
            id="mileageTrip"
            value={selectedTripId}
            onChange={(event) => setSelectedTripId(event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
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
        <div className="rounded-md border border-border bg-surface p-3 text-sm text-text">
          <p className="font-medium">
            {selectedTrip.date} · {selectedTrip.startTime}–
            {selectedTrip.endTime}
          </p>

          <p className="mt-1 text-text-muted">{selectedTrip.route}</p>
        </div>
      )}

      <div>
        <label
          htmlFor="distanceKm"
          className="mb-1.5 block text-sm font-medium text-text"
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
          className="h-10 w-full rounded-md border border-border px-3 text-sm text-text outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
        />

        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>

      <p className="text-xs text-text-muted">
        Billing rate is calculated separately by the Accounts Department — only
        distance is recorded here.
      </p>

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
          Record Mileage
        </button>
      </div>
    </form>
  );
}
