# SUST Transit Requisition — Frontend Cleanup Plan

**Repo:** `AlternateArnob/sust-transit-requisition` (branch `main`)
**Goal:** put the frontend into a standard, maintainable layout **before the backend work starts**, without changing how the app behaves.
**Delivery:** the work is done step by step on a clone of the repo, verified after every step, and handed over as a **patch file** (plus a fallback archive). See [Delivery](#delivery).

---

## Ground rules

1. **No functional changes.** Every screen, rule, route and stored value behaves exactly as before. After each step `npm run build` and `npm run lint` must pass and the role click-through must show no console errors.
2. **History is kept.** Files are moved with `git mv` so `git log --follow` still works.
3. **One step = one commit**, in the order below. Moves and edits are never mixed with formatting in the same commit, so the diffs stay readable.
4. **Storage keys keep their values** (`sust-transit-vehicles`, …) so existing browser data keeps working.

## Decisions made

| Question | Decision |
|---|---|
| `frontend/` folder? | **Yes.** Everything now at the repo root moves into `frontend/`. `backend/` and `docs/` are added beside it. |
| Folder style inside `src/` | **Feature folders** (`features/auth`, `features/requisitions`, …). They match the backend modules, and three people can work in parallel without touching the same files. |
| Domain types | Stay in one shared `src/types/` folder. `Requisition`, `Trip`, `Vehicle`, … are used by many features, so splitting them per feature would create circular imports. |
| Barrel `index.ts` files | **Not used.** They cause circular imports and slower hot-reload. Files import each other directly through the `@/` alias. |
| Conflicts page | **Left exactly as it is for now** (deferred, see below). |

## Deferred (not part of this cleanup)

These came up in discussion and are **intentionally not done now**; they are future improvements:

- The Conflicts page, its detection and notifications, and the links to `/admin/conflicts` (the route itself is missing today, so those links show a 404). Nothing about conflicts is changed in this cleanup.
- Preventing conflicts at the source (blocking vehicle-status and schedule changes that would strand an assigned trip), hiding unavailable vehicles in the vehicle picker, and the "emergency breakdown" rule.
- Any backend work, and the repo-name edit of the two backend plan documents.

---

## Target structure

```
sust-transit-requisition/
├── frontend/
│   ├── index.html  package.json  vite.config.ts  tsconfig*.json  eslint.config.js
│   ├── .env.example  .nvmrc  .prettierrc  .prettierignore
│   ├── public/
│   └── src/
│       ├── main.tsx  index.css  assets/
│       ├── app/
│       │   ├── router.tsx
│       │   └── layout/            AdminLayout, Navbar, Sidebar, ApplicantHeader
│       ├── shared/
│       │   ├── ui/                Button, Card, PageTitle, StatusBadge, badgeTones, buttonStyles,
│       │   │                      DataTable, Modal, StatCard, SustLogo
│       │   ├── hooks/             useLocalStorageCollection
│       │   ├── config/            storageKeys, sustDirectory
│       │   └── utils/             permissions, validators
│       ├── types/                 (shared domain types, unchanged apart from removing duplicates)
│       └── features/
│           ├── auth/              pages (Login, Register, Otp, ProfileSetup)
│           │                      components (AuthShell, OtpInput, SignatureUpload, ProfileField, RequireAuth, LogoutButton)
│           │                      hooks (useAuth, useOtp)  utils (authUtils, passwordUtils)
│           ├── users/             pages (UsersPage, ProfilePage)  hooks (useUsers)
│           ├── landing/           pages (LandingPage)
│           ├── dashboard/         pages (DashboardPage, ApplicantDashboardPage)
│           ├── notifications/     components (NotificationBell)  pages  hooks  utils
│           ├── requisitions/      pages (Apply, MyRequisitions, Requisitions, recommender/*)
│           │                      components (RequisitionForm, RequisitionDetail, ApplicantRequisitionDetail,
│           │                      AllocationPicker, application/*, recommender/*)
│           │                      hooks (useRequisitions, useAllocations)
│           │                      utils (requisitionUtils, routeUtils, allocationUtils)
│           ├── fleet/             pages (Vehicle, VehicleDetails, Driver, Schedule, TransportSchedule)
│           │                      components (VehicleForm, DriverForm, OffDayForm, TransportScheduleForm)
│           │                      hooks (useVehicles, useDrivers, useOffDays, useTransportSchedule, useVehicleDriverAssignment)
│           │                      utils (vehicleUtils, scheduleUtils)
│           ├── slips/             hooks (useDutySlips)  utils (dutySlipUtils, pdf/*)
│           ├── mileage/           pages (MyMileagePage)  components (MileageEntryForm)  hooks  utils
│           └── conflicts/         pages (ConflictsPage)  utils (conflictUtils)      ← unchanged, deferred
├── backend/        README.md only (placeholder for the Node/Express/MySQL work)
├── docs/           FRD, backend plans, this plan
├── .github/        workflows/frontend-ci.yml, pull_request_template.md
├── .editorconfig  .gitignore  README.md
```

---

## Steps

### Step 0 — Baseline
- Clone, `npm ci`, run `npm run build` and `npm run lint` and record the result (both pass today).
- Write a browser smoke script that seeds `localStorage` and visits **every route as every role** (Applicant, Department Head, Transport In-Charge, Transport Administrator, Super Admin), recording console errors. This script is the safety net for every later step.
- **Done when:** baseline results are recorded; smoke script runs clean.

### Step 1 — Repository layout
1. Move every root file and folder (`src`, `public`, `index.html`, `package*.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`) into `frontend/` with `git mv`.
2. Add root `README.md` (project overview, folder map, how to run both parts, roles and demo accounts), root `.gitignore` and `.editorconfig`; keep a `frontend/.gitignore` for build output.
3. Add `backend/README.md` (placeholder) and `docs/` (FRD and the two backend plans).
4. Add `frontend/.nvmrc`, `frontend/.env.example` (`VITE_API_BASE_URL`), rename the package to `sust-transit-frontend`.
5. Replace the Vite-template `README` with a real `frontend/README.md`.
- **Done when:** `cd frontend && npm ci && npm run build` works; `git log --follow` on a moved file shows its history.

### Step 2 — Delete dead code
Remove files that nothing imports (each confirmed with a search **and** `knip`):

| File | Why |
|---|---|
| `components/Welcome.tsx`, `assets/hero.png`, `assets/vite.svg`, `assets/react.svg` (if unused), `public/icons.svg` | Vite template leftovers |
| `components/application/StepIndicator.tsx` | wizard removed earlier |
| `types/slip.ts` | duplicate of `types/dutySlip.ts` |
| `data/storage.ts`, `data/vehicles.ts` | unused helpers and unused seed |
| `components/DriverDetails.tsx`, `components/VehicleDetails.tsx` | not imported by any page |

Also remove unused exports reported by `knip`. The conflict files are **not** touched.
- **Done when:** build and lint pass; `knip` reports no unused files.

### Step 3 — Duplicates and naming
1. Merge the two `StatusBadge` components: the vehicle and driver status badges become `VehicleStatusBadge` and `DriverStatusBadge` inside `ui/StatusBadge.tsx`, with their colours in `badgeTones.ts`; delete the old files.
2. Two `Conflict` types exist (`types/conflict.ts` and `utils/conflictUtils.ts`): keep the one the code uses, delete the other. (Detection logic is not changed.)
3. Put every storage key in `storageKeys.ts` (including the off-days key and the pending-email key, which is currently defined twice). The key **values** do not change.
4. Rename `useDriver` → `useDrivers` (returning `drivers`, not `driver`) and the `routes` returned by `useTransportSchedule` → `schedules`. Update every usage.
5. Naming rules: component files `PascalCase.tsx`, hooks `useX.ts`, utilities `camelCase.ts`, constants `UPPER_SNAKE`; components and pages use default exports, everything else uses named exports.
- **Done when:** build, lint and smoke pass; searching for the old names returns nothing.

### Step 4 — Formatting and tooling (before any move, so moves stay clean)
1. Add Prettier (`.prettierrc`: double quotes, semicolons, trailing commas, 100 columns, plus `.prettierignore`) and format the whole frontend **in its own commit**.
2. `package.json` scripts: add `typecheck`, `format`, `format:check`, `lint:fix`.
3. `tsconfig.app.json`: set `"strict": true` explicitly and add `baseUrl`/`paths` for `@/*` → `src/*`; add the same alias to `vite.config.ts`.
4. Add Vitest and small unit tests for the pure utilities (permissions, requisition status, vehicle eligibility / time overlap, route parsing, mileage eligibility).
5. Add `.github/workflows/frontend-ci.yml` (install, format check, lint, typecheck, test, build; working directory `frontend`) and a pull-request template.
- **Done when:** `npm run format:check`, `typecheck`, `lint`, `test`, `build` all pass.

### Step 5 — Feature folders and the `@/` alias
1. Move each file to its new place (table below) using a script that also **rewrites every import** to the `@/…` form (this removes all the `../../..` paths).
2. Imports of assets (`?inline`, images) and CSS keep working; `index.html` still points at `/src/main.tsx`.
3. Do the move in feature batches and run the build after each batch: `shared` → `app` → `auth/users/landing` → `notifications/dashboard` → `fleet` → `requisitions` → `slips/mileage/conflicts`.

| Current location | New location |
|---|---|
| `router.tsx`, `layout/*` | `app/router.tsx`, `app/layout/*` |
| `components/ApplicantHeader.tsx` | `app/layout/ApplicantHeader.tsx` |
| `components/ui/*`, `DataTable`, `Modal`, `StatCard`, `SustLogo` | `shared/ui/*` |
| `hooks/useLocalStorageCollection.ts` | `shared/hooks/` |
| `data/storageKeys.ts`, `data/sustDirectory.ts` | `shared/config/` |
| `utils/permissions.ts`, `utils/validators.ts` | `shared/utils/` |
| `pages/auth/*`, `AuthShell`, `OtpInput`, `SignatureUpload`, `ProfileField`, `RequireAuth`, `LogoutButton`, `useAuth`, `useOtp`, `authUtils`, `passwordUtils` | `features/auth/…` |
| `UsersPage`, `ProfilePage`, `useUsers` | `features/users/…` |
| `LandingPage` | `features/landing/pages/` |
| `DashboardPage`, `ApplicantDashboardPage` | `features/dashboard/pages/` |
| `NotificationBell`, `NotificationsPage`, `useNotifications`, `notificationUtils` | `features/notifications/…` |
| `ApplyRequisitionPage`, `MyRequisitionsPage`, `RequisitionsPage`, `pages/recommender/*`, `RequisitionForm`, `RequisitionDetail`, `ApplicantRequisitionDetail`, `AllocationPicker`, `components/application/*`, `components/recommender/*`, `useRequisitions`, `useAllocations`, `requisitionUtils`, `routeUtils`, `allocationUtils` | `features/requisitions/…` |
| `VehiclePage`, `VehicleDetailsPage`, `DriverPage`, `SchedulePage`, `TransportSchedulePage`, `VehicleForm`, `DriverForm`, `OffDayForm`, `TransportScheduleForm`, `useVehicles`, `useDrivers`, `useOffDays`, `useTransportSchedule`, `useVehicleDriverAssignment`, `vehicleUtils`, `scheduleUtils` | `features/fleet/…` |
| `useDutySlips`, `dutySlipUtils`, `utils/pdf/*` | `features/slips/…` |
| `MyMileagePage`, `MileageEntryForm`, `useMileageEntries`, `mileageUtils` | `features/mileage/…` |
| `ConflictsPage`, `conflictUtils` | `features/conflicts/…` (unchanged) |
| `types/*` | stay in `src/types/` |

- **Done when:** no `../` imports remain; build, lint, tests and smoke pass; `git log --follow` works on moved files.

### Step 6 — Split oversized files
Break up the files that mix many jobs. Pure extraction: same props, same markup, same behaviour.

| File (lines) | Split into |
|---|---|
| `RequisitionDetail.tsx` (846) | `TripCard`, `SendBackForm`, `DocumentsSection`, the Transport In-Charge and Administrator action bars |
| `UsersPage.tsx` (621) | `UsersTable`, `CreateUserForm`, `EditUserForm` |
| `RequisitionsPage.tsx` (596) | `RequisitionsTable` and a `useRequisitionActions` hook for the handlers |
| `DashboardPage.tsx` (483) | one component per dashboard section |
| `ProfileSetupPage.tsx` (470) | field groups per profile type |
| `RequisitionForm.tsx` (481) | form-level validation moved to a helper |
- Target: no component file above about 400 lines.
- **Done when:** build, lint and smoke pass; the screens look identical (screenshot comparison on the main pages).

### Step 7 — Repeated styles
- The admin forms (`VehicleForm`, `DriverForm`, `OffDayForm`, `TransportScheduleForm`, `MileageEntryForm`) repeat long Tailwind class strings. Move the repeated ones to shared constants in `shared/ui/formStyles.ts`, the same idea as the application form's `formTheme.ts`.
- **Done when:** no visual change; the duplicated strings are gone.

### Step 8 — Comment cleanup
- About 150 comments carry project-history labels (`Phase 6`, `Step 8`, `Fix 4`, `§22`, "per FRD §…"). Remove the labels; keep a comment only when it explains **why** the code is written that way, and delete comments that only describe history.
- **Done when:** a search for `Phase [0-9]`, `Step [0-9]`, `Fix [0-9]` in `src` returns nothing; build and lint pass.

### Step 9 — Final verification
1. `format:check`, `typecheck`, `lint`, `test`, `build` all green.
2. Smoke script across all routes and roles: no console errors; compare screenshots against Step 0.
3. Confirm storage keys are unchanged (existing browser data still loads).

### Step 10 — Patch and handover
1. Produce the patch with `git format-patch` (one patch per step, so each step can be reviewed or applied alone) plus a combined single-file patch.
2. Verify the patch applies on a fresh clone of `main` with `git am`.
3. Provide the apply commands and a fallback archive of the final tree.
4. List the stale branches to delete: `admin`, `core-and-auth`, `requisition-workflow`, `dashboards-and-deploy`.

---

## Delivery

- **Patch file(s):** sent as files, not pasted into chat (a long pasted patch breaks easily).
- **Apply on your computer** from the repo root, on a fresh branch:
  ```
  git checkout main
  git pull
  git checkout -b frontend-cleanup
  git am path/to/frontend-cleanup.patch
  ```
- If `git am` stops, `git am --abort` and use the fallback archive.
- Review, then push the branch and open a pull request.

## Order summary

`0 baseline → 1 layout → 2 dead code → 3 duplicates → 4 formatting/tooling → 5 feature folders → 6 split files → 7 styles → 8 comments → 9 verify → 10 patch`
