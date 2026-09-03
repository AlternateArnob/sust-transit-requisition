import { useEffect } from "react";

import type { UserAccount } from "../../types";

export interface TransportUserDraft {
  fullName: string;
  designation: string;
  mobile: string;
}

interface Step2TransportUserProps {
  requester: UserAccount;
  value: TransportUserDraft;
  sameAsRequester: boolean;
  onSameAsRequesterChange: (next: boolean) => void;
  onChange: (next: TransportUserDraft) => void;
  errors?: Partial<Record<keyof TransportUserDraft, string>>;
}

/**
 * Step 2 — collects who will physically use the transport. Defaults to
 * "same as requester" so most applications need only one extra click.
 */
export default function Step2TransportUser({
  requester,
  value,
  sameAsRequester,
  onSameAsRequesterChange,
  onChange,
  errors = {},
}: Step2TransportUserProps) {
  useEffect(() => {
    if (!sameAsRequester) return;
    onChange({
      fullName: requester.fullName ?? "",
      designation: requester.designation ?? "",
      mobile: requester.mobile ?? "",
    });
    // We intentionally re-sync only when sameAsRequester flips on or the
    // requester identity changes; downstream edits are user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sameAsRequester, requester.id]);

  function handleSameAsRequester(next: boolean) {
    onSameAsRequesterChange(next);
    if (next) {
      onChange({
        fullName: requester.fullName ?? "",
        designation: requester.designation ?? "",
        mobile: requester.mobile ?? "",
      });
    }
  }

  function handleField<K extends keyof TransportUserDraft>(
    field: K,
    nextValue: TransportUserDraft[K],
  ) {
    onChange({ ...value, [field]: nextValue });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748B]">
        Transport user
      </h2>

      <label className="flex items-center gap-2 text-sm text-[#1E293B]">
        <input
          type="checkbox"
          checked={sameAsRequester}
          onChange={(event) => handleSameAsRequester(event.target.checked)}
        />
        Transport user is the same as the requester
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
            Full name
          </label>
          <input
            value={value.fullName}
            onChange={(event) => handleField("fullName", event.target.value)}
            disabled={sameAsRequester}
            className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68] disabled:bg-[#F8FAFC] disabled:text-[#64748B]"
          />
          {errors.fullName ? (
            <p className="mt-1 text-xs text-[#B91C1C]">{errors.fullName}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
            Mobile number
          </label>
          <input
            type="tel"
            value={value.mobile}
            onChange={(event) => handleField("mobile", event.target.value)}
            disabled={sameAsRequester}
            className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68] disabled:bg-[#F8FAFC] disabled:text-[#64748B]"
          />
          {errors.mobile ? (
            <p className="mt-1 text-xs text-[#B91C1C]">{errors.mobile}</p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
            Designation (optional)
          </label>
          <input
            value={value.designation}
            onChange={(event) =>
              handleField("designation", event.target.value)
            }
            disabled={sameAsRequester}
            className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68] disabled:bg-[#F8FAFC] disabled:text-[#64748B]"
          />
          {errors.designation ? (
            <p className="mt-1 text-xs text-[#B91C1C]">{errors.designation}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
