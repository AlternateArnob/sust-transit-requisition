import type { ReactNode } from "react";

interface PageTitleProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Buttons or links shown on the right (e.g. "Add vehicle"). */
  actions?: ReactNode;
}

/** Standard page heading: title, one-line description, optional actions. */
export default function PageTitle({ title, subtitle, actions }: PageTitleProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
