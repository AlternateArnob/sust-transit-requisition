# SUST Transit Requisition — Backend Step-by-Step Implementation Plan

**Part 2 of 2.** Part 1 is `BACKEND_IMPLEMENTATION_PLAN.md` (the design: rules, schema, API, notifications). **This document is the build order.** Do the steps in sequence. Do not start a step until the previous step's "Done when" checks pass.

**Stack:** Node.js 20 · TypeScript · Express · MySQL 8 · Knex · Zod · Vitest + Supertest
**Where to build:** a new `server/` folder at the root of the repo `Ishtiak2/sust-transit-requisition` (branch `application-module`), next to the existing React frontend.

---

## How to use this plan (instructions for the implementing AI)

1. **Read Part 1 first.** Every step below cites sections of Part 1 as `§n` (for example `§11.6`). Those sections are the specification; this file only says *what to do and in what order*. If this file and Part 1 disagree, **Part 1 wins** — then tell the product owner.
2. **One step at a time.** Finish a step completely (code + tests + checks) before the next. Commit after each step with the message `Step N: <title>`.
3. **Port, don't reinvent.** The frontend's pure helper functions in `src/utils/*.ts` are already correct. For the domain logic, copy them into `server/src/domain/` and adapt only the types/imports. The files to port are named in each step.
4. **Every step has the same four parts:** *Goal*, *Build* (files and tasks), *Tests*, *Done when* (a checklist you can verify by running commands).
5. **Never trust the client.** Status, role, requester id, application number and permissions always come from the server (Part 1 §1, §7.6, §9).
6. **Keep a running log** in `server/docs/PROGRESS.md`: step number, date, what was done, anything deviating from Part 1 and why.
7. **If something is unclear, stop and ask** — do not guess on rules in Part 1 §20 ("decisions needed"); use the recommended default listed there and note it in `PROGRESS.md`.
8. **Quality gate for every step:** `npm run lint`, `npm run typecheck` and `npm test` all pass before you commit.

### Step overview

| Phase | Steps | Result |
|---|---|---|
| A. Foundation | 0 – 3 | Running Express + MySQL server, errors, validation, all migrations |
| B. Identity | 4 – 7 | Register, OTP, login, tokens, RBAC, profile, users admin |
| C. Reference data and fleet | 8 – 10 | Directory, drivers, vehicles, off-days, student-transport schedule |
| D. Requisition core | 11 – 15 | Create/submit, recommender, allocation, forward, approvals, send-back/resubmit |
| E. After approval | 16 – 18 | Slips, completion, mileage, allocation guards |
| F. Supporting features | 19 – 21 | Notifications, dashboards, files, audit |
| G. Integration and release | 22 – 25 | OpenAPI, frontend cut-over, hardening, deployment |

Estimated size: ~26 small steps. Each is meant to be a half-day to one day of focused work.

---

# PHASE A — Foundation

## Step 0 — Repository, tooling and local environment

**Goal:** an empty but fully wired `server/` project that installs, lints, type-checks, runs tests and connects to a local MySQL.

**Build**
1. Create `server/` with `package.json` (`"type": "module"`), `tsconfig.json` (strict, `"module": "NodeNext"`, `outDir: dist`), `.gitignore` (node_modules, dist, uploads, `.env`).
2. Install runtime deps: `express`, `mysql2`, `knex`, `zod`, `dotenv`, `helmet`, `cors`, `cookie-parser`, `express-rate-limit`, `hpp`, `pino`, `pino-http`, `jsonwebtoken`, `argon2` (or `bcryptjs`), `nodemailer`, `multer`, `node-cron`, `uuid`.
3. Install dev deps: `typescript`, `tsx`, `vitest`, `supertest`, `@types/*`, `eslint`, `@typescript-eslint/*`, `prettier`.
4. Scripts in `package.json`: `dev` (`tsx watch src/server.ts`), `build` (`tsc`), `start` (`node dist/server.js`), `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `migrate` (`knex migrate:latest`), `migrate:rollback`, `seed` (`knex seed:run`), `db:reset` (rollback all → migrate → seed, **development only**).
5. `docker-compose.yml` with `mysql:8.0` (database `sust_transit`, a second database `sust_transit_test`, `--character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci`, `--default-time-zone=+00:00`) and optionally `mailhog` (SMTP 1025, web UI 8025).
6. `.env.example` with **every** variable from §6. Copy to `.env` locally.
7. Create the folder skeleton from §5 (empty files are fine).
8. `server/README.md`: how to run (`docker compose up -d`, `npm install`, `npm run migrate`, `npm run seed`, `npm run dev`).
9. `docs/PROGRESS.md` (empty log).
10. A GitHub Actions workflow `.github/workflows/server-ci.yml`: Node 20, MySQL 8 service, install, lint, typecheck, test.

**Tests:** a trivial Vitest test that passes (`1 + 1 === 2`) so CI is green.

**Done when**
- [ ] `docker compose up -d` starts MySQL; you can connect with the credentials in `.env`.
- [ ] `npm run lint`, `npm run typecheck`, `npm test` all succeed on a fresh clone.
- [ ] CI is green on a pushed branch.

---

## Step 1 — Config, app shell, errors, validation, logging

**Goal:** an Express app that boots only with valid config, answers `/api/v1/health`, and returns uniform errors.

**Build**
1. `src/config/env.ts`: Zod schema for every variable in §6, parsed once; export a typed `env`. Booleans parse from `"true"/"false"`. The process must **exit with a clear message** when validation fails. In `production`, additionally require `OTP_DEV_ECHO=false`, `COOKIE_SECURE=true` and a `JWT_ACCESS_SECRET` of ≥ 32 chars.
2. `src/config/constants.ts`: all enums from §11.1 as `as const` arrays + derived TS types (`RequisitionType`, `ApplicationStatus`, `TripStatus`, `RejectionReason`, `Weekday`, vehicle categories/statuses, driver designations, roles). These are imported by Zod schemas, services and tests — **one source of truth**.
3. `src/errors/AppError.ts`: `class AppError extends Error { status; code; details? }` plus helper factories (`notFound()`, `forbidden()`, `conflict(code,msg)`, `invalidState(msg)`, `validation(details)`).
4. `src/middleware/`:
   - `requestId.ts` (read/generate `X-Request-Id`, attach to `req` and response header).
   - `validate.ts`: `validate({ body?, params?, query? })` using Zod; on failure throw `AppError(422,'VALIDATION_ERROR', …, details:[{path,message}])`. Use `.strict()` on body schemas (§7.1).
   - `errorHandler.ts`: converts `AppError`, Zod errors, MySQL errors (duplicate key `ER_DUP_ENTRY` → `409 CONFLICT`), body-parser errors (`400 BAD_REQUEST`) and unknown errors (`500 INTERNAL_ERROR`, message generic, full error logged) into the format in §7.4 including `requestId`.
   - `notFound.ts` → `404 NOT_FOUND`.
   - `rateLimit.ts`: exports a global limiter and a factory for stricter limiters (used in Step 4).
5. `src/app.ts`: builds the app — `helmet`, `cors({ origin: env.CLIENT_ORIGIN list, credentials: true })`, `express.json({ limit: '100kb' })`, `cookie-parser`, `hpp`, pino-http, request id, global rate limit, router mounted at `env.API_BASE_PATH`, `notFound`, `errorHandler`. **No `listen` here** (tests import `app`).
6. `src/server.ts`: `listen`, graceful shutdown on `SIGTERM/SIGINT` (stop accepting, close DB pool).
7. `GET /health` → `{ status: 'ok', db: 'up'|'down', time }` (runs `SELECT 1`; `db:'down'` returns 503). `GET /version`.

**Tests**
- env parsing: valid, missing var, production safety rules.
- `GET /health` 200; unknown route → 404 in the §7.4 format; invalid JSON body → 400; a route using `validate` returns 422 with `details`.

**Done when**
- [ ] `npm run dev` starts; `curl localhost:4000/api/v1/health` shows `db: "up"`.
- [ ] Starting with a bad `.env` aborts with a readable message.
- [ ] Every error path returns the uniform JSON with a `requestId`.

---

## Step 2 — Database layer and migrations (all tables)

**Goal:** the complete schema from §10.2 exists, created by Knex migrations, with transaction helpers.

**Build**
1. `knexfile.ts` (client `mysql2`, pool from env, `timezone: 'Z'`, `dateStrings: true` so `DATE`/`TIME` come back as plain strings, migrations dir `migrations/`, seeds dir `seeds/`).
2. `src/db/knex.ts` (single instance), `src/db/transaction.ts` → `withTransaction<T>(fn:(trx)=>Promise<T>)`.
3. Migrations, **in this dependency order** (use `knex.schema.raw` for MySQL-specific parts: `CHECK`, `JSON`, `ENUM`, generated defaults):
   - `001_directory_and_files.ts` — `directory_units`, `files` (create `files` first because `users` references it).
   - `002_users_and_auth.ts` — `users`, `otp_challenges`, `refresh_tokens`.
   - `003_fleet.ts` — `drivers`, `vehicles`, `vehicle_off_days`, `student_transport_vehicles`, `student_transport_slots`.
   - `004_requisitions.ts` — `requisition_counters`, `requisitions`, `trips`.
   - `005_allocations_slips_mileage.ts` — `allocations`, `allocation_history`, `duty_slips`, `duty_slip_trips`, `confirmation_slips`, `mileage_entries`.
   - `006_notifications_and_audit.ts` — `notifications`, `audit_logs`.
4. Copy the DDL from §10.2 **exactly** (column names, `ENUM` values, unique keys, indexes, foreign keys, `CHECK` constraints). Remember: there is **no `reserved_for` column** anywhere.
5. Every migration has a working `down` that drops what `up` created, in reverse order.
6. Test helper `tests/helpers/db.ts`: connects to `sust_transit_test`, runs `migrate.latest()` once per test run, and `truncateAll()` (disable FK checks → truncate every table → enable) between tests.

**Tests**
- Migrate up → down → up succeeds.
- Constraint tests: duplicate `users.email`, duplicate `vehicles.registration_number` (case-insensitive), two allocations for one `trip_id`, off-day row violating `ck_offday_shape`, trip with `end_time < start_time`, `mileage distance_km <= 0` all fail at the DB level.

**Done when**
- [ ] `npm run migrate` on an empty database creates all 20 tables; `npm run migrate:rollback --all` removes them.
- [ ] The constraint tests pass.

---

## Step 3 — Domain layer (pure logic ported from the frontend)

**Goal:** all business rules that do not need a database exist as pure, unit-tested functions. Later steps just call them.

**Build** in `src/domain/` (copy logic from the frontend files in brackets; adapt types only):
1. `permissions.ts` — role predicates and capability helpers [`src/utils/permissions.ts`]: `isAdminRole`, `isTransportInCharge`, `isTransportAdministrator`, `isSuperAdmin`, `canManageVehicles`, `canAssignVehicleAndForward`, `canSendBackToApplicant`, `canSendBackToTransportInCharge`, `canMarkTripCompleted`, `canRecordMileage`, `canManageUserAccounts`, `isOperationsViewOnly`. Add `canDownloadDriverSlip(role)` = TIC or TA, and `canGenerateDutySlip(role)` = TA.
2. `recommendation.ts` — `requiresRecommendation(profile, type, role)` [`authUtils.ts`, §11.3]; `isSustEmail` and `SUST_EMAIL_DOMAINS`; `departmentScopeMatches(requisitionDepartment, head)` [§11.11].
3. `requisitionStatus.ts` — `computeApplicationStatus(trips, current)`, `isInTransportInChargeQueue`, **`isInTransportAdministratorQueue` using the stricter rule of §11.5** (Partially Approved only while a trip is still Pending), `isInActiveQueue`, `canGenerateSlips(requisition)` [`requisitionUtils.ts`, `dutySlipUtils.ts`], plus the **allowed-transition table of §11.2** as data: `assertTransition(action, fromStatus)` that throws `AppError 409 INVALID_STATE`.
4. `validators.ts` — `isWithinHoldWindow` (3 h) [`validators.ts`], `parseRoute`, `isValidRoute`, `buildTripFromInput(requisitionType, tripInput)` that returns `{ route, stoppageSequence }` per §11.10 (Personal → `["Campus", destination, "Campus"]`, route text `Campus to X and Return to Campus`; others parse `routeText`, join with ` → `) [`routeUtils.ts`, `RequisitionForm.buildTrip`].
5. `schedule.ts` — `getWeekdayFromDate` (parse `YYYY-MM-DD` as a **local calendar date**, `Sun=0`), `getOffDayForVehicleOnDate`, `getStudentTransportTimeForDate`, `isVehicleFreeAtTime`, `toMinutes` [`scheduleUtils.ts`].
6. `vehicleEligibility.ts` — `timeRangesOverlap` (strict), `getVehicleEligibility(vehicle, trip, ctx)` returning `{eligible, blockers[], warnings[]}` with the five blockers and one warning of §11.6; `getTripsMissingVehicleAssignment`, `canForwardToAdministrator` [`allocationUtils.ts`, `vehicleUtils.ts`].
7. `allocationGuards.ts` — the off-day, student-transport and vehicle-status guards of §11.9 [`fleet/utils/allocationGuards.ts`].
8. `mileage.ts` — `isMileageEligibleRequisition` (Personal + Teacher/Officer), `getMileageColumnStatus` [`mileageUtils.ts`].
9. `applicationNumber.ts` — `formatApplicationNumber(year, n)` → `TRS-2026-001`.
10. `slips.ts` — `getEligibleDutySlipGroups(requisition, allocations)` (only `Approved` trips with an allocation + driver, grouped by driver, sorted by date), `isDutySlipStale`.

**Tests (Vitest, no database)** — write tests for **each** function using the cases in §18.2 items 3, 6, 8, 10, 11 as a guide. Mandatory cases:
- back-to-back trips `09:00–11:00` and `11:00–13:00` do **not** overlap; `10:00–12:00` does.
- `computeApplicationStatus`: all approved, all rejected, mixed, none decided.
- Administrator queue: `Partially Approved` with a Pending trip → in queue; with none → out.
- `requiresRecommendation` for all combinations (Student/Teacher/Officer × 3 types × DepartmentHead role).
- 3-hour rule: exactly 3 h OK, 3 h 1 min fails, end before start fails.
- Personal route building; route text with each separator (`->`, `→`, `=>`, `>`, newline); a single stop is invalid.
- Eligibility: each blocker individually + warning for category mismatch only.
- Allocation guards: each rule blocks correctly; past allocations never block.
- Weekday of `2026-10-22` is Thursday.

**Done when**
- [ ] `npm test` runs ≥ 60 domain tests, all green; no domain file imports Express, Knex or `process.env`.

---

# PHASE B — Identity

## Step 4 — Passwords, OTP, email and tokens (services)

**Goal:** the security building blocks exist and are tested, before any route uses them.

**Build**
1. `services/password.ts`: `hashPassword`, `verifyPassword` (argon2id or bcrypt cost from env), `assertPasswordPolicy(pw)` (min length from env).
2. `services/otp.ts` per §8.2: `generateCode()` with `crypto.randomInt`; `issueOtp(email, purpose)` (replaces any existing row, stores a **hash**, expiry 10 min, `attempts=0`, enforces the 60 s resend cooldown and max 5 sends/hour/email); `verifyOtp(email, code)` returning the four failure reasons of §8.2 and incrementing `attempts`; deletes the challenge on success.
3. `services/mailer.ts`: Nodemailer transport from env; `sendOtpEmail(email, code)`. In `development` also log the code to the console.
4. `services/tokens.ts` per §8.4:
   - `signAccessToken({sub, role, scope})` (15 min), `verifyAccessToken`.
   - `createRefreshToken(userId, meta)` → random 256-bit, store **SHA-256 hash**, `family_id`; `rotateRefreshToken(rawToken)` → revoke old, issue new in same family; **reuse of a revoked token revokes the whole family** (§8.4); `revokeAllForUser(userId)`; `revokeByToken`.
   - cookie helpers (`httpOnly`, `secure`, `sameSite`, path `${API_BASE_PATH}/auth`).
5. `middleware/auth.ts`:
   - `authenticate({ allowOnboarding?: boolean })` — reads Bearer token, verifies, **loads the user from the DB every request** (a 30-second in-memory cache is acceptable), rejects `401 UNAUTHENTICATED` if missing/expired, `403 ACCOUNT_DEACTIVATED` if `is_active=0`; uses the **DB role**, not the token's role; rejects `scope:"onboarding"` tokens unless `allowOnboarding` (§8.4).
   - `requireRole(...roles)` → `403 FORBIDDEN`.
   - Attach `req.user` (typed).
6. Rate limiters in `middleware/rateLimit.ts`: `loginLimiter` (10 per 15 min per IP+email), `registerLimiter`, `otpLimiter`.

**Tests**
- Password hash/verify; policy.
- OTP: correct code, wrong code increments, 5 wrong → `attempts-exceeded`, expired, replaced by new request, cooldown, hourly cap; stored value is not the plain code.
- Tokens: expired access token rejected; refresh rotation works; **reusing an old refresh token revokes the family**; deactivated user rejected on the next request; onboarding token rejected on a full-scope route.
- Mail: with a stubbed transport, the OTP email is "sent".

**Done when**
- [ ] All service tests pass; no plaintext OTP or token is ever stored (check in a test by reading the DB rows).

---

## Step 5 — Auth endpoints (register, OTP, login, refresh, logout, me)

**Goal:** the complete login journey of §8.3 and §12.1.

**Build** `src/modules/auth/` (routes, controller, service, Zod schemas):
1. `POST /auth/register` — domain check (`isSustEmail`, else `422 EMAIL_DOMAIN_NOT_ALLOWED`), verified duplicate → `409 EMAIL_TAKEN`, unverified existing user → reuse + resend; create `users(role='Applicant', is_verified=0)`; issue OTP; respond `202 { email, otpExpiresAt, resendAvailableAt, devCode? }` (`devCode` only if `OTP_DEV_ECHO`).
2. `POST /auth/otp/verify` — body `{email, code}`; on success set `is_verified=1`, return `{ onboardingToken, user }`. Error codes per §8.2.
3. `POST /auth/otp/resend` — respects cooldown (`429 RATE_LIMITED` with `retryAfterSeconds` in details).
4. `POST /auth/login` — implement **all** branches of §8.3 in this order: find user (generic `401 INVALID_CREDENTIALS` if none) → lockout check → deactivated (`403 ACCOUNT_DEACTIVATED`) → unverified (issue OTP, return `200 { onboardingToken, nextStep:"otp", user }`) → no password (`nextStep:"profile-setup"`) → verify password (increment `failed_login_count`, lock for 15 min after 5 failures; reset on success) → issue access token + refresh cookie, update `last_login_at`, return `{ accessToken, expiresIn, user }`.
5. `POST /auth/refresh` — reads cookie, requires header `X-Requested-With: fetch`, rotates, returns a new access token (+ user).
6. `POST /auth/logout` — revokes the refresh token, clears cookie, `204`.
7. `GET /auth/me` — returns `PublicUser` (+ `nextStep` when onboarding incomplete). Build the `PublicUser` mapper once (`toPublicUser`) and reuse it everywhere; **never** include hashes.
8. Apply `loginLimiter` / `registerLimiter` / `otpLimiter`.

**Tests (integration)**
- Full happy path: register → verify → (profile in Step 6) → login.
- Bad domain; duplicate verified email; re-register unverified resends; OTP errors; login wrong password and unknown email return an **identical** error body; lockout after 5 failures; deactivated; unverified returns an onboarding token that is rejected by `GET /requisitions/mine` (route exists later — for now assert on a stub protected route); refresh rotation via cookie; logout invalidates the refresh token.

**Done when**
- [ ] The auth flow works end to end with Postman/curl and in tests; rate limits trigger; `OTP_DEV_ECHO=false` removes `devCode`.

---

## Step 6 — Directory, profile, signature, password change

**Goal:** applicants can complete onboarding and edit their profile (§12.2, §12.3).

**Build**
1. `modules/directory/`: `GET /directory/departments`, `GET /directory/offices` (public, sorted names). Seed data comes in this step (see item 5).
2. `modules/users/profile`: `GET /me`, `PUT /me/profile`, `POST /me/signature`, `PUT /me/password`.
3. `PUT /me/profile` validation exactly as §12.3: fullName + mobile required; per profile — Student: department + `studentRegNumber`; Teacher: department + designation; Officer: office + designation; department/office must exist in `directory_units` with the right `kind`; password required only when the account has none yet; signature must exist to finish onboarding. Non-applicant roles can only change `fullName`/`mobile`.
4. `POST /me/signature`: multipart via `multer` (disk storage in `UPLOAD_DIR`, random file name), magic-byte check (PNG/JPEG), ≤ `MAX_SIGNATURE_BYTES`; insert `files` row, set `users.signature_file_id`, delete the old file. Also accept the transitional JSON `{ signatureDataUrl }` (§14).
5. `seeds/01_directory_units.ts`: read the departments and offices from the frontend's `src/data/sustDirectory.ts` (copy the arrays into the seed; keep spelling exact). `seeds/02_admin_accounts.ts`: the three seeded accounts of §16 with the password from `SEED_ADMIN_PASSWORD`.
6. `GET /files/:id` (basic version: owner only for now; extended in Step 21).
7. Allow `scope:"onboarding"` tokens on `GET /auth/me`, `PUT /me/profile`, `POST /me/signature`, `POST /auth/logout`, OTP routes only.

**Tests**
- Onboarding completes only when profile fields + signature + password are valid; each profile type's required fields; unknown department → 422; image spoofing (a `.png` that is really text) → 422; oversize → 413/422; password change requires the current password.
- Seeded accounts can log in.

**Done when**
- [ ] A brand-new applicant can register → verify → complete profile → log in, in an automated integration test.

---

## Step 7 — Super Admin user management

**Goal:** `/users` CRUD with every guard of §12.4.

**Build** `modules/users/admin`:
1. `GET /users` (SuperAdmin; filters `role`, `isActive`, `q`; paginated).
2. `POST /users` — creates `TransportInCharge | TransportAdministrator | SuperAdmin` accounts, verified + active, no OTP; email unique; password policy.
3. `PATCH /users/:id` — guards: unique email; **cannot change own role/active** (`403`); **cannot demote/deactivate the last active SuperAdmin** (`409`); `DepartmentHead` requires `headOfDepartment` or `headOfOffice` (validated against the directory); on role/active change create the `Account Status Changed` notification (message per §12.4) — implement `services/notify.ts` here (minimal: `notifyUser(trx, {...})`; expanded in Step 19); **deactivation revokes all refresh tokens**; write audit via `services/audit.ts` (implement the `audit.log(trx, {...})` helper now; the `GET /audit-logs` endpoint comes in Step 21).
4. `DELETE /users/:id` — only another `SuperAdmin`; refuse if the user owns requisitions.

**Tests**
- Every guard above; a non-SuperAdmin gets 403 on every route; deactivated user's existing access token stops working on the very next request; audit rows are written with before/after.

**Done when**
- [ ] The Super Admin journey of §21 item 7 works; guards covered by tests.

---

# PHASE C — Reference data and fleet

## Step 8 — Drivers

**Goal:** driver CRUD (§12.6).

**Build** `modules/drivers/` — `GET/POST/PATCH/DELETE /drivers`, `POST /drivers/:id/activate|deactivate`. Permissions: TIC, TA, SuperAdmin (`canManageDrivers`); reads allowed for those three roles. The driver DTO's `permanentVehicleId` is **computed** by joining `vehicles.permanent_driver_id`. Deactivate → `status='Inactive'` and `UPDATE vehicles SET permanent_driver_id=NULL WHERE permanent_driver_id=?` in one transaction. Delete is refused (`409`) if referenced by any allocation, duty slip, or vehicle.

**Tests:** CRUD; role checks; deactivation clears the vehicle link (after Step 9 adds vehicles — write this assertion now as `it.todo` and enable it in Step 9); delete blocked when referenced.

**Done when**
- [ ] Driver module tests green.

---

## Step 9 — Vehicles

**Goal:** vehicle CRUD with the driver-assignment rules (§12.5).

**Build** `modules/vehicles/`:
1. DTO `{ id, registrationNumber, category, fuelType?, operationalStatus, availableForRequisition, permanentDriverId? }` — **no `reservedFor`**.
2. `POST/PATCH`: registration trimmed + **upper-cased**, unique case-insensitively → `409 DUPLICATE_REGISTRATION`; enums validated against `constants.ts`.
3. Permanent driver assignment service (port of `useVehicleDriverAssignment`): driver exists, `Active`, not the permanent driver of **another** vehicle (`409`); moving the assignment is atomic; `permanentDriverId: null` clears it.
4. `DELETE`: refuse with `409 VEHICLE_HAS_HISTORY` if any `allocations` **or** `allocation_history` row references it (§10.3, §12.5).
5. `GET /vehicles` (filters `q`, `category`, `status`), `GET /vehicles/:id` (+ driver summary).
6. On update of `operationalStatus` / `availableForRequisition` to an unavailable state, call `allocationGuardService.assertVehicleCanBecomeUnavailable(vehicleId)` — stub it now (no-op); implemented in Step 18.

**Tests:** duplicate registration with different casing; invalid category; driver already assigned elsewhere; inactive driver rejected; reassigning frees the old driver; delete blocked once an allocation/history row exists (insert one directly in the test DB); the `it.todo` from Step 8.

**Done when**
- [ ] Vehicle module tests green; seed script optionally loads the demo fleet (§16.3).

---

## Step 10 — Off-days and student-transport schedule

**Goal:** the two schedule inputs the allocation rules depend on (§12.11, §12.12).

**Build**
1. `modules/offDays/`: `GET /off-days`, `POST`, `PATCH`, `DELETE`. Validate the shape rule (One-time ⇒ `date`, no weekday; Recurring ⇒ `weekday`, no date) in Zod **and** rely on the DB `CHECK`. Vehicle must exist.
2. `modules/transportSchedule/`: `GET /transport-schedule`, `PUT /transport-schedule/:vehicleId` (create-or-replace in a transaction: upsert `student_transport_vehicles`, delete + insert `student_transport_slots` for the weekdays supplied with valid `HH:mm`), `DELETE`. DTO `{ id, vehicleId, schedule: { Sun?: "HH:mm", … } }`.
3. `GET /schedule/lookup?date=YYYY-MM-DD` (§12.12) combining vehicles, off-days, student-transport free-after and allocations (allocations table exists but is empty until Step 13 — query must already work).
4. Call `allocationGuardService.assertOffDayAllowed(...)` before saving (still a stub).

**Tests:** both off-day types; invalid shape combinations → 422; schedule replace semantics (removing a weekday removes its slot); `lookup` for a date that is a recurring off-day.

**Done when**
- [ ] Phase C complete: a Transport Office user can maintain drivers, vehicles, off-days and the student-transport schedule entirely through the API.

---

# PHASE D — Requisition core

## Step 11 — Create, draft, submit (applicant side)

**Goal:** applicants and Department Heads can create and submit requisitions (§12.7, §10.4, §11.3).

**Build** `modules/requisitions/`:
1. `services/applicationNumber`: the atomic counter of §10.4 (`INSERT … ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number+1)`), year in `Asia/Dhaka`. `GET /requisitions/next-number` preview.
2. Zod schema for the create body of §12.7 (`mode`, `requisitionType`, `purpose`, `declarationConfirmed`, `transportUser?`, `trips[]`).
3. `POST /requisitions` (roles Applicant, DepartmentHead):
   - requester = `req.user` (ignore any id in the body);
   - profile-complete check on submit (`409 PROFILE_INCOMPLETE`);
   - `mode:"draft"` → status `Draft`, minimal validation, persist trips if given;
   - `mode:"submit"` → full validation of §12.7 step 4 using the domain functions (`buildTripFromInput`, `isWithinHoldWindow`, Personal = exactly one trip), generate the number, snapshot requester fields (`department = user.department ?? user.office`), compute `startDate = endDate = first trip date`, compute the initial status via `requiresRecommendation` (§11.3), insert requisition + trips **in one transaction**; support the optional `Idempotency-Key` header (SHOULD, §7.5).
4. `GET /requisitions/mine`, `GET /requisitions/:id` (ownership/scope/role rules of §12.7), `PUT /requisitions/:id` (Draft only), `POST /requisitions/:id/submit` (Draft → routed status), `DELETE /requisitions/:id` (own Draft only).
5. Requisition DTO mapper `toRequisitionDto(row, trips, viewer)` implementing the shape of §12.7, **including the visibility rule for `allocation`** (only for admin roles; for the owner only when the trip is Approved/Completed).
6. `POST /requisitions/:id/supporting-document` (multipart, ≤ 5 MB, PDF/PNG/JPEG, magic bytes) — stores a `files` row; DTO exposes `supportingDocumentName` + `supportingDocumentUrl`.
7. Notifications for submit (§13 rows 1–2): resolve recipients via helpers `findDepartmentHeadsForRequisition`, `findTransportInCharge` (active + verified) in `services/notify.ts`; if no head matches, notify all SuperAdmins with type `Configuration` (§11.11).
8. Audit `requisition.created`, `requisition.submitted`.

**Tests**
- Statuses: Teacher + Official → `Pending Recommendation`; Teacher + Personal → `Pending on Transport Office`; DepartmentHead + Official → `Pending on Transport Office`.
- Validation: Personal with 2 trips; 3 h 01 min trip; one-stop route; missing declaration; missing purpose; `transportUser` without mobile — each 422 with a `details.path`.
- 50 parallel creates → 50 distinct, gap-free numbers.
- IDOR: user B requesting user A's requisition → 404; Transport Office **cannot see drafts** (also asserted in Step 13).
- Draft edit/delete only while Draft; cannot submit twice (`409`).
- Notification rows exist for the right recipients and none for others.

**Done when**
- [ ] An applicant can create a draft, edit it, submit it, and see it in `/requisitions/mine` with the correct status.

---

## Step 12 — Department Head recommender workflow

**Goal:** §12.8 and §11.2 transitions 4–6.

**Build**
1. `GET /recommender/inbox` (status `Pending Recommendation`, scope match via `departmentScopeMatches`, **excluding the head's own requisitions**), `GET /recommender/history` (`recommender_id = me`), `GET /recommender/inbox/count`.
2. `POST /requisitions/:id/recommend` `{message?}` — `SELECT … FOR UPDATE`, `assertTransition`, scope check, stamp recommender fields, status → `Recommended`; notify all active TIC (`New Requisition`) and the applicant (`Recommendation`).
3. `POST /requisitions/:id/reject` `{reason, remarks?}` — status → `Rejected`; **only the applicant** is notified.
4. `POST /requisitions/:id/send-back-to-applicant` — **shared endpoint**, behaviour chosen by the caller's role: DepartmentHead (note **required**, status `Pending Recommendation`, scope) here; the TIC variant is added in Step 14. Store `send_back_note`, `sent_back_by`, `sent_back_at`; trips reset to `Pending`; status `Information Requested`; applicant notified (`Sent Back to Applicant`).
5. Every action: transaction + audit + correct 403/404/409 behaviour (out-of-scope head → 404).

**Tests:** scope isolation (CSE head vs Physics requisition); own requisition not in own inbox; recommend only from `Pending Recommendation` (second call → 409); reject notifies only the applicant; head send-back without note → 422; "Recommended by me" lists only own recommendations; counts.

**Done when**
- [ ] Applicant → head recommend → TIC queue works in an integration test.

---

## Step 13 — Transport Office listing, vehicle options and allocation

**Goal:** the In-Charge can see their queue and assign vehicles safely (§11.6, §12.9).

**Build**
1. `GET /admin/requisitions?tab=queue|approved|rejected|all&type&status&from&to&q&page&pageSize` — role-aware queue (TIC → In-Charge queue; TA → Administrator queue; SuperAdmin → union), tabs as in §12.9; **never returns `Draft`**; sort per §12.9; each item includes trips + allocations + mileage status.
2. `GET /admin/requisitions/:id` — full detail (allocations with vehicle/driver, slip history summary, mileage entries).
3. `GET /trips/:tripId/vehicle-options` (TIC) — for each vehicle run `getVehicleEligibility` with fresh data (allocations, off-days, schedule); return `{ vehicle, eligible, blockers, warnings }` sorted eligible first.
4. `PUT /trips/:tripId/allocation` `{vehicleId, driverId?}` (TIC) — implement **exactly** the transactional algorithm in §11.6 (lock vehicle row `FOR UPDATE`, lock requisition, require In-Charge queue + trip not Rejected, recompute eligibility inside the transaction, blockers → `409 VEHICLE_NOT_ELIGIBLE` with `details`, insert/replace the allocation, copy date/times from the trip, `driver_id` defaults to the vehicle's permanent driver, write `allocation_history` `assigned`/`reassigned`).
5. `DELETE /trips/:tripId/allocation` (TIC) → history `removed`.
6. Call `allocationGuardService.assertScheduleAllowed(...)` before saving a transport-schedule entry (still a stub).

**Tests**
- Each blocker (inactive; not available; no permanent driver; one-time and recurring off-day; overlap; student-transport) → 409 with the right text; back-to-back allowed; reassign excludes own allocation; category mismatch → warning only, assignment succeeds.
- **Concurrency:** two simultaneous `PUT` for the same vehicle and overlapping time → exactly one 200, one 409.
- Wrong role (TA, applicant) → 403; wrong status (requisition in Administrator queue) → 409.
- Transport roles cannot see drafts; a Draft id → 404.

**Done when**
- [ ] The concurrency test passes repeatedly (run it 20×).

---

## Step 14 — Forward, send-back (In-Charge), resubmit

**Goal:** §11.2 transitions 7–9, §11.4, §12.8, §12.9 — including the improved send-back workflow.

**Build**
1. `POST /requisitions/:id/forward` (TIC) — requires In-Charge queue and `canForwardToAdministrator` (every non-rejected trip allocated; otherwise `409 INVALID_STATE` listing trips missing a vehicle); status → `Pending Administrator`; clear `transport_office_remarks`; notify all active TA (`Forwarded to Administrator`).
2. Extend `POST /requisitions/:id/send-back-to-applicant` with the **TransportInCharge** variant: body `{ note?: string }` (**optional**; empty/whitespace ⇒ stored as NULL and the call still succeeds), allowed from `Recommended` and `Pending on Transport Office`; **delete all allocations** (history `released_on_send_back`); trips reset to `Pending`; set `send_back_note`, `sent_back_by='Transport In-Charge'`, `sent_back_at`; status `Information Requested`; notify the applicant with the **with-note / without-note** messages of §12.8.
3. `PUT /requisitions/:id/resubmit` (owner, status must be `Information Requested`) — same editable payload as create; validation as submit; apply the **routing rule of §11.4** (already has `recommender_id` → `Pending on Transport Office`, else §11.3); keep `id` and `created_at`; replace trips (reuse ids sent by the client where they match); set `resubmitted_at`; **clear** `send_back_note`, `sent_back_by`, `sent_back_at`, `transport_office_remarks`; notify heads **or** all active TIC with type `Resubmission`; audit.
4. DTO exposes `sendBackNote`, `sentBackBy`, `sentBackAt`, `resubmittedAt` to the owner.

**Tests**
- Send back **with** and **without** a note → both 200; stored note NULL vs text; applicant notification wording differs.
- Allocations are gone after send-back; trips are `Pending`.
- Owner sees the note; resubmit by a different user → 404; resubmit from a wrong status → 409.
- Routing: (a) head-recommended then TIC-sent-back → resubmit goes to `Pending on Transport Office`; (b) head-sent-back (never recommended) + Official → goes to `Pending Recommendation`.
- After resubmit the note fields are cleared and `resubmittedAt` is set; the application number is unchanged.
- Forward blocked while a trip has no vehicle; forward from the wrong status → 409.

**Done when**
- [ ] The §21 item 7 Applicant + In-Charge send-back journey passes in one integration test.

---

## Step 15 — Administrator decisions

**Goal:** per-trip approve / reject / reset, and send-back to In-Charge (§11.5, §12.9).

**Build** (role `TransportAdministrator` only; SuperAdmin must get 403 — view-only):
1. `POST /trips/:id/approve` — requisition in the Administrator queue (§11.5 stricter rule), trip `Pending`; **re-run the eligibility check** on the trip's allocation and block with `409 VEHICLE_NOT_ELIGIBLE` if the vehicle is no longer eligible (§12.9); set `Approved`; recompute requisition status with `computeApplicationStatus`; notify applicant `Trip Approved`.
2. `POST /trips/:id/reject` `{reason, remarks?}` — trip `Rejected`; **delete its allocation** (history `released_on_reject`); recompute status; notify applicant `Trip Rejected`.
3. `POST /trips/:id/reset-decision` — trip must be Approved/Rejected → `Pending`, clear rejection fields, **keep allocation**, recompute status; no notification.
4. `POST /requisitions/:id/send-back-to-in-charge` `{remarks}` (remarks **required**) — status `Pending on Transport Office`, `transport_office_remarks` set, every trip → `Pending` + clear rejection fields, **delete all allocations**, notify all active TIC (`Sent Back to Transport In Charge`).
5. All in transactions with `FOR UPDATE` on the requisition; audit each.

**Tests**
- All-approved → `Approved`; all-rejected → `Rejected`; mixed → `Partially Approved` and **leaves the Administrator queue** once no trip is Pending; a Pending trip keeps it in.
- Reject deletes allocation; reset keeps it; send-back clears allocations and resets trips.
- TIC cannot approve (403); TA cannot allocate (403); SuperAdmin cannot mutate (403).
- Approve blocked when the vehicle became unavailable after allocation.

**Done when**
- [ ] A complete requisition goes Applicant → head → TIC → TA → `Approved` in one integration test.

---

# PHASE E — After approval

## Step 16 — Slips (confirmation and driver/duty slips)

**Goal:** §12.13 and §15, including **driver slip download for the Transport In-Charge after approval**.

**Build** `modules/slips/`:
1. Availability helper `canGenerateSlips(requisition)` (Approved / Partially Approved / Completed / Ready for Accounts).
2. `GET /requisitions/:id/confirmation-slip` (owner or TA; owner scope rule; 409 if not yet available): returns the JSON payload of §15 built from **current** server data, inserts a `confirmation_slips` row (snapshot JSON) each time.
3. `GET /requisitions/:id/duty-slips` (TIC, TA, SuperAdmin): eligible driver groups (`getEligibleDutySlipGroups`) + per driver the slip history (newest first, older ones flagged superseded, `stale` flag when the allocation's vehicle differs from the latest slip snapshot).
4. `POST /requisitions/:id/duty-slips` `{driverId}` (**TA only**): creates `duty_slips` + `duty_slip_trips` **with snapshots** (driver name/designation; per trip: vehicle registration, category, date, times, route), sets `superseded_by_id` on the previous active slip for that requisition+driver; audit.
5. `GET /requisitions/:id/duty-slips/:driverId/data` (**TIC and TA**): returns the slip data for download **without creating a record or superseding anything**; allowed only when `canGenerateSlips(requisition)`; if the driver has no eligible trips → 404; if the requisition is not yet approved → `409 INVALID_STATE`; Applicant/DepartmentHead/SuperAdmin → 403.
6. Include `signatureUrl` of the requester in the confirmation payload; duty slip payload per §15.

**Tests**
- TIC download: before approval → 409; after approval → 200 and **zero new rows** in `duty_slips`; applicant/head/SuperAdmin → 403.
- TA regenerate → old slip superseded; history ordering; `stale` flag after reallocating the vehicle.
- Snapshot test: edit the vehicle's registration number after generation → the stored slip still shows the old value.
- Confirmation slip: owner OK after approval; another applicant → 404; before approval → 409.

**Done when**
- [ ] Both slip types return verified JSON; the frontend's existing jsPDF code can render from it (checked in Step 23).

---

## Step 17 — Trip completion and mileage

**Goal:** §11.7, §11.8, §12.14.

**Build**
1. `POST /trips/:id/complete` (TIC, TA) — trip must be `Approved` → `Completed`; then if no trip on the requisition is `Approved`/`Pending` and status ≠ `Ready for Accounts` → requisition `Completed`.
2. `POST /trips/:tripId/mileage` `{distanceKm}` (TIC, TA): requisition must be mileage-eligible (`isMileageEligibleRequisition`), trip `Completed` with an allocation, no existing entry (`409`), `distanceKm > 0` (decimal, 2 dp); insert; if every Completed trip of the requisition now has an entry → status `Ready for Accounts` (never regress); optional notification `Mileage Recorded` to the applicant.
3. `GET /mileage/awaiting` (TIC, TA), `GET /mileage` (TIC, TA, SuperAdmin, paged), `GET /mileage/mine` (owner view: per requisition `mileageStatus` + entries).
4. Add `mileageStatus` to the requisition DTO using `getMileageColumnStatus` (§11.8).

**Tests:** complete only Approved trips; requisition becomes `Completed` only when settled; mileage only for Personal + Teacher/Officer; students blocked; second entry → 409; last entry → `Ready for Accounts`; SuperAdmin/applicant → 403.

**Done when**
- [ ] Approved → Completed → mileage → Ready for Accounts works end to end in tests.

---

## Step 18 — Allocation guards

**Goal:** §11.9 — conflicts are prevented at the source. No Conflicts page, no `/conflicts` API, no conflict notifications.

**Build** `modules/allocationGuards/`:
1. `allocationGuardService` with `assertVehicleCanBecomeUnavailable(vehicleId)`, `assertOffDayAllowed(vehicleId, offDay)` and `assertScheduleAllowed(vehicleId, schedule)`. Each loads the vehicle's **upcoming** allocations (date >= today in `Asia/Dhaka`) using `domain/allocationGuards.ts` and throws `409` with `details.allocations` (codes in §11.9).
2. Replace every stub call from Steps 9, 10, 13 with the real service. Run the guard and the write in one transaction with `SELECT … FOR UPDATE` on the vehicle row.
3. Confirm the vehicle-assignment endpoint (Step 12) already enforces the four eligibility rules (status/availability, off-day, double-booking, student transport) with `409 VEHICLE_NOT_ELIGIBLE`.

**Tests:** each of the seven rules in §11.9 blocks with the right code and lists the clashing allocations; past allocations never block; a vehicle with no upcoming allocations can become unavailable; two concurrent requests cannot both pass; role checks.

**Done when**
- [ ] No `allocationGuardService` stubs remain (`grep -rn "stub"` returns nothing relevant).

---

## Step 19 — Notifications API

**Goal:** §12.15 and a complete, consistent notification catalogue (§13).

**Build**
1. Finalise `services/notify.ts`: `notifyUsers(trx, recipients, {type, message, linkType, linkId, dedupeKey?})` used **inside** each workflow transaction (never after commit).
2. Audit every call-site against the table in §13 — each event must produce exactly the specified rows. Add a table-driven integration test that performs each event and asserts recipients/type/message.
3. Endpoints: `GET /notifications` (own, paged, `unreadOnly`), `GET /notifications/unread-count` (`{count, recommendationsCount}`), `POST /notifications/:id/read` (own only; others → 404), `POST /notifications/read-all`.
4. DTO field `timestamp` = `created_at`; `recipientUserId` included.

**Tests:** users never see others' notifications; mark read / read all; counts; the §13 table test.

**Done when**
- [ ] The notification table test covers all 15 rows of §13 and passes.

---

## Step 20 — Dashboards

**Goal:** §12.16.

**Build** `GET /dashboard/operations` (TIC, TA, SuperAdmin) and `GET /dashboard/applicant` (Applicant, DepartmentHead) with the fields listed in §12.16. "Today" uses `Asia/Dhaka`. Use aggregate SQL (`COUNT … GROUP BY`) — no loading of whole tables into memory.

**Tests:** counts correct for a seeded scenario; DepartmentHead sees only own requisitions in the applicant dashboard; roles enforced.

**Done when**
- [ ] Dashboard responses match what the frontend dashboard pages display today for the same data.

---

## Step 21 — Files authorisation and audit-log API

**Goal:** finish §12.17 and §19.2.

**Build**
1. Extend `GET /files/:id`: signature → owner, Transport Office roles, and the head in scope of a requisition owned by that user; supporting document → requisition owner, head in scope, Transport Office roles; everything else `404`. Headers: `X-Content-Type-Options: nosniff`, `Cache-Control: private`.
2. Orphan cleanup function `purgeOrphanFiles()` (used by the job in Step 24).
3. `GET /audit-logs` (SuperAdmin; filters `entityType`, `entityId`, `actorId`, `from`, `to`; paged). Confirm audit rows exist for **every** event in §19.2 (login success/failure, password change, vehicle/driver/off-day/schedule changes, slip generation, mileage, etc.) — add missing `audit.log` calls.

**Tests:** file access matrix (owner, other applicant, in-scope head, out-of-scope head, TIC, TA); audit endpoint access; audit rows for a sample of events.

**Done when**
- [ ] The access-matrix test passes; no file is reachable without authorisation.

---

# PHASE G — Integration and release

## Step 22 — OpenAPI document and contract tests

**Goal:** a machine-readable API description the frontend can use.

**Build** `docs/openapi.yaml` describing every route of §12 (paths, security schemes, request/response schemas, error format). Preferably generate from the Zod schemas (`zod-to-openapi`); otherwise keep it hand-written and add a test that fails when a registered Express route has no entry in the document. Add a contract test that validates a sample response of each major endpoint against the schema.

**Done when**
- [ ] `docs/openapi.yaml` validates (`swagger-cli validate`); the coverage test passes.

---

## Step 23 — Frontend cut-over

**Goal:** the React app runs entirely on the API (§17). Do this **module by module**, in this order, committing after each: Auth → Directory/Profile → Users → Fleet (drivers, vehicles, off-days, schedule) → Requisitions (applicant) → Recommender → Allocation/Forward/Approvals → Slips/Mileage → Allocation guards → Notifications → Dashboards.

**Build (in the existing frontend `src/`)**
1. `src/api/client.ts` — `fetch` wrapper with `VITE_API_BASE_URL`, Bearer token from memory, `credentials: "include"`, §7.4 error parsing, one automatic `/auth/refresh` retry on `401`.
2. Add TanStack Query; replace each hook per the mapping table in §17.2 (keep the hook names/return shapes where possible so page components change little). Replace `AuthProvider` storage with in-memory token + `/auth/refresh` on load.
3. Apply the required frontend changes of §17.3: `supportingDocumentUrl` / `signatureUrl` (fetch images with the token for jsPDF), authoritative application number from `POST /requisitions`, `RequisitionForm` becomes a payload builder, stricter Administrator-queue rule, password-length copy, hide the OTP dev banner in production.
4. Delete the replaced code as you go: `utils/passwordUtils.ts`, `hooks/useOtp.ts`, localStorage collection hooks, seed logic in `useUsers.ts`, client-side notification builders that created records.
5. Update `.env.example` of the frontend (`VITE_API_BASE_URL`).

**Tests:** run the Playwright script style used earlier (or add Playwright tests) for each role journey of §21 item 7 against a real running API + test database.

**Done when**
- [ ] `grep -rn "localStorage" src` shows no data stores (only optional UI preferences).
- [ ] All five role journeys of §21 item 7 pass end to end in the browser.

---

## Step 24 — Hardening, jobs and performance

**Goal:** production readiness (§8.5, §19).

**Build**
1. **Scheduled jobs** (`node-cron`, started from `server.ts`, disabled in tests): daily purge of expired OTP challenges and expired/revoked refresh tokens; nightly orphan-file cleanup.
2. **Security review checklist** (tick each, note results in `PROGRESS.md`): rate limits on all auth routes; `helmet`; CORS exact origins; `OTP_DEV_ECHO=false` and `COOKIE_SECURE=true` in production; no secrets in git (`git log -p | grep -i secret`); `npm audit --omit=dev` clean of high/critical; upload spoofing tests; IDOR tests for every `:id` route; SQL only via Knex bindings (grep for template-string SQL).
3. **Performance pass:** run `EXPLAIN` on the queue listing, the allocation guard queries and the notification list with ~10k requisitions generated by a seed script; confirm indexes from §10.2 are used; paginate everything unbounded.
4. **Backups:** script `scripts/backup.sh` (`mysqldump` + `tar uploads/`) and a documented restore test.
5. Optional `scripts/import-local-storage.ts` (§16.4) to import an exported localStorage JSON; imported users have `password_hash = NULL` and must set a password.

**Done when**
- [ ] The checklist is completed and recorded; the load seed runs and key endpoints respond < 300 ms locally.

---

## Step 25 — Deployment and handover

**Goal:** another person can deploy and operate it.

**Build**
1. `Dockerfile` (multi-stage: build with `tsc`, run `node dist/server.js` as a non-root user) and a production `docker-compose.yml` (api + mysql + volumes for `uploads/` and DB data).
2. `README.md` finished: architecture overview, env variable table, scripts, how to run migrations/seeds, how to create the first Super Admin in production (no default password — §16.2), how to run tests, module map, link to both plan documents and the OpenAPI file.
3. `docs/RUNBOOK.md`: start/stop, deploy steps (`knex migrate:latest` as a deploy step, never on boot), rollback, backup/restore, rotating `JWT_ACCESS_SECRET`, what to do when OTP emails fail, how to deactivate a compromised account.
4. Final regression: run the whole test suite + the Playwright journeys against a freshly migrated database.
5. Tag the release (`v1.0.0`) and write `CHANGELOG.md`.

**Done when**
- [ ] Every item of the Definition of Done in Part 1 §21 is ticked.

---

# Appendix A — Dependency map between steps

```
0 → 1 → 2 → 3 ──┬─→ 4 → 5 → 6 → 7
                │            │
                │            └─→ 8 → 9 → 10 ─┐
                │                              ▼
                └──────────────────────────→ 11 → 12 → 13 → 14 → 15 → 16 → 17
                                                          │             │
                                                          └──→ 18 ←─────┘
        19, 20, 21 can start after 15 (notifications formalised in 19; most call-sites exist by then)
        22 after 21 · 23 after 22 · 24 after 23 · 25 last
```

# Appendix B — Per-step checklist template (copy into `PROGRESS.md`)

```
## Step N — <title>        Date: YYYY-MM-DD
- [ ] Read the cited sections of Part 1
- [ ] Code written (files listed)
- [ ] Unit/integration tests written and passing
- [ ] lint + typecheck + test green
- [ ] Deviations from Part 1 (if any) and reason:
- [ ] Committed: "Step N: <title>"
```

# Appendix C — Rules that are easy to get wrong (read before Steps 11–18)

1. **The client never sets `status`, `requesterId`, application number, role, or allocation dates.** Always derive on the server.
2. **Drafts are private** to their owner; Transport Office and Department Heads must never see them.
3. **Send-back by the Transport In-Charge has an OPTIONAL note** (empty is fine); send-back by a Department Head and by the Administrator **require** a note.
4. **Resubmission routing:** already recommended → straight back to `Pending on Transport Office`; otherwise normal §11.3 routing.
5. **Allocations are released** on: trip rejected, send-back to applicant, send-back to In-Charge. **Kept** on: reset decision, approve.
6. **Overlap is strict** (`startA < endB && startB < endA`) — back-to-back trips are allowed.
7. **Driver slip download by the In-Charge creates no record.** Only the Administrator's generate/regenerate creates and supersedes slips.
8. **Slips use snapshots**, never live vehicle/driver data, so later edits cannot change history.
9. **`Reserved For` does not exist** — no column, field, validation or UI. Do not re-add it.
10. **SuperAdmin is view-only on operations** but may manage fleet reference data and user accounts.
11. **Every state change runs in one transaction** with `SELECT … FOR UPDATE` on the requisition, writes its audit row and its notifications in that same transaction.
12. **Dates and times** are plain `YYYY-MM-DD` and `HH:mm` strings in JSON; "today" and the application-number year use `Asia/Dhaka`.

---

*End of Part 2. After Step 25 the backend and the frontend cut-over are complete and the system is ready for user acceptance testing.*
