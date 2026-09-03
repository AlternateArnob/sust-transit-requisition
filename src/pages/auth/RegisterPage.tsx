import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import useUsers from "../../hooks/useUsers";
import useOtp from "../../hooks/useOtp";
import { isSustEmail } from "../../utils/authUtils";
import type { UserAccount } from "../../types";

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
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="flex h-16 items-center bg-[#0F2747] px-6 text-white">
        <h1 className="text-lg font-semibold">SUST Transit — Register</h1>
      </header>

      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-6">
          <h2 className="text-xl font-semibold text-[#1E293B]">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Use your SUST email. We will send a one-time code to verify it.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-[#1E293B]">
                Email <span className="text-[#B91C1C]">*</span>
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@sust.edu"
                className="h-10 rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
              />
            </label>

            {error ? (
              <p className="rounded-md border border-[#FEE2E2] bg-[#FEE2E2] px-3 py-2 text-sm text-[#B91C1C]">
                {error}
              </p>
            ) : null}

            {devCode ? (
              <p className="rounded-md border border-[#FEF3C7] bg-[#FEF3C7] px-3 py-2 text-sm text-[#B45309]">
                <span className="mr-1 inline-block rounded bg-[#B45309] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Dev preview
                </span>
                OTP for {email}:{" "}
                <span className="font-mono font-semibold">{devCode}</span>
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68] disabled:cursor-not-allowed disabled:bg-[#64748B]"
            >
              {submitting ? "Sending code…" : "Send verification code"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#64748B]">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-[#0F2747] hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
