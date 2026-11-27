// Generated from frontend/src/shared/config/sustDirectory.ts (Part 1 §16.1). Names are exact-match
// routing keys, so keep the spelling identical to the frontend file; tests/unit/directorySeed.test.ts
// fails when the two drift apart. The school comes from the section comments in that file.

export interface DepartmentSeed {
  name: string;
  school: string;
}

export const DEPARTMENT_SEEDS: readonly DepartmentSeed[] = [
  { name: "Architecture", school: "School of Applied Sciences and Technology" },
  {
    name: "Chemical Engineering and Polymer Science",
    school: "School of Applied Sciences and Technology",
  },
  {
    name: "Civil and Environmental Engineering",
    school: "School of Applied Sciences and Technology",
  },
  { name: "Computer Science and Engineering", school: "School of Applied Sciences and Technology" },
  {
    name: "Electrical and Electronic Engineering",
    school: "School of Applied Sciences and Technology",
  },
  {
    name: "Food Engineering and Tea Technology",
    school: "School of Applied Sciences and Technology",
  },
  {
    name: "Industrial and Production Engineering",
    school: "School of Applied Sciences and Technology",
  },
  { name: "Mechanical Engineering", school: "School of Applied Sciences and Technology" },
  { name: "Petroleum and Mining Engineering", school: "School of Applied Sciences and Technology" },
  { name: "Biochemistry and Molecular Biology", school: "School of Life Sciences" },
  { name: "Genetic Engineering and Biotechnology", school: "School of Life Sciences" },
  { name: "Chemistry", school: "School of Physical Sciences" },
  { name: "Geography and Environment", school: "School of Physical Sciences" },
  { name: "Mathematics", school: "School of Physical Sciences" },
  { name: "Oceanography", school: "School of Physical Sciences" },
  { name: "Physics", school: "School of Physical Sciences" },
  { name: "Statistics", school: "School of Physical Sciences" },
  { name: "Anthropology", school: "School of Social Sciences" },
  { name: "Bangla", school: "School of Social Sciences" },
  { name: "Economics", school: "School of Social Sciences" },
  { name: "English", school: "School of Social Sciences" },
  { name: "Political Studies", school: "School of Social Sciences" },
  { name: "Public Administration", school: "School of Social Sciences" },
  { name: "Sociology", school: "School of Social Sciences" },
  { name: "Social Work", school: "School of Social Sciences" },
  {
    name: "Forestry and Environmental Science",
    school: "School of Agriculture and Mineral Sciences",
  },
  { name: "Business Administration", school: "School of Management & Business Administration" },
];

export const OFFICE_SEEDS: readonly string[] = [
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
];
