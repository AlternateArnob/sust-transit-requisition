/**
 * Fix 7 — canonical department/office lists.
 *
 * Department was previously free text, which meant "CSE", "Computer
 * Science", and "Computer Science & Engineering" could all exist as
 * three different strings for the same department — and since
 * recommendation routing matches a requisition's `department` against a
 * DepartmentHead's `headOfDepartment` by exact string, any mismatch
 * silently broke routing. A fixed list makes that match reliable and
 * gives Profile Setup and the Users admin page (see UsersPage.tsx) a
 * shared source of truth.
 *
 * Sourced from SUST's own schools-and-departments listing (sust.edu) —
 * 27 departments across 7 schools. If any name here doesn't match the
 * department's actual current name, it's a one-line edit to this file,
 * not a schema change.
 */
export const DEPARTMENTS: string[] = [
  // School of Applied Sciences and Technology
  "Architecture",
  "Chemical Engineering and Polymer Science",
  "Civil and Environmental Engineering",
  "Computer Science and Engineering",
  "Electrical and Electronic Engineering",
  "Food Engineering and Tea Technology",
  "Industrial and Production Engineering",
  "Mechanical Engineering",
  "Petroleum and Mining Engineering",
  // School of Life Sciences
  "Biochemistry and Molecular Biology",
  "Genetic Engineering and Biotechnology",
  // School of Physical Sciences
  "Chemistry",
  "Geography and Environment",
  "Mathematics",
  "Oceanography",
  "Physics",
  "Statistics",
  // School of Social Sciences
  "Anthropology",
  "Bangla",
  "Economics",
  "English",
  "Political Studies",
  "Public Administration",
  "Sociology",
  "Social Work",
  // School of Agriculture and Mineral Sciences
  "Forestry and Environmental Science",
  // School of Management & Business Administration
  "Business Administration",
].sort((a, b) => a.localeCompare(b));

/**
 * Administrative offices (for Officer accounts) — the fixed-list default
 * mentioned when this was flagged as an open question, applied for the
 * same typo/routing-reliability reason as DEPARTMENTS. Sourced from
 * SUST's Registrar's-office listing of "Offices" (sust.edu); narrowed to
 * offices an Officer applicant would plausibly belong to, leaving out
 * hall provostships and the per-school Dean's offices, which route
 * differently from a flat Office-Head model.
 */
export const OFFICES: string[] = [
  "Office of the Vice Chancellor",
  "Office of the Pro Vice Chancellor",
  "Office of the Treasurer",
  "Office of the Registrar",
  "Office of the Controller of Examinations",
  "Office of the Proctor",
  "Office of the Director of Accounts",
  "Office of the Director of Planning and Development",
  "Office of the Chief Engineer",
  "Office of the Physical Education",
  "Office of the Director, Students' Counseling and Guidance",
  "Office of the Transport Administrator",
  "Central Library",
  "Medical Centre",
  "Office of the Inspector of Colleges",
].sort((a, b) => a.localeCompare(b));
