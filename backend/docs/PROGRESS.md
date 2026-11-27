# Progress log

One entry per step: step number, date, what was done, and any deviation from the plan (with the reason).

## Step 0 — Repository, tooling and local environment — 2026-11-25

- Created the `backend/` project: `package.json` (ESM), strict `tsconfig.json` (`NodeNext`, `outDir: dist`) plus `tsconfig.build.json`, ESLint (flat config), Prettier, Vitest.
- Installed all runtime and dev dependencies listed in the plan.
- Added scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `migrate`, `migrate:rollback`, `seed`, `db:reset` (refuses to run when `NODE_ENV=production`), plus `format` / `format:check`.
- Added `docker-compose.yml` (MySQL 8.0 with utf8mb4 / `utf8mb4_0900_ai_ci` / UTC, a second `sust_transit_test` database created by `docker/mysql-init/`, and MailHog).
- Added `.env.example` with every variable from Part 1 §6.
- Created the folder skeleton from Part 1 §5 (placeholder files export nothing yet).
- Added `.github/workflows/server-ci.yml` (Node 22, MySQL 8 service, format check, lint, typecheck, build, test).
- Added a minimal `knexfile.ts` so `npm run migrate` can connect from Step 0; Step 2 replaces it with the full version.

Deviations / notes:

- Added `format:check` (Prettier) to CI, matching the frontend workflow; the plan only lists lint, typecheck and test.
- Added `tsconfig.build.json` so `npm run build` excludes tests and scripts from `dist/`.
- Node 22 LTS is used instead of Node 20: Vitest 5 requires Node >= 22.12 and the repo `.nvmrc` is already 22 (Part 1 §4 allows 22 LTS). `@types/node` is pinned to v22 for the same reason.
- The MySQL init script grants the test database to a user named `sust_transit`; change it if `DB_USER` changes.

## Step 1 — Config, app shell, errors, validation, logging — 2026-11-25

- `src/config/env.ts`: Zod schema for every variable in Part 1 §6. Collects all problems and exits with a readable message. Production additionally requires `OTP_DEV_ECHO=false`, `COOKIE_SECURE=true` and a `JWT_ACCESS_SECRET` of at least 32 characters. `parseEnv()` is pure (used by tests); `env` is parsed once at start-up.
- `src/config/constants.ts`: all enums from §11.1 plus the `ENUM` columns in §10.2, as `as const` arrays with derived types, plus HTTP limits.
- `src/errors/AppError.ts`: `AppError` and factories (`badRequest`, `unauthenticated`, `forbidden`, `notFound`, `conflict`, `invalidState`, `validation`, `rateLimited`).
- Middleware: `requestId`, `validate`, `errorHandler`, `notFound`, `rateLimit` (global limiter plus `createRateLimiter` factory for Step 4).
- `src/app.ts` builds the app without `listen`; `src/server.ts` listens and shuts down gracefully on `SIGTERM`/`SIGINT`.
- `GET /api/v1/health` (503 with `db: "down"` when `SELECT 1` fails or takes more than 2 s) and `GET /api/v1/version`.
- `src/db/config.ts` + `src/db/knex.ts`: single Knex instance (needed by `/health`); `knexfile.ts` now reuses the validated config.
- `src/config/logger.ts`: pino, silent in tests, redacts the `Authorization` header, cookies and `password` fields.
- Tests: 59 (env parsing and production rules, error factories, middleware in isolation, app shell, health with DB up and down).

Deviations / notes:

- **Fix to Step 0:** `tsconfig.build.json` used `rootDir: "."`, which would have produced `dist/src/server.js` instead of the `dist/server.js` that `npm start` runs. It now builds only `src` with `rootDir: "src"`. Migrations and seeds are not compiled into `dist/`; they run through `tsx` (revisit in Step 25, deployment).
- `TRUST_PROXY=true` is applied as `trust proxy = 1` (one hop), not `true`, because `true` trusts a client-controlled `X-Forwarded-For` chain and would let clients dodge rate limits.
- A request body over 100 kb returns **413** with code `BAD_REQUEST`; the plan only lists 400 for body-parser errors.
- Required variables with no default: `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_ACCESS_SECRET`, `CLIENT_ORIGIN`. Everything else falls back to the Part 1 §6 values.
- `/health` returns `status: "ok"` when the database is reachable and `status: "error"` (HTTP 503) otherwise.
- `validate()` reports body problems with plain paths (`trips.0.startTime`) and prefixes params/query problems (`params.id`, `query.page`). A missing body is treated as `{}`.
- Tests force `DB_NAME=sust_transit_test` (`tests/setup.ts`) so they can never touch the development database.

## Step 2 — Database layer and migrations (all tables) — 2026-11-25

- Six migrations create every table from Part 1 §10.2 as raw `CREATE TABLE` statements copied from the spec, each with `ENGINE=InnoDB`, `utf8mb4` and `utf8mb4_0900_ai_ci` stated explicitly: `001_directory_and_files`, `002_users_and_auth`, `003_fleet`, `004_requisitions`, `005_allocations_slips_mileage`, `006_notifications_and_audit`. `files` is created before `users` (signature FK); each `down` drops its tables in reverse dependency order.
- `src/db/transaction.ts`: `withTransaction(fn)` commits on success and rolls back and re-throws on error.
- Test infrastructure: `tests/globalSetup.ts` migrates the test database once per run; `tests/helpers/` has `truncateAll()` (refuses any database except `sust_transit_test`), a migration runner and row factories.
- Tests (130 in total, 71 new): table list and `up -> down -> up`, ENGINE/collation, an enum drift guard comparing every `ENUM` column to `config/constants.ts`, every unique key, every `CHECK`, `ON DELETE` behaviour (CASCADE / SET NULL / RESTRICT), the history table surviving deletions, value round-tripping, and `withTransaction` commit and rollback.
- New script `npm run migrate:rollback:all` (see below).

Deviations / notes:

- **21 tables, not 20.** The plan's checklist says "all 20 tables", but §10.2 defines 21 (`directory_units`, `files`, `users`, `otp_challenges`, `refresh_tokens`, `drivers`, `vehicles`, `vehicle_off_days`, `student_transport_vehicles`, `student_transport_slots`, `requisition_counters`, `requisitions`, `trips`, `allocations`, `allocation_history`, `duty_slips`, `duty_slip_trips`, `confirmation_slips`, `mileage_entries`, `notifications`, `audit_logs`). All 21 are created; Knex adds its own `knex_migrations` and `knex_migrations_lock`.
- **Spec bug fixed in `notifications`:** §10.2 declares `UNIQUE KEY uq_notif_dedupe (dedupe_key)` but never defines the column, which MySQL rejects. Added `dedupe_key VARCHAR(190) NULL` (Step 19's `notifyUsers` takes an optional `dedupeKey`; MySQL allows many NULLs under a unique key).
- **`npm run migrate:rollback --all` does not work as written in the plan:** npm consumes `--all` as its own flag, so the script rolls back only the last batch. Use `npm run migrate:rollback:all` (or `npm run migrate:rollback -- --all`).
- Migrations use literal `ENUM` lists rather than importing `constants.ts`, so an old migration can never change meaning; the drift-guard test fails if the two disagree.
- Tests run migrations through the Knex CLI in a child process (Vitest cannot hand TypeScript migration files to Knex), and test files run one at a time (`fileParallelism: false`) because they share one database.
- `files.owner_user_id` has an index but no foreign key, exactly as in §10.2 (a FK would make `users` and `files` circular).
- `dateStrings: true` means `DATETIME(3)` columns come back as `"2026-11-25 08:00:00.000"` (UTC, not ISO); services must convert when building API responses.

## Step 3 — Domain layer (pure logic ported from the frontend) — 2026-11-26

- `src/domain/` now holds every business rule that needs no database: `permissions`, `recommendation`, `requisitionStatus` (status computation, queues, and the §11.2 transition table as data with `assertTransition`), `validators` (3-hour rule, route parsing, `buildTripFromInput`), `schedule`, `vehicleEligibility`, `allocationGuards`, `mileage`, `applicationNumber` and `slips`.
- `src/types/index.ts` defines the small camelCase shapes (`TripLike`, `AllocationLike`, `VehicleLike`, ...) the domain works on, so it never depends on database rows.
- Tests: 317 domain tests (447 in total), no database. They include every mandatory case from the step plan, plus a purity test that fails if a domain file imports Express, Knex, the DB or the env config, touches `process.env`, or reads the clock.

Deviations / notes:

- **Stricter Administrator queue** (as the plan requires): `Partially Approved` is only in the queue while a trip is still `Pending`. The frontend helper `isInTransportAdministratorQueue` still uses the old rule and should be changed to match (Part 1 §20).
- **`computeApplicationStatus` and Completed trips:** the frontend version ignores the `Completed` trip status. Here a `Completed` trip counts as approved, so deciding a sibling trip after another was completed cannot demote the requisition; if every trip is `Completed` the current status is kept (the completion rules own it).
- **`isSustEmail` hardened:** exactly one `@` and a non-empty local part (the frontend accepted `@sust.edu`).
- **`todayString(now)` takes the clock** and uses `Asia/Dhaka` (Part 1 §20); the guards take `today` as an argument. `getWeekdayFromDate` reads `YYYY-MM-DD` as a plain calendar date (via UTC), so it does not depend on the server's time zone, and it throws on invalid dates such as `2026-02-30`.
- `toMinutes` ignores seconds (trips are entered as `HH:mm`; MySQL returns `HH:mm:00`).
- `buildTripFromInput` throws a 422 `VALIDATION_ERROR` (`trips.N.destination` / `trips.N.routeText`) on unusable input, and takes an optional trip index.
- **Additions beyond the step list:** `resolveSubmissionStatus` (rules 11.3 and 11.4 in one place), `snapshotDepartment`, `computeStatusAfterTripCompletion` (§11.7), `toAllocationConflictDetails` (the `details.allocations` shape of §11.9), `isApplicationNumber`, `assign_vehicle` in the transition table, and `APP_TIME_ZONE` / `MAX_TRIP_HOURS` in `config/constants.ts`.
- **Not decided here:** when a requisition becomes `Ready for Accounts`. §11.2 says "when mileage is recorded for every Completed trip" while table row 13 says "after all trips Completed"; Step 18 (mileage) needs to settle which one applies when some trips are still `Approved`.
- User-facing messages keep the frontend's wording, including the em/en dashes.

## Step 4 — Passwords, OTP, email and tokens (services) — 2026-11-26

- `services/password.ts`: argon2id `hashPassword` / `verifyPassword` (never throws; false for a missing or malformed hash), `assertPasswordPolicy` (min from `PASSWORD_MIN_LENGTH`, default 8; max 128), and `burnPasswordCheck` so Step 5 can make "unknown email" take as long as "wrong password".
- `services/otp.ts` (Part 1 §8.2): `generateCode` (`crypto.randomInt`), `issueOtp` (replaces the single challenge per email, 10 min expiry, 60 s resend cooldown, max 5 sends per hour per email, `429 RATE_LIMITED` with `details.retryAfterSeconds`), `verifyOtp` (four failure reasons, attempt counter, deletes the challenge on success) and `otpFailureToError` (`OTP_NOT_FOUND` / `OTP_EXPIRED` / `OTP_INVALID` 422, `OTP_ATTEMPTS_EXCEEDED` 429). Only `salt:sha256(salt:email:code)` is stored.
- `services/mailer.ts`: Nodemailer transport from env, `sendOtpEmail`; logs the code to the console in `development` only; tests use the JSON transport (no sockets) and can inject a stub with `setMailTransport`.
- `services/tokens.ts` (§8.4): `signAccessToken` / `verifyAccessToken` (HS256 only, claims `sub`, `role`, `scope`, `jti`), refresh tokens (256-bit random, SHA-256 hash stored, `family_id`), `rotateRefreshToken` (reuse of a revoked token revokes the whole family and the revocation is committed before the 401), `revokeAllForUser`, `revokeByToken`, and cookie helpers (`httpOnly`, `secure`/`sameSite` from env, path `${API_BASE_PATH}/auth`).
- `middleware/auth.ts`: `authenticate({ allowOnboarding })` loads the user from the database on every request (so deactivation and role changes apply on the next call) and uses the DB role; `requireRole(...)` and `requireCapability(predicate)`. `req.user` is typed through `src/types/express.d.ts`.
- `middleware/rateLimit.ts`: `loginLimiter` (10 / 15 min per IP + email), `registerLimiter` (10 / hour per IP), `otpLimiter` (20 / 15 min per IP), and `resetRateLimitStores()` for tests.
- Also added: `modules/users/user.repository.ts` (`UserRow` -> `UserRecord`), `db/time.ts` (`fromDbDateTime`, `toIso`), the `DbExecutor` type, and the specific error codes of Part 1 §8 / §12 in `AppError.ts`.
- Tests: 97 new (544 in total) covering every item in the step plan, including "no plaintext OTP or token is ever stored".

Deviations / notes:

- **New migration `007_otp_send_window`.** §8.2 asks for "max 5 sends per hour per email", but §10.2's `otp_challenges` is a single replaced row per email, which loses the history needed to count. Two columns (`send_count`, `send_window_started_at`) keep the count, and the row is updated in place on resend. Rolling back drops them.
- **argon2id instead of bcrypt**, so `BCRYPT_COST` is currently unused. Production uses the OWASP minimum (19 MiB, 2 passes); tests use the cheapest valid parameters.
- **No 30-second user cache in `authenticate`.** The plan calls it acceptable, not required; one primary-key lookup per request is cheap and makes deactivation instant.
- **A wrong code that uses the last attempt already returns `attempts-exceeded`** (not `wrong-code`), so the client learns immediately that it must request a new code.
- `verifyOtp` returns the failure instead of throwing. Throwing inside a transaction would roll back the attempt counter; callers commit first, then call `otpFailureToError`.
- Onboarding tokens live 30 minutes (access tokens 15): they have no refresh cookie behind them and the user needs time to read an email and draw a signature.
- A refresh token that is replayed (even by a second browser tab racing the first) revokes the family. The frontend must serialise `/auth/refresh` calls.
- **Bug found by the tests and fixed:** two parallel first requests for the same email could deadlock on InnoDB's gap lock (`ER_LOCK_DEADLOCK`); `issueOtp` now retries duplicate-key and deadlock errors, after which the loser is correctly told to wait for the cooldown.
- Fixed Step 2's hard-coded "6 migrations" assertion so it counts the files in `migrations/` instead.

## Step 5 — Auth endpoints (register, OTP, login, refresh, logout, me) — 2026-11-26

- `modules/auth/` (routes, controller, service, Zod schemas) mounted at `/api/v1/auth`:
  - `POST /auth/register` — SUST-domain check (`422 EMAIL_DOMAIN_NOT_ALLOWED`), verified duplicate `409 EMAIL_TAKEN`, unverified duplicate reuses the account and sends a new code; creates `users(role='Applicant', is_verified=0)`; responds `202 { email, otpExpiresAt, resendAvailableAt, devCode? }`.
  - `POST /auth/otp/verify` — code check and `is_verified = 1` commit together; returns `{ onboardingToken, user }`; failure codes per Part 1 §8.2.
  - `POST /auth/otp/resend` — respects the 60 s cooldown (`429` with `details.retryAfterSeconds`).
  - `POST /auth/login` — order: unknown email -> lock -> deactivated -> unverified / no password -> password check. 5 consecutive failures lock the account for 15 minutes (`429`), success resets the counter and sets `last_login_at`. Returns `{ accessToken, expiresIn, user }` and sets the refresh cookie.
  - `POST /auth/refresh` — needs the cookie and `X-Requested-With: fetch`; rotates the token (family-revoke on reuse is in Step 4's `rotateRefreshToken`); re-reads the user, so a deactivated, unverified or deleted account is refused and all its tokens revoked.
  - `POST /auth/logout` — needs `X-Requested-With: fetch`; revokes this browser's refresh-token family, clears the cookie, `204`.
  - `GET /auth/me` — accepts onboarding tokens; returns `PublicUser` plus `nextStep` (`"otp"` / `"profile-setup"`) while onboarding is unfinished.
- `loginLimiter`, `registerLimiter` and `otpLimiter` from Step 4 are applied to their routes.
- New pieces: `domain/onboarding.ts` (pure `getNextStep` / `missingProfileFields`, reused later by `PUT /me/profile` and requisition submission), `modules/users/user.mapper.ts` (the single `toPublicUser`, never exposes the hash), `middleware/csrf.ts`, the new `user.repository` functions, and the `invalidCredentials` / `accountDeactivated` / `emailDeliveryFailed` error helpers.
- Tests: 95 new (639 in total): 72 integration tests over the real app and MySQL, and 23 unit tests (onboarding rules, mapper, purity guard for the new domain file). Three deliberate bugs (lockout threshold, a leaked token, a missing CSRF check) were each caught by a test.

Deviations / notes:

- **Security fix: no onboarding token from `/auth/login`.** Part 1 §12.1 and Part 2 Step 5 return an `onboardingToken` (plus `user`) when an _unverified_ or _password-less_ account logs in, on nothing but an email address. Onboarding tokens may complete the profile and set the password, so anyone who knew an applicant's email could set a password on the account and later use it (for example for a verified applicant who closed the tab before choosing one). Instead, both cases now email a fresh code (`resume` purpose for verified accounts) and answer `200 { nextStep: "otp", email, otpExpiresAt, resendAvailableAt, devCode? }` with **no token and no user data**. The token is issued only by `POST /auth/otp/verify`, after the owner proved access to the mailbox. Consequence for the frontend: a `nextStep` of `"otp"` always means "go to the code screen"; `"profile-setup"` is learned from `GET /auth/me` after verification. **Step 6 must additionally reject `PUT /me/profile` and `POST /me/signature` for unverified accounts** (defence in depth).
- **Lockout response:** a locked account gets `429 RATE_LIMITED` with a generic message and `details.retryAfterSeconds` (Part 1 §8.1 leaves `429` vs a dedicated code to the owner). After the lock is set the counter restarts at 0, so a new lock needs five new failures rather than one.
- **`POST /auth/logout` does not require a bearer token.** The table says "any / onboarding", but an expired access token must not stop someone from ending their session. The cookie plus the `X-Requested-With` header is what authorises it; with no valid cookie it is a no-op `204`.
- **`POST /auth/otp/resend` answers `202` for unknown, verified and deactivated addresses without sending anything**, so it cannot be used to list registered emails or to flood the owner of an active account with mail. The 60 s / 5-per-hour limits apply to real unverified accounts.
- **Registering a deactivated, unverified account** returns `403 ACCOUNT_DEACTIVATED` (not covered by the plan).
- **Mail delivery:** with `OTP_DEV_ECHO=false`, an SMTP failure returns `502 EMAIL_DELIVERY_FAILED` and deletes the challenge, so the user is not stuck behind the resend cooldown. With `OTP_DEV_ECHO=true` (development only) the failure is logged and ignored, because the code is in the response anyway.
- **Login while a code is still cooling down** returns the `429` from the OTP service (a user who just registered and clicks "log in" within 60 s is told how long to wait).
- The OTP `code` must be exactly `OTP_LENGTH` digits; anything else is `422 VALIDATION_ERROR` and does not cost an attempt.
- `domain/onboarding.ts` was added to the Step 3 purity test's expected file list.
- Not done here (belongs to later steps): audit rows for login success/failure (Step 7 adds `audit.log`, Step 21 completes the list), and the profile fields themselves (Step 6, so the full register -> verify -> profile -> login test lands there).
- The global limiter allows 300 requests a minute per app instance, so each `describe` in `auth.test.ts` builds its own app.

## Step 6 — Directory, profile, signature, password (the full onboarding journey) — 2026-11-27

- `modules/directory/` (public) at `/api/v1/directory`: `GET /departments` and `GET /offices` return `{ data: string[] }`, active units only, alphabetical. `resolveUnitName(kind, name)` returns the directory's own spelling of a unit (case-insensitive match, canonical result) and is what Step 7's head-scope validation should reuse.
- `modules/users/profile.*` mounted at `/api/v1/me`:
  - `GET /me` — own profile (`PublicUser`, plus `nextStep` while onboarding is unfinished). Full token only.
  - `PUT /me/profile` — onboarding token or full token. `fullName` and `mobile` required; Applicant/DepartmentHead also need an applicant type, the type's fields (Student: department + registration number, Teacher: department + designation, Officer: office + designation), names that exist in the directory, an uploaded signature and, the first time, a password. Every problem is reported at once (`422 VALIDATION_ERROR` with a `details` entry per field). One transaction with the user row locked; nothing is saved on failure.
  - `POST /me/signature` — multipart field `file`, or transitional JSON `{ signatureDataUrl }`. PNG/JPEG only, decided from the magic bytes (PNG must also have an `IHDR` chunk), at most `MAX_SIGNATURE_BYTES` (`413`). Stored under a random `uuid.ext` name in `UPLOAD_DIR` (mode 0600), `files` row inserted, `users.signature_file_id` switched, the old row and file removed (disk delete only after the commit; the new file is removed again if the transaction fails). Returns `{ hasSignature: true, signatureUrl }`.
  - `PUT /me/password` — full token; `{ currentPassword, newPassword }`; `204`.
- `modules/files/`: `GET /files/:id` streams a stored file after an owner check (everything else, including a missing file, is the same `404`). Headers: `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=0, must-revalidate`, `inline` for images and `attachment; filename=…` otherwise. Step 21 widens who may read.
- `services/fileStorage.ts` (type sniffing for PNG/JPEG/PDF, random-name writes, safe deletes, a storage-name pattern that makes path traversal impossible, `decodeImageDataUrl`, `sanitizeOriginalName`), `middleware/upload.ts` (multer + `acceptSignature` dispatcher + error mapping), per-user `uploadLimiter` (30/15 min) and `passwordChangeLimiter` (10/15 min), `UNSUPPORTED_MEDIA_TYPE` error code, multer errors mapped in `errorHandler` (`413 PAYLOAD_TOO_LARGE`, `422` for a wrong field name, `400` for anything malformed).
- Seeds: `seeds/01_directory_units.ts` (27 departments with their school, 15 offices; idempotent upsert that never re-activates a unit someone switched off) and `seeds/02_admin_accounts.ts` (the three privileged accounts from §16.2, verified and active, password `SEED_ADMIN_PASSWORD`; accounts that already exist are left alone). `npm run migrate && npm run seed` was run twice against a fresh MySQL 8.0 database: 42 units, 3 users.
- Refactor: `domain/onboarding.ts` now holds one `AFFILIATION_FIELDS` table (applicant type -> its fields) and `pickAffiliation`; `missingProfileFields` uses it. Behaviour unchanged (all Step 5 tests untouched and green).
- Tests: 197 new (836 in total): 133 integration (directory + seeds 12, profile 56, signature 41, password 11, files 10, the register -> verify -> signature -> profile -> log in journey 3) and 64 unit (file sniffing, data URLs, storage names, affiliation rules, profile schemas, upload error mapping, password policy, and a drift guard that fails if the seed's department/office names differ from the frontend's `sustDirectory.ts`). Three deliberate bugs (type sniffing accepts anything, signature no longer required, any user may download any file) were each caught (18, 4 and 1 failing tests). **Bug found by the tests and fixed:** `data:image/png;base64,` with an empty payload was accepted by `decodeImageDataUrl`.

Deviations / notes:

- **Files are read into memory by multer, not written to disk first** (Part 2 Step 6 says "disk storage"). The bytes are validated and only then written, so unchecked content never touches `UPLOAD_DIR` and a rejected upload leaves nothing to clean up. Memory use is bounded by the 1 MB signature limit (5 MB for Step 11's documents).
- **A password can be set through `PUT /me/profile` only while the account has none.** Once it has one, sending `password` there is `422` pointing to `PUT /me/password`; otherwise a stolen access token could change the password without knowing the old one. The frontend's profile page (which today changes it without the old password) must use `PUT /me/password` with `currentPassword` at Step 23.
- **`PUT /me/password` revokes all of the user's refresh tokens**, including the one in the current browser (the cookie path is `/api/v1/auth`, so `/me/*` cannot tell which one is current). The access token in use keeps working until it expires (at most `JWT_ACCESS_TTL`), then the user must log in again. A wrong current password is `422` on `currentPassword`, not `401`, so the client does not treat it as an expired session. New password equal to the current one is `422`.
- **DepartmentHead is treated like an Applicant here.** Part 1 §12.3 says role-scope fields are not editable, but a Department Head also submits requisitions and Step 3's `needsApplicantProfile` already requires the full profile and signature for that role. So the applicant fields are editable; only `role`, `headOfDepartment` and `headOfOffice` are not (unknown keys are rejected, so they cannot be sent). Transport Office and Super Admin accounts may change only `fullName` and `mobile`; any non-blank applicant field is `422 "This field cannot be changed for your role."`.
- **Fields that do not belong to the applicant type are ignored and stored empty** (Officer: no department or registration number, etc.). The frontend form keeps values typed before the user switched type, and a stale department on an Officer would otherwise win over the office in the `department ?? office` snapshot used for routing. Omitted fields keep their stored value; a blank value for a required field is an error. Names are stored in the directory's spelling.
- **Mobile number format** (not in the plan): 5-30 characters from digits, `+`, `(`, `)`, `-` and space. The frontend only checked "not empty".
- **Completing the profile does not log the user in.** `PUT /me/profile` returns the profile only, as specified, and the 30-minute onboarding token cannot reach anything else. Part 1 §8.3 says the frontend then "sends them to /dashboard", which needs a session. At Step 23 either send the user to the login screen with the email pre-filled (matches the plan's "register -> verify -> profile -> log in"), or decide to issue a session from this endpoint. Not decided here.
- **Transitional JSON signature**: `app.ts` skips the global 100 kb JSON parser for exactly `/me/signature`, and that route parses its own body (limit: signature limit x 4/3 + 1 KB) after authentication, so anonymous callers cannot make the server parse a large body. Drop it when the frontend sends multipart.
- **Seeds**: the department/office data in `seeds/data/directory.ts` was generated from the frontend file, not retyped. The frontend comment says "7 schools" but the file has 6 school headings, so 6 distinct `school` values are stored (the school column is informational). In production `02_admin_accounts` refuses to run while `SEED_ADMIN_PASSWORD` is still the development default; Step 25 documents creating the first Super Admin.
- **Not done here (later steps)**: audit rows for profile changes, signature uploads and password changes (Step 7 adds `audit.log`, Step 21 completes the list); wider access rules for `GET /files/:id` (Step 21); a disk file left behind by a crash between the write and the commit is not found by any cleanup, because the Step 24 cleanup works from database rows. Consider a reconcile pass then. `UPLOAD_DIR` is relative to the working directory, so Step 25 must mount it as a persistent volume.
- Test infrastructure: tests use `UPLOAD_DIR=<tmp>/sust-transit-test-uploads` (emptied by `globalSetup`), never the development `./uploads`.

## Step 7 — Super Admin user management (+ audit and notification helpers) — 2026-11-27

- Shared helpers: `services/audit.ts` (`logAudit(trx, entry)`, `auditContext(req)`; every row carries actor, role, ip and request id and is written in the same transaction as the change), `services/notify.ts` (`notifyUser(trx, …)`, message capped at 1000 characters, optional `dedupeKey` ignored on conflict), `http/pagination.ts` (`{ data, meta: { page, pageSize, total } }`, default 20, max 100, `%`/`_` escaped for LIKE), `domain/accountStatus.ts` (the notification wording), `NOTIFICATION_TYPES` in `config/constants.ts`.
- `modules/users/user.admin.*` mounted at `/api/v1/users`, Super Admin only (database role, full token):
  - `GET /users` — filters `role`, `isActive`, `q` (name, email, mobile), `sort=field:dir` (createdAt, fullName, email, role), `page`, `pageSize`. Never returns hashes or lock counters.
  - `POST /users` — appoints TransportInCharge, TransportAdministrator or SuperAdmin with a password; the account is created verified and active and can log in at once. Policy-checked password, argon2id hash computed before the transaction, `409 EMAIL_TAKEN` (case-insensitive, also under a race). Audit `user.created`.
  - `PATCH /users/:id` — `fullName`, `email`, `mobile` (blank/null clears), `role`, `isActive`, `headOfDepartment`, `headOfOffice`; unknown keys are `422`. Own role/active status cannot be changed (`403`); the last active Super Admin cannot be demoted or deactivated (`409 LAST_SUPER_ADMIN`); a Department Head needs a department or office from the directory (stored in the directory's spelling); leaving that role clears the scope. Deactivation revokes every refresh token, and the very next request with an old access token gets `403 ACCOUNT_DEACTIVATED`. Role/active changes send one `Account Status Changed` notification; audit rows `user.role_changed`, `user.deactivated` / `user.reactivated`, `user.updated` (details) each hold a before/after snapshot. A request that changes nothing writes nothing.
  - `DELETE /users/:id` — Super Admin accounts only, never yourself, `409 USER_HAS_HISTORY` when the account owns requisitions or is referenced elsewhere. Removes refresh tokens, notifications, OTP rows and stored files; disk files are deleted after commit. Audit `user.deleted` keeps the final state.
- Concurrency: an edit locks all active Super Admins (id order) and then the target. InnoDB can still choose a deadlock victim when two admins demote each other at once, so `update` re-runs itself up to three times on `ER_LOCK_DEADLOCK`; the loser then sees the winner's commit and gets `409`. **Found by the tests:** without the retry that race returned `500`.
- Tests: 130 new, 966 in total (101 integration in `users.admin.test.ts`; unit tests for the wording, pagination helpers and audit/notify helpers).

Deviations / notes:

- Audit rows for login, profile, signature and password changes are still not written (Step 21 completes the list).
- `user.reactivated` is an extra audit action (the plan lists only deactivation).
- A stale head scope on a non-head role is ignored and cleared rather than rejected.
- Through HTTP the last-Super-Admin guard is only reachable in a race (the caller is always an active Super Admin and cannot change themselves), so its unit-level tests call the service directly.
