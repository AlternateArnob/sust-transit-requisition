import { useRef } from "react";

interface SignatureUploadProps {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  label?: string;
  accept?: string;
  disabled?: boolean;
  helperText?: string;
}

/**
 * Image (or PDF) upload with preview and remove action. Uses
 * FileReader.readAsDataURL so the file content can be stored in
 * localStorage without a server round-trip.
 */
export default function SignatureUpload({
  value,
  onChange,
  label = "Upload signature",
  accept = "image/png,image/jpeg,image/jpg",
  disabled = false,
  helperText,
}: SignatureUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function handleRemove() {
    onChange(undefined);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex items-center gap-3">
          <img
            src={value}
            alt="Signature preview"
            className="h-16 w-32 rounded border border-border bg-white object-contain"
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-text-muted"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="text-sm font-medium text-error hover:underline disabled:cursor-not-allowed disabled:text-text-muted"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex h-16 w-44 items-center justify-center rounded-md border border-dashed border-border bg-white text-sm font-medium text-primary hover:bg-surface disabled:cursor-not-allowed disabled:text-text-muted"
        >
          {label}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFile}
        disabled={disabled}
        className="hidden"
      />

      {helperText ? (
        <p className="text-xs text-text-muted">{helperText}</p>
      ) : null}
    </div>
  );
}
