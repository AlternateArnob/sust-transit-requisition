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
