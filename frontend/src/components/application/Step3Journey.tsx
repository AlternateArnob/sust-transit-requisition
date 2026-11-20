import { VEHICLE_CATEGORIES, createEmptyTripDraft } from "../../types";
import type {
  ApplicantProfile,
  RequestedVehicleCategory,
  RequisitionType,
  TripDraft,
} from "../../types";
import { isWithinHoldWindow } from "../../utils/validators";
import { parseRoute } from "../../utils/routeUtils";
import { ERROR_TEXT, FIELD_BOXED, FIELD_LABEL, FIELD_TEXTAREA } from "./formTheme";

const VEHICLE_CATEGORY_OPTIONS: RequestedVehicleCategory[] = [
  ...VEHICLE_CATEGORIES,
  "Any",
];

interface Step3JourneyProps {
  requisitionType: RequisitionType;
  onRequisitionTypeChange: (next: RequisitionType) => void;
  trips: TripDraft[];
  onTripsChange: (next: TripDraft[]) => void;
  applicantProfile: ApplicantProfile | undefined;
  /**
   * Keyed by field name for shared fields ("requisitionType"), and by
   * `${field}-${tripId}` for per-trip fields (e.g. `date-abc123`,
   * `holdLimit-abc123`) — see validateAll() in RequisitionForm.tsx.
   */
  errors?: Record<string, string>;
}

const ALL_TYPES: RequisitionType[] = ["Personal", "Departmental/Official"];

const TYPE_HINTS: Partial<Record<RequisitionType, string>> = {
  Personal: "One trip from Campus to a destination and back.",
  "Departmental/Official": "One or more official trips with your own route.",
};

/**
 * Per spec §4, Students can only apply for Departmental/Official use.
 * Teacher/Officer may also use Personal. "Club" is intentionally hidden
 * from every profile for now — there is no Club Account role yet, so
 * offering it as a purpose leads nowhere useful (see Step 3 of the
 * applicant-module fix plan).
 */
function availableTypesFor(
  profile: ApplicantProfile | undefined,
): RequisitionType[] {
  if (profile === "Student") {
    return ["Departmental/Official"];
  }
  return ALL_TYPES;
}

export default function Step3Journey({
  requisitionType,
  onRequisitionTypeChange,
  trips,
  onTripsChange,
  applicantProfile,
  errors = {},
}: Step3JourneyProps) {
  const available = availableTypesFor(applicantProfile);
  const isPersonal = requisitionType === "Personal";
  const isDepartmental = requisitionType === "Departmental/Official";

  function updateTrip(id: string, patch: Partial<TripDraft>) {
    onTripsChange(
      trips.map((trip) => (trip.id === id ? { ...trip, ...patch } : trip)),
    );
  }

  function addTrip() {
    onTripsChange([...trips, createEmptyTripDraft()]);
  }

  function removeTrip(id: string) {
    if (trips.length <= 1) return;
    onTripsChange(trips.filter((trip) => trip.id !== id));
  }

  return (
    <section className="space-y-5">
      <div>
        <p className={FIELD_LABEL}>Purpose of requisition</p>
        <div
          role="radiogroup"
          aria-label="Purpose of requisition"
          className={`grid grid-cols-1 gap-3 ${available.length > 1 ? "sm:grid-cols-2" : ""}`}
        >
          {available.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-form-rule bg-white p-3.5 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
            >
              <input
                type="radio"
                name="requisitionType"
                value={type}
                checked={requisitionType === type}
                onChange={() => onRequisitionTypeChange(type)}
                className="mt-0.5 h-4 w-4 border-form-rule text-primary focus:ring-primary"
              />
              <span>
                <span className="block text-sm font-medium text-form-ink">
                  {type}
                </span>
                <span className="mt-0.5 block text-xs text-form-muted">
                  {TYPE_HINTS[type]}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.requisitionType ? (
          <p className={ERROR_TEXT}>{errors.requisitionType}</p>
        ) : null}
      </div>

      <div
        role="note"
        className="flex items-start gap-2.5 rounded-md border border-form-warn-border bg-form-warn-bg px-3.5 py-2.5 text-sm text-form-warn-text"
      >
        <span
          aria-hidden
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-form-warn-text text-[10px] font-bold leading-none"
        >
          !
        </span>
        <p>Vehicle must not be kept for more than 03 (three) hours.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-form-ink">
            Trip{isDepartmental && trips.length > 1 ? "s" : ""} requested
          </p>
          {isDepartmental ? (
            <button
              type="button"
              onClick={addTrip}
              className="text-sm font-medium text-primary hover:underline"
            >
              + Add another trip
            </button>
          ) : null}
        </div>

        {trips.map((trip, index) => (
          <TripCard
            key={trip.id}
            trip={trip}
            index={index}
            isPersonal={isPersonal}
            showRemove={isDepartmental && trips.length > 1}
            onChange={(patch) => updateTrip(trip.id, patch)}
            onRemove={() => removeTrip(trip.id)}
            errors={errors}
          />
        ))}
      </div>
    </section>
  );
}

function TripCard({
  trip,
  index,
  isPersonal,
  showRemove,
  onChange,
  onRemove,
  errors,
}: {
  trip: TripDraft;
  index: number;
  isPersonal: boolean;
  showRemove: boolean;
  onChange: (patch: Partial<TripDraft>) => void;
  onRemove: () => void;
  errors: Record<string, string>;
}) {
  const durationOk = isWithinHoldWindow(trip.startTime, trip.endTime);
  const holdLimitError = errors[`holdLimit-${trip.id}`];
  const stops = parseRoute(trip.routeText);

  return (
    <div className="rounded-lg border border-form-rule bg-white p-4">
      {!isPersonal ? (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-medium text-primary">
            Trip No. {index + 1}
          </p>
          {showRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs font-medium text-form-seal hover:underline"
            >
              Remove trip
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={FIELD_LABEL}>Date required</label>
          <input
            type="date"
            value={trip.date}
            onChange={(event) => onChange({ date: event.target.value })}
            className={FIELD_BOXED}
          />
          {errors[`date-${trip.id}`] ? (
            <p className={ERROR_TEXT}>{errors[`date-${trip.id}`]}</p>
          ) : null}
        </div>

        <div>
          <label className={FIELD_LABEL}>Vehicle category</label>
          <select
            value={trip.vehicleCategory}
            onChange={(event) =>
              onChange({
                vehicleCategory: event.target.value as RequestedVehicleCategory,
              })
            }
            className={FIELD_BOXED}
          >
            {VEHICLE_CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={FIELD_LABEL}>From time</label>
          <input
            type="time"
            value={trip.startTime}
            onChange={(event) => onChange({ startTime: event.target.value })}
            className={FIELD_BOXED}
          />
        </div>

        <div>
          <label className={FIELD_LABEL}>To time</label>
          <input
            type="time"
            value={trip.endTime}
            onChange={(event) => onChange({ endTime: event.target.value })}
            className={FIELD_BOXED}
          />
        </div>

        {errors[`time-${trip.id}`] ? (
          <p className={`-mt-2 sm:col-span-2 ${ERROR_TEXT}`}>
            {errors[`time-${trip.id}`]}
          </p>
        ) : null}

        {trip.startTime && trip.endTime && !durationOk ? (
          <p className={`-mt-2 sm:col-span-2 ${ERROR_TEXT}`}>
            {holdLimitError ??
              "This trip exceeds the 3-hour vehicle-hold limit."}
          </p>
        ) : null}

        {isPersonal ? (
          <div className="sm:col-span-2">
            <label className={FIELD_LABEL}>Destination</label>
            <div className="flex flex-col gap-2 rounded-md border border-form-rule bg-form-band p-2.5 sm:flex-row sm:items-center">
              <span className="shrink-0 rounded bg-white px-2.5 py-1.5 text-xs font-medium text-form-ink ring-1 ring-form-rule">
                From Campus
              </span>
              <span aria-hidden className="hidden text-form-muted sm:inline">
                →
              </span>
              <input
                value={trip.destination}
                onChange={(event) =>
                  onChange({ destination: event.target.value })
                }
                placeholder="e.g. Osmani International Airport"
                className={FIELD_BOXED}
              />
              <span aria-hidden className="hidden text-form-muted sm:inline">
                →
              </span>
              <span className="shrink-0 rounded bg-white px-2.5 py-1.5 text-xs font-medium text-form-ink ring-1 ring-form-rule">
                Return to Campus
              </span>
            </div>
            {errors[`destination-${trip.id}`] ? (
              <p className={ERROR_TEXT}>{errors[`destination-${trip.id}`]}</p>
            ) : null}
          </div>
        ) : (
          <div className="sm:col-span-2">
            <label className={FIELD_LABEL}>Route</label>
            <textarea
              value={trip.routeText}
              onChange={(event) => onChange({ routeText: event.target.value })}
              rows={2}
              placeholder="Campus -> Amborkhana -> Zindabazar -> Campus"
              className={FIELD_TEXTAREA}
            />
            <p className="mt-1 text-xs text-form-muted">
              Write every stop in order, separated by{" "}
              <span className="font-mono">-&gt;</span>.
            </p>
            {stops.length > 0 ? (
              <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-form-ink">
                {stops.map((stop, stopIndex) => (
                  <li key={`${stop}-${stopIndex}`} className="flex items-center gap-1.5">
                    {stopIndex > 0 ? (
                      <span className="text-form-muted">→</span>
                    ) : null}
                    <span className="rounded-md border border-form-rule bg-form-field px-2 py-0.5">
                      {stop}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
            {errors[`route-${trip.id}`] ? (
              <p className={ERROR_TEXT}>{errors[`route-${trip.id}`]}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
