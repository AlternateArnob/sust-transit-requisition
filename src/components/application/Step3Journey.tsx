import type { ApplicantProfile, RequisitionType } from "../../types";
import { isWithinHoldWindow } from "../../utils/validators";

export interface JourneyDraft {
  date: string;
  startTime: string;
  endTime: string;
  destination: string;
  purpose: string;
  requisitionType: RequisitionType;
}

interface Step3JourneyProps {
  value: JourneyDraft;
  onChange: (next: JourneyDraft) => void;
  applicantProfile: ApplicantProfile | undefined;
  errors?: Partial<Record<keyof JourneyDraft, string>>;
}

const ALL_TYPES: RequisitionType[] = [
  "Personal",
  "Departmental",
  "Official",
  "Club",
];

/**
 * Per spec §4, Students can only apply for Departmental or Official use.
 * Other profiles see the full list.
 */
function availableTypesFor(
  profile: ApplicantProfile | undefined,
): RequisitionType[] {
  if (profile === "Student") {
    return ["Departmental", "Official"];
  }
  return ALL_TYPES;
}

export default function Step3Journey({
  value,
  onChange,
  applicantProfile,
  errors = {},
}: Step3JourneyProps) {
  const available = availableTypesFor(applicantProfile);

  function handleField<K extends keyof JourneyDraft>(
    field: K,
    nextValue: JourneyDraft[K],
  ) {
    onChange({ ...value, [field]: nextValue });
  }

  const durationOk = isWithinHoldWindow(value.startTime, value.endTime);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748B]">
        Journey
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
            Requisition type
          </label>
          <select
            value={value.requisitionType}
            onChange={(event) =>
              handleField("requisitionType", event.target.value as RequisitionType)
            }
            className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
          >
            {available.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.requisitionType ? (
            <p className="mt-1 text-xs text-[#B91C1C]">
              {errors.requisitionType}
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
            Date required
          </label>
          <input
            type="date"
            value={value.date}
            onChange={(event) => handleField("date", event.target.value)}
            className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
          />
          {errors.date ? (
            <p className="mt-1 text-xs text-[#B91C1C]">{errors.date}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
            From time
          </label>
          <input
            type="time"
            value={value.startTime}
            onChange={(event) => handleField("startTime", event.target.value)}
            className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
            To time
          </label>
          <input
            type="time"
            value={value.endTime}
            onChange={(event) => handleField("endTime", event.target.value)}
            className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
          />
          {value.startTime && value.endTime && !durationOk ? (
            <p className="mt-1 text-xs text-[#B45309]">
              ⚠ Duration exceeds the 3-hour limit — admin can still approve,
              but it will be flagged.
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
            Destination
          </label>
          <input
            value={value.destination}
            onChange={(event) =>
              handleField("destination", event.target.value)
            }
            placeholder="e.g. Osmani International Airport"
            className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none placeholder:text-[#64748B] focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
          />
          {errors.destination ? (
            <p className="mt-1 text-xs text-[#B91C1C]">
              {errors.destination}
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
            Purpose
          </label>
          <textarea
            value={value.purpose}
            onChange={(event) => handleField("purpose", event.target.value)}
            rows={3}
            className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
          />
          {errors.purpose ? (
            <p className="mt-1 text-xs text-[#B91C1C]">{errors.purpose}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
