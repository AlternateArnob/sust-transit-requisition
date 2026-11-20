import { useState } from "react";

import { DEPARTMENTS, OFFICES } from "@/shared/config/sustDirectory";
import { buttonClass } from "@/shared/ui/buttonStyles";
import type { UserAccount, UserRole } from "@/types";

const ALL_ROLES: UserRole[] = [
  "Applicant",
  "DepartmentHead",
  "TransportInCharge",
  "TransportAdministrator",
  "SuperAdmin",
];

export default function EditAccountForm({
  user,
  lock,
  existingEmails,
  onSubmit,
  onCancel,
}: {
  user: UserAccount;
  lock: { locked: boolean; reason?: string };
  existingEmails: string[];
  onSubmit: (patch: {
    fullName: string;
    email: string;
    mobile?: string;
    role: UserRole;
    isActive: boolean;
    headOfDepartment?: string;
    headOfOffice?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [email, setEmail] = useState(user.email);
  const [mobile, setMobile] = useState(user.mobile ?? "");
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive !== false);
  const [headOfDepartment, setHeadOfDepartment] = useState(user.headOfDepartment ?? "");
  const [headOfOffice, setHeadOfOffice] = useState(user.headOfOffice ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedMobile = mobile.trim();

    if (!trimmedName || !trimmedEmail) {
      setError("Name and email are required.");
      return;
    }

    if (existingEmails.includes(trimmedEmail)) {
      setError("Another account is already using this email.");
      return;
    }

    onSubmit({
      fullName: trimmedName,
      email: trimmedEmail,
      mobile: trimmedMobile || undefined,
      role,
      isActive,
      // Fix 7 — the fields that actually determine recommendation
      // routing (findDepartmentHeadsForRequisition matches a
      // requisition's department/office against these). Only meaningful
      // for DepartmentHead accounts, but harmless to carry through
      // otherwise — nothing reads them for any other role.
      headOfDepartment: headOfDepartment || undefined,
      headOfOffice: headOfOffice || undefined,
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
          className="h-10 rounded-md border border-border px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">Mobile Number</span>
        <input
          type="tel"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          placeholder="01XXXXXXXXX"
          className="h-10 rounded-md border border-border px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">Role</span>
        <select
          value={role}
          disabled={lock.locked}
          title={lock.locked ? lock.reason : undefined}
          onChange={(event) => setRole(event.target.value as UserRole)}
          className="h-10 rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-neutral-bg disabled:text-form-placeholder"
        >
          {ALL_ROLES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      {role === "DepartmentHead" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">Head of Department</span>
            <select
              value={headOfDepartment}
              onChange={(event) => setHeadOfDepartment(event.target.value)}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary"
            >
              <option value="">— none —</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">Head of Office</span>
            <select
              value={headOfOffice}
              onChange={(event) => setHeadOfOffice(event.target.value)}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary"
            >
              <option value="">— none —</option>
              {OFFICES.map((off) => (
                <option key={off} value={off}>
                  {off}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-text-muted sm:col-span-2">
            Set one of these to determine which requisitions route to this person for recommendation
            — a requisition's Department or Office must match exactly for it to reach them.
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <span className="text-sm font-medium text-text">Account Active</span>
        <button
          type="button"
          disabled={lock.locked}
          title={lock.locked ? lock.reason : undefined}
          onClick={() => setIsActive((current) => !current)}
          className={`h-8 rounded-md border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
            isActive
              ? "border-border text-success hover:bg-success-bg/40"
              : "border-border text-error hover:bg-error-bg/50"
          }`}
        >
          {isActive ? "Active" : "Deactivated"}
        </button>
      </div>

      {lock.locked && <p className="text-xs text-form-placeholder">{lock.reason}</p>}

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
          Save Changes
        </button>
      </div>
    </form>
  );
}
