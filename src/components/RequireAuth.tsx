import type { ReactNode } from "react";
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
  const { currentUser, isAuthenticated, isVerified } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !currentUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (!isVerified) {
    if (showUnverifiedMessage) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
          <div className="max-w-md rounded-lg border border-[#E2E8F0] bg-white p-6 text-center">
            <h2 className="text-lg font-semibold text-[#1E293B]">
              Verify your account to continue
            </h2>
            <p className="mt-2 text-sm text-[#64748B]">
              Your account is not yet verified. Complete the OTP step to
              unlock requisition submissions.
            </p>
            <Link
              to="/otp"
              state={{ email: currentUser.email }}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
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
