import { useState } from "react";

import { hashPassword, MIN_PASSWORD_LENGTH } from "@/features/auth/utils/passwordUtils";
import { buttonClass } from "@/shared/ui/buttonStyles";
import { ADMIN_ROLES, type AdminRole } from "@/shared/utils/permissions";
import type { UserAccount } from "@/types";

export default function CreateAccountForm({
  existingEmails,
  onSubmit,
  onCancel,
}: {
  existingEmails: string[];
  onSubmit: (user: UserAccount) => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("TransportInCharge");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      setError("Name and email are required.");
      return;
    }

    if (existingEmails.includes(trimmedEmail)) {
      setError("An account with this email already exists.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    // Appointed internally by a Super Admin (FRD §2) — skips the OTP
    // flow entirely, unlike applicant self-registration. isActive
    // defaults true (see useUsers.ts's migration for why it's optional
    // at the type level rather than always-present here explicitly).
    onSubmit({
      id: crypto.randomUUID(),
      email: trimmedEmail,
      role,
      fullName: trimmedName,
      passwordHash: hashPassword(password),
      isVerified: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">Full Name</span>
        <input
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="h-10 rounded-md border border-border px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@sust.edu"
          className="h-10 rounded-md border border-border px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">Role</span>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as AdminRole)}
          className="h-10 rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        >
          {ADMIN_ROLES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">Initial Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          className="h-10 rounded-md border border-border px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        />
      </label>

      {error && (
        <p className="rounded-md border border-error-bg bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className={buttonClass("secondary")}>
          Cancel
        </button>

        <button type="submit" className={buttonClass("primary")}>
          Create Account
        </button>
      </div>
    </form>
  );
}
