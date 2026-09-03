import { useRef, useState } from "react";

export interface DetailsDraft {
  reason: string;
  supportingDocumentName: string;
  supportingDocumentDataUrl?: string;
}

interface Step4DetailsProps {
  value: DetailsDraft;
  onChange: (next: DetailsDraft) => void;
  errors?: Partial<Record<keyof DetailsDraft, string>>;
}

const ACCEPT = "application/pdf,image/png,image/jpeg,image/jpg";

/**
 * Step 4 — Reason for requisition (free text) plus an optional supporting
 * document. The document is read through FileReader.readAsDataURL so it can
 * be persisted alongside the requisition in localStorage.
 */
export default function Step4Details({
  value,
  onChange,
  errors = {},
}: Step4DetailsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [readError, setReadError] = useState<string | undefined>();

  function handleField<K extends keyof DetailsDraft>(
    field: K,
    nextValue: DetailsDraft[K],
  ) {
    onChange({ ...value, [field]: nextValue });
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setReadError("File must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }
    setReadError(undefined);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange({
          ...value,
          supportingDocumentName: file.name,
          supportingDocumentDataUrl: reader.result,
        });
      }
    };
    reader.onerror = () => {
      setReadError("Could not read the file. Try a different one.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function handleRemove() {
    onChange({
      ...value,
      supportingDocumentName: "",
      supportingDocumentDataUrl: undefined,
    });
    if (inputRef.current) inputRef.current.value = "";
    setReadError(undefined);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748B]">
        Requisition details
      </h2>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
          Reason for requisition
        </label>
        <textarea
          value={value.reason}
          onChange={(event) => handleField("reason", event.target.value)}
          rows={4}
          className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
        />
        {errors.reason ? (
          <p className="mt-1 text-xs text-[#B91C1C]">{errors.reason}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
          Supporting document (optional)
        </label>

        {value.supportingDocumentDataUrl ? (
          <div className="flex items-center gap-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <span className="flex-1 truncate text-sm text-[#1E293B]">
              {value.supportingDocumentName}
            </span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-sm font-medium text-[#0F2747] hover:underline"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="text-sm font-medium text-[#B91C1C] hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-16 w-48 items-center justify-center rounded-md border border-dashed border-[#E2E8F0] bg-white text-sm font-medium text-[#0F2747] hover:bg-[#F8FAFC]"
          >
            Upload document
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
          className="hidden"
        />

        <p className="mt-1 text-xs text-[#64748B]">
          Accepted formats: PDF, PNG, JPG (max 2 MB).
        </p>

        {readError ? (
          <p className="mt-1 text-xs text-[#B91C1C]">{readError}</p>
        ) : null}

        {errors.supportingDocumentName ? (
          <p className="mt-1 text-xs text-[#B91C1C]">
            {errors.supportingDocumentName}
          </p>
        ) : null}
      </div>
    </section>
  );
}
