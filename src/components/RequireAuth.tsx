import { useEffect, type ReactNode } from "react";
import { buttonClass } from "./ui/buttonStyles";
import { Link, Navigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import type { UserRole } from "../types";

interface RequireAuthProps {
  children: ReactNode;
  /**
   * If provided, only users with one of the listed roles can access the
   * wrapped subtree. Unlisted roles (including unauthenticated users) are
   * redirected to /login.
   */
  roles?: ReadonlyArray<UserRole>;
  /**
   * If true, the wrapper renders an inline "unverified" gate instead of
   * silently redirecting when the user is logged in but not verified.
   * Default behaviour is to redirect to /otp.
   */
  showUnverifiedMessage?: boolean;
}

/**
 * Top-level auth guard. Redirects to /login when no session exists, to
 * /otp when the user is unverified (or renders a soft gate if requested),
 * and to / for role mismatches. Admin routes should wrap their layout
 * with this so the side-effects are consistent across the tree.
 */
export default function RequireAuth({
  children,
  roles,
  showUnverifiedMessage = false,
}: RequireAuthProps) {
  const { currentUser, isAuthenticated, isVerified, logout } = useAuth();
  const location = useLocation();

  const isActive = currentUser?.isActive ?? true;

  // Phase 9 — a deactivated account must be signed out, not just
  // redirected away. Session state lives in useAuth/localStorage, so
  // this is a side effect (can't just render a Navigate and leave the
  // session intact) — a stale session would keep passing isAuthenticated
  // on the very next navigation.
  useEffect(() => {
    if (currentUser && !isActive) {
      logout();
    }
  }, [currentUser, isActive, logout]);

  if (!isAuthenticated || !currentUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (!isActive) {
    // Deactivation is a hard block, checked before the unverified branch
    // below — an unverified-and-deactivated account must not be sent
    // into the OTP "finish onboarding" flow.
    return (
      <Navigate
        to="/login"
        replace
        state={{
          message:
            "This account has been deactivated. Contact a Super Admin for access.",
        }}
      />
    );
  }

  if (!isVerified) {
    if (showUnverifiedMessage) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface p-6">
          <div className="max-w-md rounded-lg border border-border bg-white p-6 text-center">
            <h2 className="text-lg font-semibold text-text">
              Verify your account to continue
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Your account is not yet verified. Complete the OTP step to
              unlock requisition submissions.
            </p>
            <Link
              to="/otp"
              state={{ email: currentUser.email }}
              className={`mt-4 ${buttonClass("primary")}`}
            >
              Go to verification
            </Link>
          </div>
        </div>
      );
    }
    return (
      <Navigate to="/otp" replace state={{ email: currentUser.email }} />
    );
  }

  if (roles && !roles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
