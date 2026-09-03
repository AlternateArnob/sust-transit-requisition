import { useEffect, useRef } from "react";

interface OtpInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * Paste-friendly OTP input. Each cell holds a single character; the field
 * auto-advances focus, supports Cmd/Ctrl+V paste across all cells, and
 * exposes numeric-only entries.
 */
export default function OtpInput({
  length,
  value,
  onChange,
  autoFocus = true,
  disabled = false,
  invalid = false,
}: OtpInputProps) {
  const cells = Array.from({ length }, (_, index) => value[index] ?? "");
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus && refs.current[0]) {
      refs.current[0].focus();
    }
  }, [autoFocus]);

  function setCell(index: number, char: string) {
    const next = cells.slice();
    next[index] = char;
    return next.join("").slice(0, length);
  }

  function handleCellChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = setCell(index, digit);
    onChange(next);
    if (digit && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) {
    if (event.key === "Backspace" && !cells[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const data = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!data) return;
    event.preventDefault();
    const trimmed = data.slice(0, length);
    onChange(trimmed.padEnd(0, ""));
    const focusIndex = Math.min(trimmed.length, length - 1);
    refs.current[focusIndex]?.focus();
  }

  return (
    <div className="flex items-center gap-2">
      {cells.map((char, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={char}
          disabled={disabled}
          aria-label={`OTP digit ${index + 1}`}
          onChange={(event) => handleCellChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onPaste={handlePaste}
          className={`
            h-12 w-10 rounded-md border bg-white text-center text-lg font-semibold
            text-[#1E293B] outline-none transition
            focus:ring-2 focus:ring-[#0F2747] focus:ring-offset-1
            ${
              invalid
                ? "border-[#B91C1C] focus:ring-[#B91C1C]"
                : "border-[#E2E8F0]"
            }
            ${disabled ? "cursor-not-allowed bg-[#F8FAFC]" : ""}
          `}
        />
      ))}
    </div>
  );
}
