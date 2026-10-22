/**
 * Shared styling tokens for the applicant-facing forms' "official form"
 * treatment (letterhead, numbered parts, ruled fields, declaration +
 * signature) — structural resemblance to a fillable form, not a literal
 * paper/parchment look. Colors intentionally match the app's existing
 * palette (white, primary navy, standard border/error) so the five step
 * components and the form shell stay visually consistent with the rest
 * of the product.
 */

/**
 * One section of the form. The divider now sits under each section's
 * title (see SECTION_TITLE) rather than between sections, so the wrapper
 * only adds breathing room.
 */
export const SECTION_WRAP = "pt-1";

/** Section title — dark bold uppercase with a full-width light divider beneath. */
export const SECTION_TITLE =
  "border-b border-form-rule pb-2 text-[13px] font-bold uppercase tracking-wide text-form-ink";

export const FIELD_LABEL = "mb-1.5 block text-[13px] font-medium text-form-muted";

/** Boxed field — light muted background, light border, slate placeholder. */
export const FIELD_BOXED =
  "h-10 w-full rounded-md border border-form-rule bg-form-field px-3 text-sm text-form-ink outline-none placeholder:text-form-placeholder focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary";

/**
 * Previously an underline-only "write on the line" field; the card
 * design uses the same boxed input everywhere, so this is an alias kept
 * so existing imports don't change.
 */
export const FIELD_UNDERLINE = FIELD_BOXED;

/** Multi-line version of FIELD_BOXED. */
export const FIELD_TEXTAREA = `${FIELD_BOXED} h-auto py-2`;

export const ERROR_TEXT = "mt-1 text-xs text-form-seal";
export const HELPER_TEXT = "mt-1 text-xs text-form-muted";

export const REQUIRED_MARK = "\u00A0*";
