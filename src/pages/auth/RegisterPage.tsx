import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import useUsers from "../../hooks/useUsers";
import useOtp from "../../hooks/useOtp";
import { isSustEmail } from "../../utils/authUtils";
import type { UserAccount } from "../../types";
import AuthShell, { AuthError, DevCodeNote } from "../../components/AuthShell";
import Button from "../../components/ui/Button";
import { FIELD_BOXED, FIELD_LABEL } from "../../components/application/formTheme";

const PENDING_EMAIL_KEY = "sust-transit-pending-email";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { findByEmail, add } = useUsers();
  const { requestOtp } = useOtp();

  const [email, setEmail] = useState(
    () => localStorage.getItem(PENDING_EMAIL_KEY) ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!isSustEmail(trimmed)) {
      setError(
        "Please use a valid @sust.edu or @student.sust.edu email address.",
      );
      return;
    }

    const existing = findByEmail(trimmed);
    if (existing && existing.isVerified) {
      setError("This email is already registered. Try logging in instead.");
      return;
    }

    setSubmitting(true);

    const result = requestOtp(trimmed);
    if (!result.ok) {
      setError("Could not generate an OTP. Please try again.");
      setSubmitting(false);
      return;
    }

    if (!existing) {
      const newUser: UserAccount = {
        id: `USR-${crypto.randomUUID()}`,
        email: trimmed,
        role: "Applicant",
        isVerified: false,
        createdAt: new Date().toISOString(),
      };
      add(newUser);
    }

    setDevCode(result.code);
    localStorage.setItem(PENDING_EMAIL_KEY, trimmed);

    setTimeout(() => {
      navigate("/otp", { state: { email: trimmed, devCode: result.code } });
    }, 400);
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Use your SUST email. We will send a one-time code to verify it."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Log in
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

        {error ? <AuthError>{error}</AuthError> : null}

        {devCode ? (
          <DevCodeNote label={`OTP for ${email}:`} code={devCode} />
        ) : null}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Sending code…" : "Send verification code →"}
        </Button>
      </form>
    </AuthShell>
  );
}
