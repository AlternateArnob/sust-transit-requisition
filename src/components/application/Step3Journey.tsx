import { VEHICLE_CATEGORIES, createEmptyTripDraft } from "../../types";
import type {
  ApplicantProfile,
  RequestedVehicleCategory,
  RequisitionType,
  TripDraft,
} from "../../types";
import { isWithinHoldWindow } from "../../utils/validators";
import { ERROR_TEXT, FIELD_BOXED, FIELD_LABEL, FIELD_UNDERLINE } from "./formTheme";

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={FIELD_LABEL}>Requisition type</label>
          <select
            value={requisitionType}
            onChange={(event) =>
              onRequisitionTypeChange(event.target.value as RequisitionType)
            }
            className={FIELD_BOXED}
          >
            {available.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.requisitionType ? (
            <p className={ERROR_TEXT}>{errors.requisitionType}</p>
          ) : null}
        </div>
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

  return (
    <div className="rounded-none border border-form-rule bg-white p-4">
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
        <p className="-mt-2 text-xs text-form-muted sm:col-span-2">
          Vehicle must not be kept for more than 03 (three) hours.
        </p>

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
            <label className={FIELD_LABEL}>
              Destination — from Campus to
            </label>
            <input
              value={trip.destination}
              onChange={(event) =>
                onChange({ destination: event.target.value })
              }
              placeholder="e.g. Osmani International Airport"
              className={FIELD_UNDERLINE}
            />
            <p className="mt-1 text-xs text-form-muted">and return to Campus</p>
            {errors[`destination-${trip.id}`] ? (
              <p className={ERROR_TEXT}>{errors[`destination-${trip.id}`]}</p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="sm:col-span-2">
              <RepeatableTextList
                label="Ordered stoppage sequence"
                placeholder="e.g. Campus, Zindabazar, Airport, Campus"
                addLabel="+ Add stop"
                values={trip.stoppages}
                onChange={(next) => onChange({ stoppages: next })}
                error={errors[`stoppages-${trip.id}`]}
              />
            </div>

            <div className="sm:col-span-2">
              <RepeatableTextList
                label="Passenger groups (optional)"
                placeholder="e.g. Department Students, Contestants"
                addLabel="+ Add group"
                values={trip.passengerGroups}
                onChange={(next) => onChange({ passengerGroups: next })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Small repeatable text-list control shared by the stoppage-sequence and
 * passenger-groups inputs — an "Add" button appends a blank text field,
 * each entry has its own remove button, order is preserved as entered.
 */
function RepeatableTextList({
  label,
  placeholder,
  addLabel,
  values,
  onChange,
  error,
}: {
  label: string;
  placeholder?: string;
  addLabel: string;
  values: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  function updateAt(index: number, value: string) {
    onChange(values.map((entry, i) => (i === index ? value : entry)));
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...values, ""]);
  }

  return (
    <div>
      <label className={FIELD_LABEL}>{label}</label>

      <div className="space-y-2">
        {values.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={entry}
              onChange={(event) => updateAt(index, event.target.value)}
              placeholder={placeholder}
              className={FIELD_UNDERLINE}
            />
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="text-sm font-medium text-form-seal hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-2 text-sm font-medium text-primary hover:underline"
      >
        {addLabel}
      </button>

      {error ? <p className={ERROR_TEXT}>{error}</p> : null}
      {values.length === 0 && placeholder ? (
        <p className="mt-1 text-xs text-form-muted">{placeholder}</p>
      ) : null}
    </div>
  );
}
