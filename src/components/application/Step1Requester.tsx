import { Link } from "react-router-dom";

import type { UserAccount } from "../../types";

interface Step1RequesterProps {
  requester: UserAccount;
}

/**
 * Read-only summary of the signed-in applicant. The applicant must edit
 * their profile before applying if any of the locked fields are missing.
 * The "Edit profile" link routes them back to /profile-setup.
 */
export default function Step1Requester({ requester }: Step1RequesterProps) {
  const departmentOrOffice = requester.department ?? requester.office ?? "—";

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748B]">
        Requester details
      </h2>

      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Field label="Full name" value={requester.fullName ?? "—"} />
        <Field label="Email" value={requester.email} />
        <Field label="Mobile" value={requester.mobile ?? "—"} />
        <Field
          label={requester.department ? "Department" : "Office"}
          value={departmentOrOffice}
        />
        {requester.designation ? (
          <Field label="Designation" value={requester.designation} />
        ) : null}
        {requester.studentRegNumber ? (
          <Field
            label="Registration number"
            value={requester.studentRegNumber}
          />
        ) : null}
        {requester.applicantProfile ? (
          <Field
            label="Applicant profile"
            value={requester.applicantProfile}
          />
        ) : null}
      </div>

      <Link
        to="/profile-setup"
        className="inline-block text-sm font-medium text-[#334E68] hover:underline"
      >
        Edit profile →
      </Link>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#E2E8F0] pb-1.5">
      <p className="text-xs font-medium text-[#64748B]">{label}</p>
      <p className="text-sm text-[#1E293B]">{value}</p>
    </div>
  );
}
