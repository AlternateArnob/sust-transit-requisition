import { useState } from "react";
import AuthShell, { AuthError } from "../../components/AuthShell";
import Button from "../../components/ui/Button";
import { FIELD_BOXED, FIELD_LABEL } from "../../components/application/formTheme";
import { useNavigate, useLocation, Link } from "react-router-dom";
import useUsers from "../../hooks/useUsers";
import useAuth from "../../hooks/useAuth";
import { verifyPassword } from "../../utils/passwordUtils";
import { isAdminRole } from "../../utils/permissions";

interface LocationState {
  message?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { findByEmail } = useUsers();
  const { login } = useAuth();

  const routedMessage = (location.state as LocationState | null)?.message;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(routedMessage ?? null);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    const user = findByEmail(trimmed);

    if (!user) {
      setError("We couldn't find an account for that email.");
      return;
    }

    // Phase 9 — deactivation is a hard block, checked before the
    // unverified/resume-onboarding branches below. Those branches log
    // the user in and send them somewhere to finish setup; a
    // deactivated account must never reach that, regardless of whether
    // it's verified or has a password yet.
    if (user.isActive === false) {
      setError(
        "This account has been deactivated. Contact a Super Admin for access.",
      );
      return;
    }

    // Unverified accounts haven't reached profile setup yet, so they
    // don't have a password to check — resume them at the OTP step
    // instead of blocking them here.
    if (!user.isVerified) {
      setSubmitting(true);
      login(user.id);
      navigate("/otp", { state: { email: trimmed } });
      return;
    }

    // Verified accounts created before password login existed won't have
    // a passwordHash yet — send them to finish that one-time setup step.
    if (!user.passwordHash) {
      setSubmitting(true);
      login(user.id);
      navigate("/profile-setup", {
        state: { message: "Please set a password to continue logging in." },
      });
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (!verifyPassword(password, user.passwordHash)) {
      setError("Incorrect password. Please try again.");
      return;
    }

    setSubmitting(true);
    login(user.id);

    if (isAdminRole(user.role) || user.role === "DepartmentHead") {
      navigate("/admin");
      return;
    }

    navigate("/dashboard");
  }

  return (
    <AuthShell
      title="Log in"
      subtitle="Enter the email and password for your account."
      footer={
        <>
          Need an account?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Register
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col">
          <span className={FIELD_LABEL}>
            Email <span className="text-form-seal">*</span>
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@sust.edu"
            className={FIELD_BOXED}
          />
        </label>

        <label className="flex flex-col">
          <span className={FIELD_LABEL}>
            Password <span className="text-form-seal">*</span>
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className={FIELD_BOXED}
          />
        </label>

        {error ? <AuthError>{error}</AuthError> : null}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Signing in…" : "Continue →"}
        </Button>
      </form>
    </AuthShell>
  );
}
