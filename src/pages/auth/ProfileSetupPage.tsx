import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useUsers from "../../hooks/useUsers";
import ProfileField from "../../components/ProfileField";
import SignatureUpload from "../../components/SignatureUpload";
import SustLogo from "../../components/SustLogo";
import { PART_LABEL, SECTION_TITLE } from "../../components/application/formTheme";
import ApplicantHeader from "../../components/ApplicantHeader";
import { APPLICANT_PROFILES } from "../../types";
import type { ApplicantProfile, UserAccount } from "../../types";
import { requiresProfileFields } from "../../utils/authUtils";
import { MIN_PASSWORD_LENGTH } from "../../utils/passwordUtils";
import { DEPARTMENTS, OFFICES } from "../../data/sustDirectory";

interface ProfileFormErrors {
  fullName?: string;
  mobile?: string;
  department?: string;
  office?: string;
  designation?: string;
  studentRegNumber?: string;
  signature?: string;
  applicantProfile?: string;
  password?: string;
  confirmPassword?: string;
}

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const { currentUser, isAuthenticated } = useAuth();
  const { update, setPassword: savePassword } = useUsers();

  const [fullName, setFullName] = useState(currentUser?.fullName ?? "");
  const [mobile, setMobile] = useState(currentUser?.mobile ?? "");
  const [applicantProfile, setApplicantProfile] = useState<
    ApplicantProfile | ""
  >(currentUser?.applicantProfile ?? "");
  const [department, setDepartment] = useState(currentUser?.department ?? "");
  const [office, setOffice] = useState(currentUser?.office ?? "");
  const [designation, setDesignation] = useState(currentUser?.designation ?? "");
  const [studentRegNumber, setStudentRegNumber] = useState(
    currentUser?.studentRegNumber ?? "",
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(
    currentUser?.signatureDataUrl,
  );
  const hasExistingPassword = Boolean(currentUser?.passwordHash);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ProfileFormErrors>({});

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      navigate("/login");
      return;
    }
    // Applicants and Department/Office Heads (who also apply for
    // vehicles) use this page; Transport Office roles have /admin/profile.
    if (currentUser.role !== "Applicant" && currentUser.role !== "DepartmentHead") {
      navigate("/admin");
      return;
    }
  }, [isAuthenticated, currentUser, navigate]);

  const requiredFields = useMemo(
    () =>
      applicantProfile ? requiresProfileFields(applicantProfile) : [],
    [applicantProfile],
  );

  // Locking is temporarily disabled: for now the applicant should be able
  // to change department/designation/office/studentRegNumber at any time,
  // including after verification. The lock infrastructure below
  // (isLocked/requiredFields, and the `disabled={lockActive && ...}` wiring
  // on each field) is left in place, just dormant, so it can be
  // re-enabled later by restoring `Boolean(currentUser?.isVerified)` here
  // without having to rebuild it.
  const lockActive = false;

  function isLocked(field: keyof UserAccount): boolean {
    if (!lockActive) return false;
    return requiredFields.includes(field);
  }

  function validate(): ProfileFormErrors {
    const next: ProfileFormErrors = {};

    if (!fullName.trim()) next.fullName = "Full name is required.";
    if (!mobile.trim()) next.mobile = "Mobile number is required.";
    if (!signatureDataUrl) next.signature = "Signature is required.";

    if (applicantProfile === "Student") {
      if (!department.trim()) next.department = "Department is required.";
      if (!studentRegNumber.trim())
        next.studentRegNumber = "Registration number is required.";
    }
    if (applicantProfile === "Teacher") {
      if (!department.trim()) next.department = "Department is required.";
      if (!designation.trim()) next.designation = "Designation is required.";
    }
    if (applicantProfile === "Officer") {
      if (!office.trim()) next.office = "Office is required.";
      if (!designation.trim()) next.designation = "Designation is required.";
    }

    // Password is required the first time a user completes their profile
    // (this is what unlocks email + password login). Once a password
    // exists, the fields are optional — only validated if the user is
    // actively changing it.
    if (!hasExistingPassword || password || confirmPassword) {
      if (!password) {
        next.password = "Password is required.";
      } else if (password.length < MIN_PASSWORD_LENGTH) {
        next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
      }
      if (!confirmPassword) {
        next.confirmPassword = "Please confirm your password.";
      } else if (password !== confirmPassword) {
        next.confirmPassword = "Passwords do not match.";
      }
    }

    return next;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!currentUser) return;

    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const updated: UserAccount = {
      ...currentUser,
      applicantProfile: applicantProfile || undefined,
      fullName: fullName.trim(),
      mobile: mobile.trim(),
      signatureDataUrl,
      department: department.trim() || undefined,
      office: office.trim() || undefined,
      designation: designation.trim() || undefined,
      studentRegNumber: studentRegNumber.trim() || undefined,
    };

    // Fix 1 — useUsers().update is update(id, patch); calling it with
    // just `updated` silently made `id` the whole object and `patch`
    // undefined, so `user.id === id` never matched and this save was a
    // no-op at runtime (it also failed `tsc --noEmit`, which is how the
    // bug was first spotted). Passing the id explicitly is the whole
    // fix — `updated` is already a complete UserAccount, valid as the
    // patch too.
    update(currentUser.id, updated);
    if (password) {
      savePassword(currentUser.id, password);
    }
    // Step 9 — same landing decision as LoginPage.tsx: an applicant
    // finishing profile setup for the first time should see the
    // dashboard first, not drop straight onto the requisition form.
    navigate(currentUser.role === "DepartmentHead" ? "/admin" : "/dashboard");
  }

  if (!currentUser) return null;

  const inputClass = (hasError?: boolean) =>
    `h-10 rounded-md border bg-form-field px-3 text-sm text-form-ink outline-none placeholder:text-form-placeholder focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary disabled:bg-form-band disabled:text-form-muted disabled:cursor-not-allowed ${
      hasError ? "border-form-seal" : "border-form-rule"
    }`;

  const isHead = currentUser.role === "DepartmentHead";

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Same top bar as every other applicant page (Fix 3). */}
      <ApplicantHeader active="profile" />

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mx-auto rounded-lg border border-form-rule bg-white px-5 py-6 shadow-sm sm:px-10 sm:py-9">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <SustLogo heightClass="h-14" />
              <div>
                <p className="text-xs text-form-muted">
                  Shahjalal University of Science and Technology · Transport
                  Wing
                </p>
                <h1 className="mt-1 inline-block border-b-2 border-form-action pb-1 text-lg font-bold uppercase tracking-wide text-form-action sm:text-xl">
                  Applicant Profile
                </h1>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-form-muted">Account</p>
              <p className="text-sm font-bold text-form-action">
                {currentUser.email}
              </p>
            </div>
          </header>

          <p className="mt-5 text-sm text-form-muted">
            Update your details below at any time — this information is
            shown on your requisitions.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            <ProfileSection part="Part One" title="Applicant Profile">
              <div className="flex flex-col gap-4">
            <ProfileField
              label="Applicant profile"
              required
              error={errors.applicantProfile}
            >
              <select
                value={applicantProfile}
                onChange={(event) =>
                  setApplicantProfile(event.target.value as ApplicantProfile)
                }
                className={inputClass()}
              >
                <option value="">Select…</option>
                {APPLICANT_PROFILES.map((profile) => (
                  <option key={profile} value={profile}>
                    {profile}
                  </option>
                ))}
              </select>
            </ProfileField>

              </div>
            </ProfileSection>

            <ProfileSection part="Part Two" title="Contact and Affiliation">
              <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileField
                label="Full name"
                required
                error={errors.fullName}
              >
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className={inputClass(!!errors.fullName)}
                />
              </ProfileField>

              <ProfileField
                label="Mobile"
                required
                error={errors.mobile}
              >
                <input
                  type="tel"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  className={inputClass(!!errors.mobile)}
                />
              </ProfileField>
            </div>

            {applicantProfile === "Student" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ProfileField
                  label="Department"
                  required
                  locked={isLocked("department")}
                  error={errors.department}
                >
                  <select
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    disabled={lockActive && isLocked("department")}
                    className={inputClass(!!errors.department)}
                  >
                    <option value="">Select department…</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </ProfileField>
                <ProfileField
                  label="Student registration number"
                  required
                  locked={isLocked("studentRegNumber")}
                  error={errors.studentRegNumber}
                >
                  <input
                    value={studentRegNumber}
                    onChange={(event) =>
                      setStudentRegNumber(event.target.value)
                    }
                    disabled={lockActive && isLocked("studentRegNumber")}
                    className={inputClass(!!errors.studentRegNumber)}
                  />
                </ProfileField>
              </div>
            ) : null}

            {applicantProfile === "Teacher" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ProfileField
                  label="Department"
                  required
                  locked={isLocked("department")}
                  error={errors.department}
                >
                  <select
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    disabled={lockActive && isLocked("department")}
                    className={inputClass(!!errors.department)}
                  >
                    <option value="">Select department…</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </ProfileField>
                <ProfileField
                  label="Designation"
                  required
                  locked={isLocked("designation")}
                  error={errors.designation}
                >
                  <input
                    value={designation}
                    onChange={(event) => setDesignation(event.target.value)}
                    disabled={lockActive && isLocked("designation")}
                    className={inputClass(!!errors.designation)}
                  />
                </ProfileField>
              </div>
            ) : null}

            {applicantProfile === "Officer" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ProfileField
                  label="Office"
                  required
                  locked={isLocked("office")}
                  error={errors.office}
                >
                  <select
                    value={office}
                    onChange={(event) => setOffice(event.target.value)}
                    disabled={lockActive && isLocked("office")}
                    className={inputClass(!!errors.office)}
                  >
                    <option value="">Select office…</option>
                    {OFFICES.map((off) => (
                      <option key={off} value={off}>
                        {off}
                      </option>
                    ))}
                  </select>
                </ProfileField>
                <ProfileField
                  label="Designation"
                  required
                  locked={isLocked("designation")}
                  error={errors.designation}
                >
                  <input
                    value={designation}
                    onChange={(event) => setDesignation(event.target.value)}
                    disabled={lockActive && isLocked("designation")}
                    className={inputClass(!!errors.designation)}
                  />
                </ProfileField>
              </div>
            ) : null}

              </div>
            </ProfileSection>

            <ProfileSection part="Part Three" title="Signature">
            <ProfileField
              label="Signature"
              error={errors.signature}
              helperText="PNG or JPG, ideally on a light background."
            >
              <SignatureUpload
                value={signatureDataUrl}
                onChange={setSignatureDataUrl}
              />
            </ProfileField>

            </ProfileSection>

            <ProfileSection part="Part Four" title="Password">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileField
                label={hasExistingPassword ? "New password" : "Password"}
                required={!hasExistingPassword}
                error={errors.password}
                helperText={
                  hasExistingPassword
                    ? "Leave blank to keep your current password."
                    : `At least ${MIN_PASSWORD_LENGTH} characters. You'll use this with your email to log in.`
                }
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass(!!errors.password)}
                />
              </ProfileField>

              <ProfileField
                label="Confirm password"
                required={!hasExistingPassword}
                error={errors.confirmPassword}
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={inputClass(!!errors.confirmPassword)}
                />
              </ProfileField>
            </div>

            </ProfileSection>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-form-rule pt-5">
              <button
                type="button"
                onClick={() => navigate(isHead ? "/admin" : "/dashboard")}
                className="h-10 rounded-md border border-form-rule bg-white px-4 text-sm font-medium text-form-muted hover:bg-form-band"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-10 rounded-md bg-form-action px-5 text-sm font-medium text-white hover:bg-secondary"
              >
                Save Profile →
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

/** One numbered part of the profile form, matching the requisition form's sections. */
function ProfileSection({
  part,
  title,
  children,
}: {
  part: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-1">
      <p className={PART_LABEL}>{part}</p>
      <h2 className={`${SECTION_TITLE} mb-4`}>{title}</h2>
      {children}
    </section>
  );
}
