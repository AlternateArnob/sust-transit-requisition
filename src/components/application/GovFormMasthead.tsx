import SustLogo from "../SustLogo";

interface GovFormMastheadProps {
  formTitle: string;
  /** Application number shown top-right ("Application No."). */
  applicationNo?: string;
  /** Free-text line shown top-right when there is no application number yet. */
  referenceLabel?: string;
}

/**
 * Header shared by the requisition form, the two requisition review
 * screens and the Register page: SUST logo, university line, bold
 * uppercase title with a dark rule under it, and the application number
 * on the right.
 */
export default function GovFormMasthead({
  formTitle,
  applicationNo,
  referenceLabel,
}: GovFormMastheadProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <SustLogo heightClass="h-14" />
        <div>
          <p className="text-xs text-form-muted">
            Shahjalal University of Science and Technology · Transport Wing
          </p>
          <h1 className="mt-1 inline-block border-b-2 border-form-action pb-1 text-lg font-bold uppercase tracking-wide text-form-action sm:text-xl">
            {formTitle}
          </h1>
        </div>
      </div>

      {applicationNo ? (
        <div className="text-right">
          <p className="text-xs text-form-muted">Application No.</p>
          <p className="text-base font-bold text-form-action">
            {applicationNo}
          </p>
        </div>
      ) : referenceLabel ? (
        <p className="text-xs text-form-muted">{referenceLabel}</p>
      ) : null}
    </header>
  );
}
