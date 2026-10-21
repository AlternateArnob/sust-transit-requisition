import sustLogo from "../../assets/sust-logo.png";

interface GovFormMastheadProps {
  formTitle: string;
  referenceLabel?: string;
}

/**
 * Step 11 — a letterhead block standing in for the printed masthead on
 * the paper "Vehicle Requisition Form" this page replaces: institution
 * name, wing, form title, and a reference line. The right-hand mark is the official
 * SUST logo (src/assets/sust-logo.png). Also reused (without a reference line) on the Register and
 * Profile Setup pages for visual consistency.
 */
export default function GovFormMasthead({
  formTitle,
  referenceLabel,
}: GovFormMastheadProps) {
  return (
    <div className="border-b-4 border-double border-primary pb-5">
      <div className="flex items-start justify-between gap-5">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight text-primary sm:text-2xl">
            Shahjalal University of Science and Technology
          </h1>
          <p className="mt-0.5 text-sm text-form-muted">
            Transport Wing, Sylhet
          </p>
        </div>
        <SealMark />
      </div>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-t border-form-rule pt-3">
        <p className="text-lg text-form-ink">{formTitle}</p>
        {referenceLabel ? (
          <p className="text-xs text-form-muted">{referenceLabel}</p>
        ) : null}
      </div>
    </div>
  );
}

function SealMark() {
  return (
    <img
      src={sustLogo}
      alt="Shahjalal University of Science and Technology logo"
      className="h-16 w-auto shrink-0"
    />
  );
}
