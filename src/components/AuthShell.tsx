import type { ReactNode } from "react";

import useAuth from "../hooks/useAuth";
import LogoutButton from "./LogoutButton";
import SustLogo from "./SustLogo";

interface AuthShellProps {
  /** Page title, shown in bold uppercase with a rule under it. */
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Small line under the card's content (e.g. "Need an account? Register"). */
  footer?: ReactNode;
}

/**
 * Shared frame for the Login, Register and Verify pages: the same white
 * rounded card, logo and underlined title as the requisition form, on the
 * off-white page background. If someone is signed in but hasn't finished
 * verifying (so they land here), a Log out button is shown top-right so
 * they are never stuck without a way out.
 */
export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-surface px-4 py-10">
      {isAuthenticated ? (
        <div className="mx-auto mb-4 flex max-w-md justify-end">
          <LogoutButton tone="light" />
        </div>
      ) : null}

      <main className="mx-auto max-w-md">
        <div className="rounded-lg border border-form-rule bg-white px-6 py-8 shadow-sm sm:px-9">
          <div className="text-center">
            <SustLogo heightClass="h-16" className="mx-auto block" />
            <p className="mt-3 text-xs text-form-muted">
              Shahjalal University of Science and Technology · Transport Wing
            </p>
            <h1 className="mt-2 inline-block border-b-2 border-form-action pb-1 text-lg font-bold uppercase tracking-wide text-form-action">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 text-sm text-form-muted">{subtitle}</p>
            ) : null}
          </div>

          <div className="mt-7">{children}</div>

          {footer ? (
            <p className="mt-6 border-t border-form-rule pt-5 text-center text-sm text-form-muted">
              {footer}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/** Red inline message used for sign-in / verification errors. */
export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-error/30 bg-error-bg px-3 py-2 text-sm text-error"
    >
      {children}
    </p>
  );
}

/** Warm "dev preview" banner that shows the one-time code during local testing. */
export function DevCodeNote({ label, code }: { label: string; code: string }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2.5 rounded-md border border-form-warn-border bg-form-warn-bg px-3.5 py-2.5 text-sm text-form-warn-text"
    >
      <span
        aria-hidden
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-form-warn-text text-[10px] font-bold leading-none"
      >
        !
      </span>
      <p>
        <span className="font-semibold">Dev preview · </span>
        {label} <span className="font-mono font-semibold">{code}</span>
      </p>
    </div>
  );
}
