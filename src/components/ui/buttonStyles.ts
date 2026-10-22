export type ButtonVariant = "primary" | "secondary" | "danger" | "success";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-form-action text-white hover:bg-secondary",
  secondary:
    "border border-border bg-white text-text hover:bg-surface",
  danger: "border border-error-bg bg-white text-error hover:bg-error-bg/50",
  success: "bg-success text-white hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs",
};

/** Class string for anything that must look like a button (e.g. a router Link). */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}
