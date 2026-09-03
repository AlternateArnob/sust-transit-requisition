import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useUsers from "../../hooks/useUsers";
import ProfileField from "../../components/ProfileField";
import SignatureUpload from "../../components/SignatureUpload";
import {
  APPLICANT_PROFILES,
  APPLICANT_TYPES,
} from "../../types";
import type {
  ApplicantProfile,
  ApplicantType,
  UserAccount,
} from "../../types";
import { requiresProfileFields } from "../../utils/authUtils";
import { MIN_PASSWORD_LENGTH } from "../../utils/passwordUtils";

interface ProfileFormErrors {
  fullName?: string;
  mobile?: string;
  department?: string;
  office?: string;
  designation?: string;
  studentRegNumber?: string;
  signature?: string;
  applicantType?: string;
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
  const [applicantType, setApplicantType] = useState<ApplicantType>(
    currentUser && (currentUser.applicantProfile ? "Individual" : "Individual"),
  );
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
    if (currentUser.role !== "Applicant") {
      navigate("/admin");
      return;
    }
  }, [isAuthenticated, currentUser, navigate]);

  const requiredFields = useMemo(
    () =>
      applicantProfile ? requiresProfileFields(applicantProfile) : [],
    [applicantProfile],
  );

  function isLocked(field: keyof UserAccount): boolean {
    return requiredFields.includes(field);
  }

  function validate(): ProfileFormErrors {
    const next: ProfileFormErrors = {};

    if (!fullName.trim()) next.fullName = "Full name is required.";
    if (!mobile.trim()) next.mobile = "Mobile number is required.";

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

    update(updated);
    if (password) {
      savePassword(currentUser.id, password);
    }
    navigate("/apply");
  }

  if (!currentUser) return null;

  const inputClass = (hasError?: boolean) =>
    `h-10 rounded-md border bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747] ${
      hasError ? "border-[#B91C1C]" : "border-[#E2E8F0]"
    }`;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="flex h-16 items-center bg-[#0F2747] px-6 text-white">
        <h1 className="text-lg font-semibold">SUST Transit — Profile</h1>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-6">
          <h2 className="text-xl font-semibold text-[#1E293B]">
            Complete your profile
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Fields marked with 🔒 can only be changed by an admin after
            verification.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <ProfileField
              label="Applicant type"
              required
              error={errors.applicantType}
            >
              <select
                value={applicantType}
                onChange={(event) =>
                  setApplicantType(event.target.value as ApplicantType)
                }
                className={inputClass()}
              >
                {APPLICANT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </ProfileField>

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
                  <input
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className={inputClass(!!errors.department)}
                  />
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
                  <input
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className={inputClass(!!errors.department)}
                  />
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
                  <input
                    value={office}
                    onChange={(event) => setOffice(event.target.value)}
                    className={inputClass(!!errors.office)}
                  />
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
                    className={inputClass(!!errors.designation)}
                  />
                </ProfileField>
              </div>
            ) : null}

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

            <button
              type="submit"
              className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
            >
              Save and continue
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
