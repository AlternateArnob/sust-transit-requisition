import { useRef, useState } from "react";

import { ERROR_TEXT, FIELD_LABEL, FIELD_TEXTAREA, HELPER_TEXT } from "./formTheme";

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
    <section className="space-y-4">
      <div>
        <label className={FIELD_LABEL}>Reason for vehicle requisition</label>
        <textarea
          value={value.reason}
          onChange={(event) => handleField("reason", event.target.value)}
          rows={4}
          placeholder="Briefly describe why the vehicle is needed"
          className={FIELD_TEXTAREA}
        />
        {errors.reason ? <p className={ERROR_TEXT}>{errors.reason}</p> : null}
      </div>

      <div>
        <label className={FIELD_LABEL}>Supporting document (optional)</label>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-form-dashed bg-form-band px-4 py-3">
          <span
            className={`min-w-0 flex-1 truncate text-sm ${
              value.supportingDocumentDataUrl
                ? "text-form-ink"
                : "text-form-placeholder"
            }`}
          >
            {value.supportingDocumentDataUrl
              ? value.supportingDocumentName
              : "No file chosen"}
          </span>

          {value.supportingDocumentDataUrl ? (
            <button
              type="button"
              onClick={handleRemove}
              className="text-sm font-medium text-form-seal hover:underline"
            >
              Remove
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-9 rounded-md border border-form-rule bg-white px-4 text-sm font-medium text-form-ink hover:bg-form-field"
          >
            {value.supportingDocumentDataUrl ? "Replace" : "Browse"}
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
          className="hidden"
        />

        <p className={HELPER_TEXT}>Accepted formats: PDF, PNG, JPG (max 2 MB).</p>

        {readError ? <p className={ERROR_TEXT}>{readError}</p> : null}

        {errors.supportingDocumentName ? (
          <p className={ERROR_TEXT}>{errors.supportingDocumentName}</p>
        ) : null}
      </div>
    </section>
  );
}
