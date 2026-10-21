import { useEffect, useMemo, useState } from "react";
import AuthShell, { AuthError, DevCodeNote } from "../../components/AuthShell";
import Button from "../../components/ui/Button";
import { FIELD_LABEL } from "../../components/application/formTheme";
import { useNavigate, useLocation, Link } from "react-router-dom";
import useOtp from "../../hooks/useOtp";
import useUsers from "../../hooks/useUsers";
import useAuth from "../../hooks/useAuth";
import OtpInput from "../../components/OtpInput";
import {
  OTP_EXPIRY_MS,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
} from "../../types";

interface LocationState {
  email?: string;
  devCode?: string;
}

const PENDING_EMAIL_KEY = "sust-transit-pending-email";

export default function OtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const { verifyOtp, requestOtp, challenges } = useOtp();
  const { findByEmail, markVerified } = useUsers();
  const { login } = useAuth();

  const [email] = useState<string>(
    state.email ?? localStorage.getItem(PENDING_EMAIL_KEY) ?? "",
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(state.devCode ?? null);

  const challenge = useMemo(
    () => challenges.find((c) => c.email === email.toLowerCase()),
    [challenges, email],
  );

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!challenge) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [challenge]);

  const expiresAt = challenge ? new Date(challenge.expiresAt).getTime() : null;
  const secondsLeft =
    expiresAt !== null ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
  const expired = challenge !== undefined && secondsLeft === 0;

  function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInvalid(false);

    if (!email) {
      setError("Please return to the registration page first.");
      return;
    }

    if (code.length !== OTP_LENGTH) {
      setError(`Please enter all ${OTP_LENGTH} digits.`);
      setInvalid(true);
      return;
    }

    setSubmitting(true);
    const result = verifyOtp(email, code);

    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        "no-challenge": "No active challenge — please request a new code.",
        expired: "Code expired. Please request a new one.",
        "attempts-exceeded": `Too many attempts. Please request a new code.`,
        "wrong-code": `Incorrect code. ${
          challenge
            ? `${OTP_MAX_ATTEMPTS - (challenge.attempts + 1)} attempt${
                OTP_MAX_ATTEMPTS - (challenge.attempts + 1) === 1 ? "" : "s"
              } remaining.`
            : ""
        }`,
      };
      setError(messages[result.reason]);
      setInvalid(true);
      setCode("");
      setSubmitting(false);
      return;
    }

    const user = findByEmail(email);
    if (!user) {
      setError("Account record missing — please register again.");
      setSubmitting(false);
      return;
    }

    markVerified(user.id);
    login(user.id);
    localStorage.removeItem(PENDING_EMAIL_KEY);

    navigate("/profile-setup");
  }

  function handleResend() {
    if (!email) return;
    const result = requestOtp(email);
    if (result.ok) {
      setDevCode(result.code);
      setCode("");
      setError(null);
      setInvalid(false);
    }
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle={
        <>
          We sent a {OTP_LENGTH}-digit code to{" "}
          <span className="font-medium text-form-ink">
            {email || "your email"}
          </span>
          . The code is valid for {OTP_EXPIRY_MS / 60000} minutes.
        </>
      }
    >
      {devCode ? (
        <div className="mb-4">
          <DevCodeNote label="Latest code:" code={devCode} />
        </div>
      ) : null}

      <form onSubmit={handleVerify} className="flex flex-col gap-4">
        <div className="flex flex-col items-center">
          <span className={FIELD_LABEL}>Verification code</span>
          <OtpInput
            length={OTP_LENGTH}
            value={code}
            onChange={setCode}
            invalid={invalid}
            disabled={submitting}
          />
          {challenge ? (
            <span className="mt-2 text-xs text-form-muted">
              {expired
                ? "Code expired."
                : `Expires in ${Math.floor(secondsLeft / 60)}:${String(
                    secondsLeft % 60,
                  ).padStart(2, "0")}`}
            </span>
          ) : null}
        </div>

        {error ? <AuthError>{error}</AuthError> : null}

        <Button type="submit" disabled={submitting || expired} className="w-full">
          {submitting ? "Verifying…" : "Verify →"}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={handleResend}
            className="font-medium text-primary hover:underline"
          >
            Resend code
          </button>
          <Link to="/register" className="font-medium text-form-muted hover:underline">
            Change email
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
