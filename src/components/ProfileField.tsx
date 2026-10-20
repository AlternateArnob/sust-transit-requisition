import type { ReactNode } from "react";

interface ProfileFieldProps {
  label: string;
  locked?: boolean;
  lockedReason?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: ReactNode;
}

/**
 * Field wrapper that pairs an input/select with a label, an optional lock
 * icon + tooltip, an optional helper caption, and an inline error message.
 */
export default function ProfileField({
  label,
  locked = false,
  lockedReason = "Changes require admin action",
  required = false,
  error,
  helperText,
  children,
}: ProfileFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-sm font-medium text-[#1E293B]">
        {label}
        {required ? <span className="text-[#B91C1C]">*</span> : null}
        {locked ? (
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#FEF3C7] text-[10px] font-bold text-[#B45309]"
            title={lockedReason}
            aria-label={lockedReason}
          >
            🔒
          </span>
        ) : null}
      </span>

      {children}

      {helperText && !error ? (
        <span className="text-xs text-[#64748B]">{helperText}</span>
      ) : null}

      {error ? (
        <span className="text-xs text-[#B91C1C]">{error}</span>
      ) : null}
    </label>
  );
}
