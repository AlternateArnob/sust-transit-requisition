import { useNavigate } from "react-router-dom";

import useAuth from "../hooks/useAuth";

interface LogoutButtonProps {
  /** "dark" for the navy top bars (default); "light" on white/off-white pages. */
  tone?: "dark" | "light";
}

/**
 * The one Log out button, used in every top bar (applicant pages,
 * Department/Office Head pages and the Transport Office / Super Admin
 * shell) so it is always in the same place and looks the same for every
 * role. Clears the session, then returns to the login page.
 */
export default function LogoutButton({ tone = "dark" }: LogoutButtonProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 ${
        tone === "dark"
          ? "border-white/40 text-white hover:bg-white/15 focus-visible:ring-white/70"
          : "border-border bg-white text-text hover:bg-surface focus-visible:ring-primary/40"
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
      Log out
    </button>
  );
}
