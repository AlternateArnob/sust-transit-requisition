import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import useUsers from "../../hooks/useUsers";
import useAuth from "../../hooks/useAuth";
import { verifyPassword } from "../../utils/passwordUtils";

export default function LoginPage() {
  const navigate = useNavigate();
  const { findByEmail } = useUsers();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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

    if (user.role === "Admin" || user.role === "DepartmentHead") {
      navigate("/admin");
      return;
    }

    navigate("/apply");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="flex h-16 items-center bg-[#0F2747] px-6 text-white">
        <h1 className="text-lg font-semibold">SUST Transit — Log in</h1>
      </header>

      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-6">
          <h2 className="text-xl font-semibold text-[#1E293B]">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Enter the email associated with your account.
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

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-[#1E293B]">
                Password <span className="text-[#B91C1C]">*</span>
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="h-10 rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
              />
            </label>

            {error ? (
              <p className="rounded-md border border-[#FEE2E2] bg-[#FEE2E2] px-3 py-2 text-sm text-[#B91C1C]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68] disabled:cursor-not-allowed disabled:bg-[#64748B]"
            >
              {submitting ? "Signing in…" : "Continue"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#64748B]">
            Need an account?{" "}
            <Link
              to="/register"
              className="font-medium text-[#0F2747] hover:underline"
            >
              Register
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
