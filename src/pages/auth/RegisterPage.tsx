import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import useUsers from "../../hooks/useUsers";
import useOtp from "../../hooks/useOtp";
import { isSustEmail } from "../../utils/authUtils";
import type { UserAccount } from "../../types";
import GovFormMasthead from "../../components/application/GovFormMasthead";
import {
  ERROR_TEXT,
  FIELD_LABEL,
  FIELD_UNDERLINE,
} from "../../components/application/formTheme";

const PENDING_EMAIL_KEY = "sust-transit-pending-email";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { findByEmail, add } = useUsers();
  const { requestOtp } = useOtp();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    const pending = localStorage.getItem(PENDING_EMAIL_KEY);
    if (pending) setEmail(pending);
  }, []);

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
    <div className="min-h-screen bg-form-band">
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="border border-form-rule bg-form-paper px-6 py-6 shadow-sm sm:px-8">
          <GovFormMasthead formTitle="Applicant Registration" />

          <p className="mt-4 text-sm text-form-muted">
            Use your SUST email. We will send a one-time code to verify it.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL}>
                Email <span className="text-form-seal">*</span>
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@sust.edu"
                className={FIELD_UNDERLINE}
              />
            </label>

            {error ? <p className={ERROR_TEXT}>{error}</p> : null}

            {devCode ? (
              <p className="border border-[#B45309]/30 bg-[#FEF3C7]/60 px-3 py-2 text-sm text-[#B45309]">
                <span className="mr-1 inline-block bg-[#B45309] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Dev preview
                </span>
                OTP for {email}:{" "}
                <span className="font-mono font-semibold">{devCode}</span>
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-none bg-primary px-4 text-sm font-medium text-white hover:bg-secondary disabled:cursor-not-allowed disabled:bg-form-muted"
            >
              {submitting ? "Sending code…" : "Send verification code"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-form-muted">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
