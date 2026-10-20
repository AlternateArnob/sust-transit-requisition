import { useState } from "react";
import { Link } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import useUsers from "../hooks/useUsers";

/**
 * Corrections Step 2 — self-service profile editing for Transport
 * Office accounts. There was previously no equivalent of this on the
 * admin side at all (the applicant side already has one) — built as
 * its own page rather than a modal since editing your own account is a
 * destination, not an inline action, matching the plan's stated
 * preference.
 */
export default function ProfilePage() {
  const { currentUser } = useAuth();
  const { update, findByEmail } = useUsers();

  const [fullName, setFullName] = useState(currentUser?.fullName ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [mobile, setMobile] = useState(currentUser?.mobile ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!currentUser) {
    return null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedMobile = mobile.trim();

    if (!trimmedName || !trimmedEmail) {
      setError("Name and email are required.");
      return;
    }

    const existing = findByEmail(trimmedEmail);
    if (existing && existing.id !== currentUser!.id) {
      setError("Another account is already using this email.");
      return;
    }

    update(currentUser!.id, {
      fullName: trimmedName,
      email: trimmedEmail,
      mobile: trimmedMobile || undefined,
    });
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1E293B]">
          Edit Profile
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          {currentUser.role} — update your own account details.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-[#E2E8F0] bg-white p-6"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[#1E293B]">
            Full Name
          </span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="h-10 rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[#1E293B]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10 rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[#1E293B]">
            Mobile Number
          </span>
          <input
            type="tel"
            value={mobile}
            onChange={(event) => setMobile(event.target.value)}
            placeholder="01XXXXXXXXX"
            className="h-10 rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
          />
        </label>

        {error && (
          <p className="rounded-md border border-[#FEE2E2] bg-[#FEE2E2] px-3 py-2 text-sm text-[#B91C1C]">
            {error}
          </p>
        )}

        {saved && !error && (
          <p className="rounded-md border border-[#DCFCE7] bg-[#DCFCE7] px-3 py-2 text-sm text-[#15803D]">
            Profile updated.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Link
            to="/admin"
            className="flex h-9 items-center rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC]"
          >
            Back to Dashboard
          </Link>

          <button
            type="submit"
            className="h-9 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
