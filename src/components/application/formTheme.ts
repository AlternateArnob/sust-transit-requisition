/**
 * Shared styling tokens for the applicant-facing forms' "official form"
 * treatment (letterhead, numbered parts, ruled fields, declaration +
 * signature) — structural resemblance to a fillable form, not a literal
 * paper/parchment look. Colors intentionally match the app's existing
 * palette (white, primary navy, standard border/error) so the five step
 * components and the form shell stay visually consistent with the rest
 * of the product.
 */

/** Divider between form parts — a hairline rule, same tone as the app's standard borders. */
export const SECTION_WRAP =
  "border-t border-form-rule pt-7 first:border-t-0 first:pt-0";

/** Small italic eyebrow ("Part One") above each section title. */
export const PART_LABEL = "text-[13px] font-medium text-primary";

/** Section title ("Requester Details") — sits under the eyebrow. */
export const SECTION_TITLE = "text-[17px] font-semibold text-primary";

export const FIELD_LABEL = "mb-1.5 block text-[13px] font-medium text-form-muted";

/** Underline-only field — for the free-text entries a person "writes on the line". */
export const FIELD_UNDERLINE =
  "h-9 w-full rounded-none border-0 border-b border-form-rule bg-transparent px-0.5 text-sm text-form-ink outline-none placeholder:text-form-muted/70 focus:border-primary";

/** Boxed field — for controls that need a visible hit target (select, date, time, checkbox row). */
export const FIELD_BOXED =
  "h-10 w-full rounded-none border border-form-rule bg-white px-3 text-sm text-form-ink outline-none focus:border-primary focus:ring-1 focus:ring-primary";

export const ERROR_TEXT = "mt-1 text-xs text-form-seal";
export const HELPER_TEXT = "mt-1 text-xs text-form-muted";

export const REQUIRED_MARK = "\u00A0*";
