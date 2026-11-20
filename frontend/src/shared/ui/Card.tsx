import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Remove the default padding (e.g. for a card that wraps a table). */
  flush?: boolean;
}

/** White rounded container with a light border and soft shadow. */
export default function Card({ children, className = "", flush = false }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-white shadow-sm ${
        flush ? "" : "p-5"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Section heading inside a card or page: bold uppercase with a divider beneath. */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 border-b border-border pb-2 text-[13px] font-bold uppercase tracking-wide text-form-ink">
      {children}
    </h2>
  );
}
