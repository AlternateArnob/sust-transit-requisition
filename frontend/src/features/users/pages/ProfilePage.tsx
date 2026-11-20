import { useState } from "react";
import { Link } from "react-router-dom";

import useAuth from "@/features/auth/hooks/useAuth";
import useUsers from "@/features/users/hooks/useUsers";
import { buttonClass } from "@/shared/ui/buttonStyles";
import PageTitle from "@/shared/ui/PageTitle";
import { ERROR_BANNER_CLASS, INPUT_CLASS } from "@/shared/ui/formStyles";

/**
 * Self-service profile editing for Transport
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
      <PageTitle
        title="Edit Profile"
        subtitle={<>{currentUser.role} — update your own account details.</>}
      />

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-border bg-white shadow-sm p-6"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">Full Name</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">Mobile Number</span>
          <input
            type="tel"
            value={mobile}
            onChange={(event) => setMobile(event.target.value)}
            placeholder="01XXXXXXXXX"
            className={INPUT_CLASS}
          />
        </label>

        {error && <p className={ERROR_BANNER_CLASS}>{error}</p>}

        {saved && !error && (
          <p className="rounded-md border border-success-bg bg-success-bg px-3 py-2 text-sm text-success">
            Profile updated.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Link to="/admin" className={`${buttonClass("secondary")} flex`}>
            Back to Dashboard
          </Link>

          <button type="submit" className={buttonClass("primary")}>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
