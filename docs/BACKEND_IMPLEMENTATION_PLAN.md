# SUST Transit Requisition — Backend Implementation Plan

**Stack:** Node.js · Express.js · MySQL 8
**Audience:** an AI/engineer who will build the backend from this document alone.
**Frontend:** already finished (React 19 + TypeScript + Vite + Tailwind). It currently stores everything in the browser's `localStorage` and has **no backend**. This plan replaces `localStorage` with a real API and database while keeping the frontend's behaviour and data shapes.
**Repo:** `Ishtiak2/sust-transit-requisition`, branch `application-module`.

> This is **Part 1 — the design plan** (what to build and the rules it must follow).
> **Part 2 — the step-by-step implementation plan** (the order to build it in) will be written next, using this document as its source.

---

## Table of contents

1. [How to read this document](#1-how-to-read-this-document)
2. [Goals, non-goals and scope](#2-goals-non-goals-and-scope)
3. [What the frontend does today](#3-what-the-frontend-does-today)
4. [Technology choices](#4-technology-choices)
5. [Project structure](#5-project-structure)
6. [Configuration (environment variables)](#6-configuration-environment-variables)
7. [API conventions](#7-api-conventions)
8. [Authentication and security](#8-authentication-and-security)
9. [Roles and permission matrix](#9-roles-and-permission-matrix)
10. [Database design](#10-database-design)
11. [Domain rules and state machines](#11-domain-rules-and-state-machines)
12. [API specification](#12-api-specification)
13. [Notifications catalogue](#13-notifications-catalogue)
14. [Files and uploads](#14-files-and-uploads)
15. [Slips and PDFs](#15-slips-and-pdfs)
16. [Seed data and reference data](#16-seed-data-and-reference-data)
17. [Frontend integration plan](#17-frontend-integration-plan)
18. [Testing strategy](#18-testing-strategy)
19. [Logging, audit, operations and deployment](#19-logging-audit-operations-and-deployment)
20. [Known gaps and decisions needed from the product owner](#20-known-gaps-and-decisions-needed-from-the-product-owner)
21. [Definition of done](#21-definition-of-done)

---

## 1. How to read this document

- **MUST / MUST NOT** are hard requirements. **SHOULD** is a strong default. **MAY** is optional.
- Every business rule below was taken from the real frontend code. Where the frontend has a quirk or a weakness, this plan says so and states the **backend behaviour to build** (usually the stricter, correct one).
- The frontend is the reference for **field names and shapes**. API JSON uses **camelCase** exactly like the frontend TypeScript types (`requesterName`, `startDate`, `stoppageSequence` …). Database columns use **snake_case**. The API layer converts between the two in one place (the "mapper" of each module).
- The single biggest change from the prototype: **the server is the source of truth and enforces every rule.** The prototype trusted the browser for everything (status changes, permissions, conflict checks). The backend MUST NOT trust the client for anything except the user's intent.

---

## 2. Goals, non-goals and scope

### 2.1 Goals

1. Real accounts: self-registration with email OTP for applicants, admin-created accounts for the Transport Office, secure login with real password hashing.
2. Persist all data in MySQL: users, vehicles, drivers, off-days, student-transport schedule, requisitions, trips, allocations, slips, mileage, notifications, audit log.
3. Enforce the full requisition workflow server-side: apply → (recommend) → Transport In-Charge assigns vehicles → Transport Administrator approves/rejects per trip → complete → mileage → accounts.
4. Enforce role permissions server-side (RBAC) and department/office scoping for Department Heads.
5. Guarantee a vehicle cannot be double-booked, even with two people working at the same time.
6. Create notifications on the server as a side effect of workflow events.
7. Keep the API shapes close to the frontend types so swapping `localStorage` hooks for API calls is mechanical.

### 2.2 Non-goals (do NOT build)

These were explicitly put on a skip-list by the product owner:

- **Club / Society accounts** and a recommender path for them. (The `Club` requisition type exists as a value in the enum and must be accepted/stored, but no special workflow is built.)
- Automatic derivation of applicant type from the email address.
- Anything about the unverified-account "live session" behaviour beyond what section 8.4 defines.

Also out of scope for the first release: payments/accounts integration (the status `Ready for Accounts` is just a status), SMS, mobile apps, multi-language, real-time websockets (polling is enough).

### 2.3 Users and roles (5 roles)

| Role | Who | Where they work in the frontend |
|---|---|---|
| `Applicant` | Student / Teacher / Officer (profile type in `applicantProfile`) | `/dashboard`, `/apply`, `/my-requisitions`, `/my-mileage`, `/profile-setup` |
| `DepartmentHead` | Head of a department **or** of an office (`headOfDepartment` / `headOfOffice`) | `/admin/recommender…` inbox, "Recommended by me", plus can apply like an applicant |
| `TransportInCharge` | Transport Office officer | `/admin/requisitions` (assign vehicles, forward, send back), vehicles, drivers, schedules, conflicts |
| `TransportAdministrator` | Transport Office approver | `/admin/requisitions` (approve/reject each trip, slips), same management pages |
| `SuperAdmin` | System administrator | `/admin/users` (accounts), read-only oversight of operations |

---

## 3. What the frontend does today

The frontend keeps these collections in `localStorage` (key → meaning). The backend replaces each one:

| localStorage key | Content | Becomes (section 10) |
|---|---|---|
| `sust-transit-users` | all accounts | `users` |
| `sust-transit-otp-challenges` | pending email codes | `otp_challenges` |
| `sust-transit-session` | logged-in user id | JWT access + refresh token |
| `sust-transit-requisitions` | requisitions with nested `trips[]` | `requisitions` + `trips` |
| `sust-transit-allocations` | vehicle/driver per trip | `allocations` (+ `allocation_history`) |
| `sust-transit-vehicles` | fleet | `vehicles` |
| `sust-transit-driver` | drivers | `drivers` |
| `sust-transit-routes` | "student transport" free-after times per weekday | `student_transport_*` |
| (off-days hook) | vehicle off-days | `vehicle_off_days` |
| `sust-transit-duty-slips` | generated duty slips | `duty_slips`, `duty_slip_trips` |
| `sust-transit-confirmation-slips` | generated confirmation slips | `confirmation_slips` |
| `sust-transit-mileage` | mileage per trip | `mileage_entries` |
| `sust-transit-notifications` | bell notifications | `notifications` |
| `sust-transit-conflicts` | legacy, unused (conflicts are computed) | — (computed, no table) |

Pages, and the API they need, are mapped in section 17.

---

## 4. Technology choices

| Concern | Choice | Notes |
|---|---|---|
| Runtime | **Node.js 20 LTS** (or 22 LTS) | ES modules (`"type": "module"`). |
| Language | **TypeScript** (strict) | Matches the frontend; DTO types can be shared. If the implementer prefers plain JS, keep JSDoc types — but TypeScript is the recommendation. |
| Web framework | **Express 4.x** (5.x is acceptable) | Use `express-async-errors` (Express 4) or native async support (Express 5). |
| Database | **MySQL 8.0** (InnoDB, `utf8mb4`, `utf8mb4_0900_ai_ci`) | MySQL 8 is required for `CHECK` constraints, JSON columns and `SKIP LOCKED` if used. |
| DB access | **Knex.js** with `mysql2` | Knex gives migrations, seeds, transactions and a query builder without an ORM's magic. (Prisma or Sequelize are acceptable alternatives only if the implementer commits to them fully — do not mix.) |
| Validation | **Zod** | One schema per endpoint (body, params, query). Validation middleware returns the error format in section 7.4. |
| Password hashing | **argon2id** (`argon2`) or **bcrypt** (`bcryptjs`/`bcrypt`, cost ≥ 12) | Replaces the prototype's fake hash in `utils/passwordUtils.ts`. |
| Tokens | **JWT** access token (15 min) + opaque **refresh token** (7–30 days, stored hashed) in an `httpOnly` cookie | See section 8. Library: `jsonwebtoken` or `jose`. |
| Email | **Nodemailer** (SMTP) | OTP emails. In development print the code to the console (the frontend currently shows a "Dev preview" banner — see 8.2). |
| File upload | **multer** (disk storage) | Signature image and supporting document. See section 14. |
| Security middleware | `helmet`, `cors`, `express-rate-limit`, `cookie-parser`, `hpp` | |
| Logging | **pino** + `pino-http` | JSON logs, request id. |
| Tests | **Vitest** (or Jest) + **Supertest** + a real MySQL (Docker) for integration tests | See section 18. |
| Tooling | ESLint, Prettier, `tsx` for dev, `tsc` for build, Docker + docker-compose for local MySQL | |
| API docs | **OpenAPI 3** file kept in the repo (`docs/openapi.yaml`) generated from or hand-synced with Zod schemas (e.g. `zod-to-openapi`) | SHOULD. |

PDF generation stays **in the frontend** (jsPDF) — see section 15.

---

## 5. Project structure

Create the backend as a **new top-level folder `server/`** in the same repo (monorepo style), so the frontend and backend can share the DTO types if desired. (A separate repo is also fine; the structure below is identical.)

```
server/
├── package.json
├── tsconfig.json
├── .env.example
├── docker-compose.yml            # mysql:8 + (optional) mailhog
├── knexfile.ts
├── docs/
│   └── openapi.yaml
├── migrations/                   # knex migrations, timestamp-ordered (section 10)
│   ├── 001_directory_and_users.ts
│   ├── 002_auth_tables.ts
│   ├── 003_fleet.ts
│   ├── 004_requisitions.ts
│   ├── 005_allocations_slips_mileage.ts
│   ├── 006_notifications_files_audit.ts
│   └── ...
├── seeds/
│   ├── 01_directory_units.ts     # departments + offices (section 16)
│   ├── 02_admin_accounts.ts      # the 3 seeded Transport Office/Super Admin accounts
│   └── 03_demo_data.ts           # optional demo vehicles/drivers (dev only)
├── src/
│   ├── server.ts                 # start HTTP server, graceful shutdown
│   ├── app.ts                    # builds the Express app (no listen) — used by tests
│   ├── config/
│   │   ├── env.ts                # parse + validate process.env with Zod
│   │   └── constants.ts          # OTP length/expiry, limits, enums
│   ├── db/
│   │   ├── knex.ts               # single Knex instance
│   │   └── transaction.ts        # helper: withTransaction(async trx => ...)
│   ├── middleware/
│   │   ├── requestId.ts
│   │   ├── auth.ts               # authenticate (JWT) + requireRole(...)
│   │   ├── validate.ts           # Zod validation → 422
│   │   ├── rateLimit.ts
│   │   ├── upload.ts             # multer configs
│   │   ├── errorHandler.ts       # maps AppError → JSON error
│   │   └── notFound.ts
│   ├── errors/
│   │   └── AppError.ts           # class AppError(status, code, message, details?)
│   ├── modules/
│   │   ├── auth/                 # routes, controller, service, schemas
│   │   ├── users/
│   │   ├── directory/            # departments & offices
│   │   ├── vehicles/
│   │   ├── drivers/
│   │   ├── offDays/
│   │   ├── transportSchedule/    # student-transport free-after times
│   │   ├── requisitions/         # applicant + recommender + TIC + admin actions
│   │   ├── allocations/
│   │   ├── conflicts/
│   │   ├── slips/                # duty + confirmation slip records
│   │   ├── mileage/
│   │   ├── notifications/
│   │   ├── dashboard/            # counts for dashboards
│   │   ├── files/
│   │   └── audit/
│   ├── domain/                   # PURE functions (no DB, no Express) — port from frontend utils
│   │   ├── permissions.ts        # ← src/utils/permissions.ts
│   │   ├── requisitionStatus.ts  # computeApplicationStatus, queues  ← requisitionUtils.ts
│   │   ├── vehicleEligibility.ts # getVehicleEligibility, timeRangesOverlap ← allocationUtils.ts
│   │   ├── conflicts.ts          # detectConflicts ← conflictUtils.ts
│   │   ├── schedule.ts           # weekday, off-day, free-after ← scheduleUtils.ts
│   │   ├── mileage.ts            # eligibility ← mileageUtils.ts
│   │   ├── recommendation.ts     # requiresRecommendation ← authUtils.ts
│   │   ├── validators.ts         # 3-hour hold, route parsing ← validators.ts, routeUtils.ts
│   │   └── applicationNumber.ts  # TRS-YYYY-NNN formatting
│   ├── services/
│   │   ├── mailer.ts
│   │   ├── tokens.ts             # sign/verify JWT, create/rotate refresh tokens
│   │   ├── password.ts           # hash/verify
│   │   ├── otp.ts
│   │   ├── notify.ts             # create notifications (used inside transactions)
│   │   └── audit.ts              # write audit_logs rows
│   └── types/                    # shared DTO + enum types
└── tests/
    ├── unit/                     # domain/*.ts
    ├── integration/              # Supertest per module
    └── helpers/                  # DB reset, factories, auth helpers
```

**Layering rule (MUST):** `routes → controller → service → (domain + db)`.
- Routes only wire middleware + controller.
- Controllers translate HTTP ⇄ service calls (no business logic).
- Services hold use-case logic and own the **database transaction**.
- `domain/` is pure and unit-tested; **port the frontend's utility functions almost line-for-line** (they are already correct and tested by usage), changing only types/imports.

---

## 6. Configuration (environment variables)

`src/config/env.ts` MUST validate these with Zod at start-up and **refuse to boot** if invalid.

```ini
# --- Server ---
NODE_ENV=development            # development | test | production
PORT=4000
API_BASE_PATH=/api/v1
CLIENT_ORIGIN=http://localhost:5173      # exact origin of the Vite frontend (CORS allow-list; comma-separate for several)
TRUST_PROXY=false                        # true when behind a reverse proxy

# --- Database ---
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=sust_transit
DB_PASSWORD=change-me
DB_NAME=sust_transit
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_TIMEZONE=Z                            # store everything in UTC

# --- Auth ---
JWT_ACCESS_SECRET=long-random-string-at-least-32-chars
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_TTL_DAYS=14
REFRESH_COOKIE_NAME=sust_rt
COOKIE_SECURE=false                      # true in production (HTTPS)
COOKIE_SAMESITE=lax                      # lax | strict | none
BCRYPT_COST=12                           # or ARGON2_* params
PASSWORD_MIN_LENGTH=8                    # see 8.1 (frontend uses 6 today — backend raises it; frontend text must be updated)

# --- OTP ---
OTP_LENGTH=6
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_DEV_ECHO=true                        # development ONLY: include code in the API response (see 8.2). MUST be false in production.

# --- Email (SMTP) ---
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
MAIL_FROM="SUST Transport <no-reply@sust.edu>"

# --- Files ---
UPLOAD_DIR=./uploads                     # private directory, NOT served statically
MAX_SIGNATURE_BYTES=1048576              # 1 MB
MAX_DOCUMENT_BYTES=5242880               # 5 MB

# --- Seed ---
SEED_ADMIN_PASSWORD=Admin@123            # dev only; production MUST override and force change on first login
```

Provide `.env.example` with all of the above. Never commit a real `.env`.

---

## 7. API conventions

### 7.1 Base URL, versioning, format

- Base path: `/api/v1`. All bodies are JSON (`Content-Type: application/json`) except file uploads (`multipart/form-data`).
- All timestamps are **ISO-8601 UTC strings** (`2026-10-22T09:02:11.000Z`) in JSON.
- Calendar dates are `YYYY-MM-DD` strings. Times of day are `HH:mm` strings (24 h) — exactly what the frontend uses (`"09:00"`). Store in MySQL as `DATE` and `TIME`, serialise back to these strings.
- IDs are **strings**. Requisitions use the human application number `TRS-YYYY-NNN`. Everything else uses **UUID v4** (`CHAR(36)`).
- JSON keys are camelCase. Unknown keys in request bodies MUST be rejected (`.strict()` Zod objects) so typos don't silently pass.

### 7.2 Success responses

- Single resource: `200`/`201` with the resource object **directly** (no wrapper), shaped like the frontend type.
- Collections: `200` with `{ "data": [...], "meta": { "page": 1, "pageSize": 20, "total": 134 } }` for paginated lists; small reference lists (vehicles, drivers, off-days, directory) MAY return `{ "data": [...] }` unpaginated.
- No-content actions: `204`.

### 7.3 Pagination, filtering, sorting

Query params on list endpoints: `page` (default 1), `pageSize` (default 20, max 100), `sort` (e.g. `createdAt:desc`), plus endpoint-specific filters (`status`, `type`, `from`, `to`, `q`). Validate with Zod and cap `pageSize`.

### 7.4 Error format (MUST be uniform)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable summary",
    "details": [{ "path": "trips.0.startTime", "message": "Required" }],
    "requestId": "b6c1…"
  }
}
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `BAD_REQUEST` | malformed JSON etc. |
| 401 | `UNAUTHENTICATED` | missing/invalid/expired access token |
| 401 | `INVALID_CREDENTIALS` | wrong email or password (same message for both — do not reveal which) |
| 403 | `FORBIDDEN` | role not allowed, or ownership/scope check failed |
| 403 | `ACCOUNT_DEACTIVATED` | `is_active = 0` |
| 403 | `ACCOUNT_NOT_VERIFIED` | verified flag false where verification required |
| 404 | `NOT_FOUND` | no such resource (also used when the user must not learn it exists) |
| 409 | `CONFLICT` | duplicate email/registration number, invalid state transition |
| 409 | `VEHICLE_NOT_ELIGIBLE` | allocation blocked (details = blockers[]) |
| 409 | `INVALID_STATE` | action not allowed in the requisition's current status |
| 422 | `VALIDATION_ERROR` | Zod failure or domain validation (e.g. 3-hour rule) |
| 429 | `RATE_LIMITED` | too many requests / OTP attempts |
| 500 | `INTERNAL_ERROR` | unexpected (log full error, return generic message) |

### 7.5 Concurrency and idempotency

- All multi-row writes run in a **transaction** (`withTransaction`).
- State-changing requisition endpoints MUST re-read the requisition `FOR UPDATE` inside the transaction and check the current status before changing it (prevents two actors acting on stale state).
- Allocation assignment MUST lock the vehicle row (section 11.6) to prevent double-booking.
- Add an optional `Idempotency-Key` header to `POST /requisitions` (store key + response for 24 h) so a double-click or retry does not create two applications. SHOULD.

### 7.6 Naming of action endpoints

State transitions are **verbs as sub-resources**: `POST /requisitions/:id/recommend`, `/send-back`, `/forward`, … not a generic `PATCH status`. The client can never set `status` directly.

---

## 8. Authentication and security

### 8.1 Passwords

- Hash with argon2id or bcrypt (cost ≥ 12). Never log or return hashes.
- Minimum length: the prototype uses 6 (`MIN_PASSWORD_LENGTH`). The backend SHOULD require **8** and the frontend text/validation updated to match. (If the owner wants to keep 6 for now, make it the single constant `PASSWORD_MIN_LENGTH`.)
- Login lockout: after **5** consecutive failures lock the account for **15 minutes** (`failed_login_count`, `locked_until`), reset on success. Return `429`/`INVALID_CREDENTIALS` without revealing the lock to attackers beyond a generic message (a separate `ACCOUNT_LOCKED` with retry-after is acceptable for UX — product decision).

### 8.2 Email OTP (applicant registration)

Port of the frontend `useOtp` hook with the same constants:

- Code: 6 digits, generated with `crypto.randomInt` (NOT `Math.random`).
- TTL: 10 minutes. Max 5 wrong attempts per challenge. One active challenge per email (a new request replaces the old one).
- Store **only a hash** of the code (`code_hash`, e.g. SHA-256 with a per-row salt, or bcrypt) — never the plain code.
- Resend cooldown: 60 s per email; max 5 OTP sends per email per hour; per-IP rate limit as well.
- Send by SMTP. **Development only:** if `OTP_DEV_ECHO=true` the `/auth/register` and `/auth/otp/resend` responses MAY include `devCode` so the existing "Dev preview" banner (`DevCodeNote`) keeps working. In production the field MUST NOT exist and the frontend banner MUST be removed/hidden.
- Verify result reasons (same as frontend `VerifyOtpResult`): `no-challenge`, `expired`, `attempts-exceeded`, `wrong-code`. Map to error codes `OTP_NOT_FOUND`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED`, `OTP_INVALID` (all HTTP 422, except attempts-exceeded = 429).
- On success: set `users.is_verified = 1`, delete the challenge.

### 8.3 Registration and onboarding flow

This is the exact frontend flow, to be reproduced:

1. **Register** (`/register`): applicant enters a **SUST email**. Allowed domains: `sust.edu`, `student.sust.edu` and any sub-domain of them (`isSustEmail`). Reject if the email already exists → `409 EMAIL_TAKEN` ("This email is already registered. Try logging in instead."). Create an **unverified** user row (`is_verified=0`, role `Applicant`, no password) and send an OTP.
2. **Verify** (`/otp`): enter the code → user becomes verified. The API returns an **onboarding token** (short-lived access token with `scope: "onboarding"`, section 8.4).
3. **Profile setup** (`/profile-setup`): applicant sets `applicantProfile` (Teacher/Student/Officer), `fullName`, `mobile`, department/office/designation/registration number (depending on profile — rules in 12.3), **signature image**, and **password**. This completes the account. The frontend then sends them to `/dashboard`.
4. **Login** (`/login`): email + password.

Login edge cases the frontend already handles (reproduce in `POST /auth/login`):
- Unknown email → `401 INVALID_CREDENTIALS`.
- Deactivated (`is_active=0`) → `403 ACCOUNT_DEACTIVATED` ("Contact a Super Admin").
- **Unverified** account → `403 ACCOUNT_NOT_VERIFIED` and the server sends a **new OTP** and returns an onboarding token so the user can finish at `/otp` (frontend navigates to `/otp` with the email).
- Verified but **no password yet** (legacy) → return an onboarding token and `nextStep: "profile-setup"`.
- Wrong password → `401 INVALID_CREDENTIALS`.
- Success → access token + refresh cookie + user object; frontend routes by role: `TransportInCharge | TransportAdministrator | SuperAdmin | DepartmentHead` → `/admin`; `Applicant` → `/dashboard`.

### 8.4 Token model

- **Access token:** JWT, 15 min, claims `{ sub: userId, role, scope: "full" | "onboarding", jti }`. Sent as `Authorization: Bearer <token>`. Kept in memory by the frontend (not localStorage).
- **Onboarding scope:** a token with `scope: "onboarding"` is accepted **only** by: `POST /auth/otp/verify`, `POST /auth/otp/resend`, `GET /auth/me`, `PUT /me/profile` (first-time completion), `POST /me/signature`, `POST /auth/logout`. Every other route requires `scope: "full"`. This closes the "unverified user has a full live session" gap.
- **Refresh token:** random 256-bit value, stored **hashed** in `refresh_tokens`, sent in an `httpOnly; Secure; SameSite` cookie scoped to `/api/v1/auth`. `POST /auth/refresh` rotates it (old one revoked, new one issued). Reuse of a revoked token = revoke the whole family (theft detection). Logout revokes it.
- **Deactivation:** on every authenticated request the `authenticate` middleware MUST load the user (or a cached row ≤ 30 s old) and reject if `is_active = 0` or the account was deleted, so deactivation takes effect within a minute, not at token expiry. Role is also re-read from the DB (do not trust the role claim alone) so a role change by Super Admin applies immediately.
- CSRF: because the access token is in the `Authorization` header and the refresh cookie is only sent to `/auth/*` with `SameSite=lax/strict`, additionally require a custom header (`X-Requested-With: fetch`) on `/auth/refresh` and `/auth/logout`.

### 8.5 Other security requirements

- `helmet()` defaults; CORS allow-list from `CLIENT_ORIGIN` with `credentials: true`.
- Global rate limit (e.g. 300 req / 15 min / IP) + stricter limits on `/auth/login` (10/15 min/IP+email), `/auth/register`, `/auth/otp/*`.
- Request body size limit `100kb` for JSON (uploads have their own limits).
- All SQL parameterised (Knex bindings). No string-built SQL.
- Output encoding is the frontend's job, but sanitise nothing silently — validate lengths: names ≤ 150, purpose ≤ 2000, notes/remarks ≤ 1000, etc.
- Uploaded files: type sniffing (magic bytes), size limits, random server-generated file names, stored outside the web root, served only via authorised endpoints (section 14).
- Never return `password_hash`, OTP data, refresh tokens or internal file paths.
- Do not expose whether an email exists on **login** (generic error). Register is allowed to say "already registered" (matches current UX).
- Audit all privileged actions (section 19.2).
- Dependency hygiene: `npm audit` in CI; pin versions.

---

## 9. Roles and permission matrix

Port `src/utils/permissions.ts` into `src/domain/permissions.ts` and use it in both `requireRole` middleware and service-level checks.

`ADMIN_ROLES = TransportInCharge, TransportAdministrator, SuperAdmin`.
`isAdminRole(role)` = one of those three. (DepartmentHead is **not** an admin role but shares the `/admin` UI shell.)

| Capability | Applicant | DepartmentHead | TransportInCharge | TransportAdministrator | SuperAdmin |
|---|:--:|:--:|:--:|:--:|:--:|
| Register / login / own profile | ✔ | ✔ | ✔ | ✔ | ✔ |
| Create own requisition, save draft, view own, resubmit when returned | ✔ | ✔ (own) | — | — | — |
| See recommendation inbox, recommend / reject / send back (own department/office scope only) | — | ✔ | — | — | — |
| "Recommended by me" history | — | ✔ | — | — | — |
| View all requisitions | — | — | ✔ | ✔ | ✔ (read-only) |
| Assign / change / remove vehicle (+driver) on a trip | — | — | ✔ | — | — |
| Forward to Administrator | — | — | ✔ | — | — |
| Send back to Applicant (with optional note) | — | — | ✔ | — | — |
| Approve / reject / reset a trip decision | — | — | — | ✔ | — |
| Send back to Transport In-Charge (note required) | — | — | — | ✔ | — |
| Generate / regenerate **duty slip** (creates a slip record) | — | — | — | ✔ | — |
| **Download** driver (duty) slip once approved (no new record) | — | — | ✔ | ✔ | — |
| Download **confirmation slip** (requisition owner, once ≥ 1 trip approved) | ✔ (own) | ✔ (own) | — | ✔ | — |
| Mark trip **Completed** | — | — | ✔ | ✔ | — |
| Record **mileage** | — | — | ✔ | ✔ | — |
| Manage vehicles, drivers, off-days, student-transport schedule | — | — | ✔ | ✔ | ✔ |
| View conflicts / reassign / reject-from-conflict | — | — | ✔ | ✔ | view |
| Manage user accounts (create Transport Office accounts, edit role/active, delete other Super Admins) | — | — | — | — | ✔ |
| View dashboards | own | inbox counts | operations | operations | operations |

Notes:
- `isOperationsViewOnly(role)` = SuperAdmin: may read operational pages but **MUST NOT** mutate requisitions, allocations, slips or mileage.
- Ownership rule: an Applicant/DepartmentHead may only read/modify requisitions where `requester_id = me`. Anything else → `404` (not `403`) to avoid leaking existence.
- **Department-Head scope rule** (`scopeMatches`): a DepartmentHead may see/act on a requisition only if the requisition's `department` string equals (case-insensitive, trimmed) the head's `headOfDepartment` **or** `headOfOffice`.
- The Transport In-Charge's mode vs. Administrator's mode on a requisition depends on its status (section 11.2), not only on role: an In-Charge acting on a requisition in the Administrator's queue → `409 INVALID_STATE`.

---

## 10. Database design

MySQL 8, InnoDB, `utf8mb4`. All tables have `created_at`/`updated_at` (`DATETIME(3)`, UTC) unless stated. Use Knex migrations (one file per group). Foreign keys are **enforced**. Booleans are `TINYINT(1)`.

### 10.1 Entity overview

```
directory_units ─┐ (validation list: departments & offices)
users ───< refresh_tokens
users ───< otp_challenges (by email)
users ───< files
users ───< requisitions >─── trips >─── allocations >─── vehicles >─── drivers
                  │             │            │
                  │             │            └── allocation_history
                  │             └── mileage_entries
                  ├── duty_slips >─── duty_slip_trips
                  └── confirmation_slips
users ───< notifications
vehicles ───< vehicle_off_days
vehicles ───< student_transport_vehicles >─── student_transport_slots
(any) ───< audit_logs
requisition_counters (application-number sequence)
```

### 10.2 DDL

> Types are shown in MySQL syntax. The implementer writes the same in Knex migrations. Use `ENUM` for closed sets that match the frontend unions; if the owner expects those lists to change often, replace with lookup tables.

```sql
-- ---------- reference data ----------
CREATE TABLE directory_units (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind        ENUM('Department','Office') NOT NULL,
  name        VARCHAR(200) NOT NULL,
  school      VARCHAR(200) NULL,                -- e.g. "School of Life Sciences" (optional)
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_directory_name (name)           -- department/office names are exact-match keys
);

-- ---------- users & auth ----------
CREATE TABLE users (
  id                  CHAR(36) PRIMARY KEY,
  email               VARCHAR(255) NOT NULL,                       -- always stored lower-case, trimmed
  role                ENUM('Applicant','DepartmentHead','TransportInCharge','TransportAdministrator','SuperAdmin') NOT NULL,
  applicant_profile   ENUM('Teacher','Student','Officer') NULL,
  full_name           VARCHAR(150) NULL,
  mobile              VARCHAR(30)  NULL,
  password_hash       VARCHAR(255) NULL,
  signature_file_id   CHAR(36) NULL,                               -- FK files.id
  student_reg_number  VARCHAR(50)  NULL,
  department          VARCHAR(200) NULL,                           -- must exist in directory_units(kind='Department')
  office              VARCHAR(200) NULL,                           -- must exist in directory_units(kind='Office')
  designation         VARCHAR(150) NULL,
  head_of_department  VARCHAR(200) NULL,                           -- DepartmentHead scope
  head_of_office      VARCHAR(200) NULL,                           -- DepartmentHead scope
  is_verified         TINYINT(1) NOT NULL DEFAULT 0,
  is_active           TINYINT(1) NOT NULL DEFAULT 1,
  failed_login_count  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until        DATETIME(3) NULL,
  last_login_at       DATETIME(3) NULL,
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role (role),
  KEY ix_users_head_dept (head_of_department),
  KEY ix_users_head_office (head_of_office),
  CONSTRAINT fk_users_signature FOREIGN KEY (signature_file_id) REFERENCES files(id) ON DELETE SET NULL
);
-- NOTE: create `files` BEFORE `users` in the migration, or add the signature FK afterwards with ALTER TABLE.

CREATE TABLE otp_challenges (
  id          CHAR(36) PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,
  purpose     ENUM('registration','resume') NOT NULL DEFAULT 'registration',
  expires_at  DATETIME(3) NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_sent_at DATETIME(3) NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_otp_email (email)            -- one active challenge per email (replace on resend)
);

CREATE TABLE refresh_tokens (
  id            CHAR(36) PRIMARY KEY,
  user_id       CHAR(36) NOT NULL,
  family_id     CHAR(36) NOT NULL,           -- rotation family for reuse detection
  token_hash    CHAR(64) NOT NULL,           -- SHA-256 of the opaque token
  expires_at    DATETIME(3) NOT NULL,
  revoked_at    DATETIME(3) NULL,
  replaced_by   CHAR(36) NULL,
  user_agent    VARCHAR(255) NULL,
  ip            VARCHAR(45)  NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_rt_hash (token_hash),
  KEY ix_rt_user (user_id),
  KEY ix_rt_family (family_id),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- files ----------
CREATE TABLE files (
  id             CHAR(36) PRIMARY KEY,
  owner_user_id  CHAR(36) NOT NULL,
  purpose        ENUM('signature','supporting_document') NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(100) NOT NULL,
  size_bytes     INT UNSIGNED NOT NULL,
  storage_name   VARCHAR(100) NOT NULL,      -- random name on disk; never the original name
  sha256         CHAR(64) NOT NULL,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_files_owner (owner_user_id)
);

-- ---------- fleet ----------
CREATE TABLE drivers (
  id           CHAR(36) PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  designation  ENUM('Supervisor Driver','Senior Driver','Driver','Driver (Grade-1)','Driver (Outsourced)') NOT NULL,
  phone        VARCHAR(30) NULL,
  status       ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  -- NOTE: no permanent_vehicle_id column. The link lives ONLY in vehicles.permanent_driver_id
  -- (single source of truth). The API computes driver.permanentVehicleId by joining.
);

CREATE TABLE vehicles (
  id                        CHAR(36) PRIMARY KEY,
  registration_number       VARCHAR(100) NOT NULL,
  category                  ENUM('Jeep','Car','Mitsubishi Bus','Hino Bus','Tata Bus','Eicher Bus','Minibus','Minibus A/C','Microbus','Pickup') NOT NULL,
  fuel_type                 VARCHAR(50) NULL,
  operational_status        ENUM('Active','Under Maintenance','Out-of-Service') NOT NULL DEFAULT 'Active',
  available_for_requisition TINYINT(1) NOT NULL DEFAULT 1,
  permanent_driver_id       CHAR(36) NULL,
  created_at                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_vehicle_reg (registration_number),            -- case-insensitive via the ci collation
  UNIQUE KEY uq_vehicle_driver (permanent_driver_id),         -- a driver has at most one vehicle
  CONSTRAINT fk_vehicle_driver FOREIGN KEY (permanent_driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);
-- "Reserved For" was REMOVED from the product — there is NO reserved_for column. Do not add it.

CREATE TABLE vehicle_off_days (
  id          CHAR(36) PRIMARY KEY,
  vehicle_id  CHAR(36) NOT NULL,
  type        ENUM('One-time','Recurring') NOT NULL,
  off_date    DATE NULL,                                       -- required when type='One-time'
  weekday     ENUM('Sun','Mon','Tue','Wed','Thu','Fri','Sat') NULL,   -- required when type='Recurring'
  reason      VARCHAR(255) NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_offday_vehicle (vehicle_id, off_date),
  CONSTRAINT fk_offday_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT ck_offday_shape CHECK (
    (type = 'One-time'  AND off_date IS NOT NULL AND weekday IS NULL) OR
    (type = 'Recurring' AND weekday  IS NOT NULL AND off_date IS NULL)
  )
);

-- Student-transport schedule: for each vehicle, per weekday, the time it is "free after".
-- A weekday with no row means the vehicle is free all day on that weekday.
CREATE TABLE student_transport_vehicles (
  id          CHAR(36) PRIMARY KEY,
  vehicle_id  CHAR(36) NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_stv_vehicle (vehicle_id),
  CONSTRAINT fk_stv_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);
CREATE TABLE student_transport_slots (
  entry_id    CHAR(36) NOT NULL,
  weekday     ENUM('Sun','Mon','Tue','Wed','Thu','Fri','Sat') NOT NULL,
  free_after  TIME NOT NULL,
  PRIMARY KEY (entry_id, weekday),
  CONSTRAINT fk_sts_entry FOREIGN KEY (entry_id) REFERENCES student_transport_vehicles(id) ON DELETE CASCADE
);

-- ---------- requisitions ----------
CREATE TABLE requisition_counters (
  year         SMALLINT UNSIGNED PRIMARY KEY,
  last_number  INT UNSIGNED NOT NULL
);

CREATE TABLE requisitions (
  id                        VARCHAR(16) PRIMARY KEY,           -- 'TRS-2026-001'
  requester_id              CHAR(36) NOT NULL,
  requester_name            VARCHAR(150) NOT NULL,             -- snapshot at submission
  applicant_profile         ENUM('Teacher','Student','Officer') NULL,   -- snapshot (drives mileage eligibility)
  department                VARCHAR(200) NULL,                 -- snapshot: requester's department OR office name
  contact_number            VARCHAR(30) NULL,
  requisition_type          ENUM('Personal','Departmental/Official','Club') NOT NULL,
  purpose                   TEXT NOT NULL,
  start_date                DATE NULL,                         -- NULL while a Draft has no trips
  end_date                  DATE NULL,
  schedule_type             ENUM('Single') NOT NULL DEFAULT 'Single',
  status                    ENUM('Draft','Pending Recommendation','Information Requested','Recommended',
                                 'Pending on Transport Office','Pending Administrator','Partially Approved',
                                 'Approved','Completed','Ready for Accounts','Rejected') NOT NULL,
  -- recommendation
  recommender_id            CHAR(36) NULL,
  recommender_name          VARCHAR(150) NULL,
  recommender_message       TEXT NULL,
  recommended_at            DATETIME(3) NULL,
  -- send-back to Transport In-Charge (by Administrator)
  transport_office_remarks  TEXT NULL,
  -- send-back to applicant (by In-Charge or Department Head)
  send_back_note            TEXT NULL,
  sent_back_by              VARCHAR(150) NULL,                 -- display label e.g. 'Transport In-Charge'
  sent_back_at              DATETIME(3) NULL,
  resubmitted_at            DATETIME(3) NULL,
  supporting_document_file_id CHAR(36) NULL,
  created_at                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_req_requester (requester_id, created_at),
  KEY ix_req_status (status, created_at),
  KEY ix_req_dept_status (department, status),
  KEY ix_req_recommender (recommender_id),
  CONSTRAINT fk_req_requester   FOREIGN KEY (requester_id)   REFERENCES users(id),
  CONSTRAINT fk_req_recommender FOREIGN KEY (recommender_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_req_doc         FOREIGN KEY (supporting_document_file_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE TABLE trips (
  id                 CHAR(36) PRIMARY KEY,
  requisition_id     VARCHAR(16) NOT NULL,
  position           SMALLINT UNSIGNED NOT NULL,               -- display order (0-based)
  trip_date          DATE NOT NULL,
  start_time         TIME NOT NULL,
  end_time           TIME NOT NULL,
  vehicle_category   ENUM('Jeep','Car','Mitsubishi Bus','Hino Bus','Tata Bus','Eicher Bus','Minibus','Minibus A/C','Microbus','Pickup','Any') NOT NULL DEFAULT 'Any',
  route              VARCHAR(600) NOT NULL,                    -- display string, e.g. 'Campus to Zindabazar and Return to Campus'
  stoppage_sequence  JSON NOT NULL,                            -- ["Campus","Zindabazar","Campus"]
  passenger_groups   JSON NOT NULL,                            -- legacy, always [] for new data
  status             ENUM('Pending','Approved','Rejected','Completed') NOT NULL DEFAULT 'Pending',
  rejection_reason   ENUM('Vehicle unavailable','Driver unavailable','Schedule conflict','Other') NULL,
  rejection_remarks  TEXT NULL,
  created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_trip_req (requisition_id, position),
  KEY ix_trip_date (trip_date),
  CONSTRAINT fk_trip_req FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE,
  CONSTRAINT ck_trip_times CHECK (end_time >= start_time)
);

-- ---------- allocations ----------
CREATE TABLE allocations (
  id              CHAR(36) PRIMARY KEY,
  requisition_id  VARCHAR(16) NOT NULL,
  trip_id         CHAR(36) NOT NULL,
  vehicle_id      CHAR(36) NOT NULL,
  driver_id       CHAR(36) NULL,
  alloc_date      DATE NOT NULL,                      -- copy of trip date (for conflict queries)
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  allocated_by    CHAR(36) NOT NULL,
  allocated_at    DATETIME(3) NOT NULL,
  notes           VARCHAR(500) NULL,
  UNIQUE KEY uq_alloc_trip (trip_id),                 -- one allocation per trip
  KEY ix_alloc_vehicle_date (vehicle_id, alloc_date, start_time),
  KEY ix_alloc_req (requisition_id),
  CONSTRAINT fk_alloc_req     FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE,
  CONSTRAINT fk_alloc_trip    FOREIGN KEY (trip_id)        REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_alloc_vehicle FOREIGN KEY (vehicle_id)     REFERENCES vehicles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_alloc_driver  FOREIGN KEY (driver_id)      REFERENCES drivers(id)  ON DELETE SET NULL,
  CONSTRAINT fk_alloc_by      FOREIGN KEY (allocated_by)   REFERENCES users(id)
);

-- Append-only history (FRD: "allocation/vehicle history must survive later changes")
CREATE TABLE allocation_history (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id         CHAR(36) NOT NULL,
  requisition_id  VARCHAR(16) NOT NULL,
  event           ENUM('assigned','reassigned','removed','released_on_reject','released_on_send_back') NOT NULL,
  vehicle_id      CHAR(36) NULL,
  driver_id       CHAR(36) NULL,
  actor_user_id   CHAR(36) NULL,
  occurred_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_ah_trip (trip_id),
  KEY ix_ah_vehicle (vehicle_id)
);
-- No FK on vehicle_id/trip_id here on purpose: history must survive deletions.

-- ---------- slips ----------
CREATE TABLE duty_slips (
  id               CHAR(36) PRIMARY KEY,
  requisition_id   VARCHAR(16) NOT NULL,
  driver_id        CHAR(36) NULL,
  driver_name      VARCHAR(150) NOT NULL,            -- snapshot
  driver_designation VARCHAR(50) NOT NULL,           -- snapshot
  generated_by     CHAR(36) NOT NULL,
  generated_at     DATETIME(3) NOT NULL,
  superseded_by_id CHAR(36) NULL,                    -- set when a newer slip for same requisition+driver is generated
  KEY ix_ds_req_driver (requisition_id, driver_id, generated_at),
  CONSTRAINT fk_ds_req FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE
);
CREATE TABLE duty_slip_trips (
  duty_slip_id     CHAR(36) NOT NULL,
  trip_id          CHAR(36) NOT NULL,
  vehicle_id       CHAR(36) NULL,
  vehicle_registration_number VARCHAR(100) NOT NULL,  -- SNAPSHOT: fixes the prototype gap where
  vehicle_category VARCHAR(50) NOT NULL,              -- deleting/editing a vehicle blanked old slips
  trip_date        DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  route            VARCHAR(600) NOT NULL,
  PRIMARY KEY (duty_slip_id, trip_id),
  CONSTRAINT fk_dst_slip FOREIGN KEY (duty_slip_id) REFERENCES duty_slips(id) ON DELETE CASCADE
);

CREATE TABLE confirmation_slips (
  id              CHAR(36) PRIMARY KEY,
  requisition_id  VARCHAR(16) NOT NULL,
  generated_by    CHAR(36) NOT NULL,
  generated_at    DATETIME(3) NOT NULL,
  snapshot        JSON NOT NULL,                      -- full slip payload at generation time
  KEY ix_cs_req (requisition_id),
  CONSTRAINT fk_cs_req FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE
);

-- ---------- mileage ----------
CREATE TABLE mileage_entries (
  id              CHAR(36) PRIMARY KEY,
  requisition_id  VARCHAR(16) NOT NULL,
  trip_id         CHAR(36) NOT NULL,
  distance_km     DECIMAL(8,2) NOT NULL,
  recorded_by     CHAR(36) NOT NULL,
  recorded_at     DATETIME(3) NOT NULL,
  UNIQUE KEY uq_mileage_trip (trip_id),               -- one entry per trip
  KEY ix_mileage_req (requisition_id),
  CONSTRAINT fk_mil_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_mil_req  FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE,
  CONSTRAINT ck_mil_pos CHECK (distance_km > 0)
);

-- ---------- notifications ----------
CREATE TABLE notifications (
  id                CHAR(36) PRIMARY KEY,
  recipient_user_id CHAR(36) NOT NULL,                -- every notification has exactly one recipient
  type              VARCHAR(60) NOT NULL,             -- see section 13 (kept as VARCHAR so new types need no migration)
  message           VARCHAR(1000) NOT NULL,
  link_type         ENUM('requisition','conflict','user') NOT NULL,
  link_id           VARCHAR(64) NOT NULL,
  is_read           TINYINT(1) NOT NULL DEFAULT 0,
  read_at           DATETIME(3) NULL,
  dedupe_key        VARCHAR(190) NULL,                -- e.g. 'conflict:<conflictId>:<recipient>' to avoid repeats
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_notif_dedupe (dedupe_key),
  KEY ix_notif_recipient (recipient_user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- audit ----------
CREATE TABLE audit_logs (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id  CHAR(36) NULL,
  actor_role     VARCHAR(40) NULL,
  action         VARCHAR(80) NOT NULL,               -- e.g. 'requisition.forward', 'user.role_changed'
  entity_type    VARCHAR(40) NOT NULL,
  entity_id      VARCHAR(64) NOT NULL,
  before_json    JSON NULL,
  after_json     JSON NULL,
  ip             VARCHAR(45) NULL,
  request_id     VARCHAR(64) NULL,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_audit_entity (entity_type, entity_id, created_at),
  KEY ix_audit_actor (actor_user_id, created_at)
);
```

### 10.3 Integrity rules enforced outside SQL (service layer)

- `users.department` / `office` / `head_of_department` / `head_of_office` MUST exist in `directory_units` with the right `kind` (exact string, because recommendation routing is an exact string match).
- A `DepartmentHead` MUST have at least one of `head_of_department` / `head_of_office`.
- `vehicles.permanent_driver_id` may reference only an **Active** driver who is not already assigned to another vehicle (port of `useVehicleDriverAssignment`). Deactivating a driver clears their vehicle link.
- A vehicle that has **any** allocation (current or historical, from `allocation_history`) **cannot be deleted** (port of `hasAllocationHistory`); retire it via `operational_status='Out-of-Service'` / `available_for_requisition=0`. Because `allocations.vehicle_id` is `ON DELETE RESTRICT` and history rows live in `allocation_history`, check both.
- `allocations.alloc_date/start_time/end_time` are copies of the trip's values; if the applicant's trip can never change after allocation (it cannot — send-back clears allocations first), no re-sync is needed.

### 10.4 Application-number generation (`TRS-YYYY-NNN`)

Port of `generateApplicationNumber`, but **atomic** (the prototype's "highest + 1 in memory" is race-prone):

```sql
INSERT INTO requisition_counters (year, last_number) VALUES (?, 1)
  ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1);
-- then read LAST_INSERT_ID() (or SELECT ... FOR UPDATE) → NNN
```

Format: `TRS-${year}-${String(n).padStart(3,'0')}` (so `TRS-2026-001`, widening naturally past 999). The year is the **server's** current year in the configured university timezone (`Asia/Dhaka`). The number is assigned **when the draft/requisition is first created on the server**, inside the same transaction as the insert. (The frontend currently shows the number in the form header before submit; the backend adds `GET /requisitions/next-number` as a *preview only* — see 12.7 — the real number is assigned on create and the response is authoritative.)

---

## 11. Domain rules and state machines

### 11.1 Enumerations (single source of truth — put in `config/constants.ts`)

- `RequisitionType`: `Personal`, `Departmental/Official`, `Club`
- `ApplicationStatus`: `Draft`, `Pending Recommendation`, `Information Requested`, `Recommended`, `Pending on Transport Office`, `Pending Administrator`, `Partially Approved`, `Approved`, `Completed`, `Ready for Accounts`, `Rejected`
- `TripStatus`: `Pending`, `Approved`, `Rejected`, `Completed`
- `RejectionReason`: `Vehicle unavailable`, `Driver unavailable`, `Schedule conflict`, `Other`
- `RequestedVehicleCategory`: the 10 vehicle categories **or** `Any`
- `Weekday`: `Sun Mon Tue Wed Thu Fri Sat` (the week is indexed `Sun=0` as in JS `Date#getDay`)

### 11.2 Requisition lifecycle (state machine)

```
                     ┌──────────── Save Draft ───────────┐
                     ▼                                    │
  (create)──▶ [Draft] ──submit──┬─ needs recommendation ─▶ [Pending Recommendation]
                                │                              │  Dept Head acts
                                │      ┌── recommend ──────────┤
                                │      ▼                       ├── reject ──────▶ [Rejected]
                                │  [Recommended]               └── send back ──▶ [Information Requested]
                                │      │                                              │ applicant edits + resubmits
                                └─ no recommendation needed ──▶ [Pending on Transport Office] ◀─┘ (routing rule below)
                                       │ (also from Recommended)            ▲
                  TIC: assign vehicles ─┤                                   │ Administrator "send back to TIC"
                  TIC: send back ───────┼──▶ [Information Requested]        │ (all trips reset to Pending, allocations released)
                  TIC: forward ─────────┘──▶ [Pending Administrator] ───────┘
                                                  │ Administrator decides each trip
                                                  ▼
          [Pending Administrator] ─(some trips decided)─▶ [Partially Approved] ─(all decided)─▶ [Approved] / [Partially Approved] / [Rejected]
                                                  │
        trips Approved → TIC/Admin marks each Completed → when none Approved/Pending remain → [Completed]
        mileage-eligible requisitions: when mileage recorded for every Completed trip → [Ready for Accounts]
```

**Allowed transitions (the service MUST enforce exactly these; everything else → `409 INVALID_STATE`):**

| # | Action | From status | To status | Actor |
|---|---|---|---|---|
| 1 | Create draft | — | `Draft` | requester |
| 2 | Submit | `Draft` | `Pending Recommendation` **or** `Pending on Transport Office` (rule 11.3) | requester |
| 3 | Edit draft | `Draft` | `Draft` | requester |
| 4 | Recommend | `Pending Recommendation` | `Recommended` | Department Head in scope |
| 5 | Reject (by head) | `Pending Recommendation` | `Rejected` | Department Head in scope |
| 6 | Send back (by head) | `Pending Recommendation` | `Information Requested` | Department Head in scope (note **required**) |
| 7 | Send back (by In-Charge) | `Recommended`, `Pending on Transport Office` | `Information Requested` | TransportInCharge (note **optional**) |
| 8 | Resubmit | `Information Requested` | `Pending Recommendation` or `Pending on Transport Office` (rule 11.4) | requester |
| 9 | Forward | `Recommended`, `Pending on Transport Office` | `Pending Administrator` | TransportInCharge (every non-rejected trip has an allocation) |
| 10 | Approve / reject / reset a trip | `Pending Administrator`, `Partially Approved` | recomputed (11.5) | TransportAdministrator |
| 11 | Send back to In-Charge | `Pending Administrator`, `Partially Approved` | `Pending on Transport Office` | TransportAdministrator (note **required**) |
| 12 | Complete trip | requisition in `Approved`, `Partially Approved`, `Completed` (the trip must be `Approved`) | `Completed` when settled (11.7) | TIC or Administrator |
| 13 | Record mileage | after all (mileage-eligible) trips `Completed` | `Ready for Accounts` when the last Completed trip gets mileage | TIC or Administrator |

Every transition writes an `audit_logs` row and creates notifications (section 13), all in **one DB transaction**.

### 11.3 Who needs a recommendation (port of `requiresRecommendation`)

```
requiresRecommendation(profile, requisitionType, role):
  if role == 'DepartmentHead'                  → false   // a head is their own recommender → goes straight to the Transport Office
  if requisitionType != 'Departmental/Official' → false   // Personal and Club never need one
  return profile in ('Student','Teacher','Officer')
```
So on submit: `needs ? 'Pending Recommendation' : 'Pending on Transport Office'`. Computed **server-side** from the stored profile — never from a client-supplied flag.

### 11.4 Resubmission routing (what happens after "Information Requested")

A returned requisition may be edited (all editable fields, section 12.7) and resubmitted. Routing rule:

- If the requisition **already has a `recommender_id`** (a Department Head recommended it earlier, then the Transport In-Charge sent it back) → status becomes **`Pending on Transport Office`** (recommendation is kept; do not ask the head again).
- Otherwise apply the normal rule 11.3 (e.g. a head sent it back before recommending → goes to `Pending Recommendation` again).

On resubmission: keep `id` and `created_at`; replace trips (new trips start `Pending`; reuse the old trip ids where the client sends them); set `resubmitted_at = now`; clear `send_back_note`, `sent_back_by`, `sent_back_at`, `transport_office_remarks`. Any allocations were already released at send-back. Only the **owner** may resubmit and only from `Information Requested`.

### 11.5 Derived requisition status from trips (port of `computeApplicationStatus`)

After every trip approve/reject/reset:

```
if no trips                 → keep current status
allApproved  → 'Approved'
allRejected  → 'Rejected'
anyDecided (some trip != 'Pending') → 'Partially Approved'
else keep current status
```

**Queues (port of `requisitionUtils.ts`):**
- In-Charge queue: status ∈ {`Recommended`, `Pending on Transport Office`}.
- Administrator queue: status = `Pending Administrator` **or** (`Partially Approved` **and at least one trip is still `Pending`**).
  > The frontend currently treats *every* `Partially Approved` requisition as being in the Administrator queue, so a finished mixed approve/reject requisition never leaves the queue. The backend MUST use the stricter rule above, and the frontend helper `isInTransportAdministratorQueue` should be changed to match (see 20).
- "Active queue" = In-Charge queue ∪ Administrator queue.

### 11.6 Vehicle allocation rules and double-booking protection

**Eligibility (port of `getVehicleEligibility`).** A vehicle can be assigned to a trip only if there are **no blockers**:

1. Vehicle `operational_status = 'Active'` **and** `available_for_requisition = 1`.
2. The vehicle has a **permanent driver** assigned (`permanent_driver_id` not null). The allocation's `driver_id` defaults to it. (Blocker text: "No permanent driver assigned to this vehicle".)
3. No **off-day** for that vehicle on the trip date: a `One-time` row matching `off_date = trip.date`, or a `Recurring` row whose weekday equals the trip date's weekday.
4. No **overlapping allocation** for the same vehicle on the same date. Overlap = `startA < endB AND startB < endA` (strict, so back-to-back trips `09:00–11:00` and `11:00–13:00` do **not** overlap). When reassigning, exclude the trip's own current allocation.
5. **Student-transport schedule:** if the vehicle has a "free after" time for that weekday and `trip.startTime < freeAfter` → blocker ("Used for student transport … not free yet").

**Warnings (do not block, returned to the UI):** requested category ≠ vehicle category (when the trip asked for a specific category, i.e. not `Any`).

**Server enforcement.** `POST /trips/:tripId/allocation` MUST:

1. Start a transaction.
2. `SELECT … FROM vehicles WHERE id = ? FOR UPDATE` — **locks the vehicle row** so two In-Charge users assigning the same vehicle at the same time are serialised.
3. Re-load the trip + requisition (`FOR UPDATE` on the requisition) and verify the requisition is in the In-Charge queue and the trip is not `Rejected`.
4. Run the eligibility function against fresh data inside the transaction. Any blocker → rollback, `409 VEHICLE_NOT_ELIGIBLE` with `details: { blockers: [...], warnings: [...] }`.
5. Insert/replace the allocation (unique on `trip_id`), copy date/times from the trip, write `allocation_history` (`assigned` or `reassigned`), commit.

The frontend's "Assign Vehicle" picker should call the **eligibility endpoint** (12.9) to list vehicles with `eligible/blockers/warnings`, so the UI and the server agree.

**Forwarding (port of `canForwardToAdministrator`):** every trip whose status ≠ `Rejected` MUST have an allocation; otherwise `409 INVALID_STATE` with the list of trips missing a vehicle.

**Allocation lifecycle side-effects:**
- Trip **rejected** by the Administrator → delete its allocation (history event `released_on_reject`).
- **Send back to applicant** (by In-Charge or head) → delete **all** allocations of the requisition (`released_on_send_back`).
- **Send back to In-Charge** (by Administrator) → delete all allocations of the requisition, reset every trip to `Pending` and clear rejection fields.
- **Reset trip decision** → trip back to `Pending`; the allocation is **kept** (the Administrator can re-decide with the same vehicle).
- Approving a trip does not change its allocation.

### 11.7 Trip completion

- Only a trip with status `Approved` can be marked `Completed` (`Approved → Completed`), by In-Charge or Administrator.
- It is independent of mileage (spec: "completion status and mileage stored separately").
- After marking, if **no trip is left `Approved` or `Pending`** and the requisition is not already `Ready for Accounts` → requisition status becomes `Completed`.
- A duty slip is **not** generated for `Completed` trips (only `Approved` ones), but historical slips remain visible.

### 11.8 Mileage (port of `mileageUtils.ts`)

- **Eligible requisitions:** `requisition_type = 'Personal'` **and** `applicant_profile ∈ {Teacher, Officer}` (snapshot on the requisition). Students and non-personal requisitions are not mileage-eligible.
- Mileage can only be recorded for a trip that is **`Completed`**, has an **allocation**, and has no mileage entry yet.
- One entry per trip (`UNIQUE trip_id`), `distanceKm > 0`.
- When every `Completed` trip of the requisition has an entry → requisition status `Ready for Accounts` (status is only set from `Completed`/`Approved`/`Partially Approved` states; never regress from `Ready for Accounts`).
- Applicant's "My Mileage" shows, per requisition: `not-applicable | not-ready | awaiting | recorded(totalKm)` — compute with the same logic in the API (`mileageStatus` field on the requisition list) so the client doesn't need all entries.

### 11.9 Conflict detection (port of `detectConflicts`)

Conflicts are **computed**, never stored. For every allocation (joined with its requisition/trip/vehicle) produce, all with `severity: "Blocking"`:

| Type | Condition |
|---|---|
| `Vehicle Unavailable` | vehicle is not `Active`, or `available_for_requisition = 0`, while still allocated |
| `Off-Day Conflict` | off-day exists for the vehicle on the allocation date |
| `Vehicle Double-Booked` | two allocations same vehicle + same date + overlapping times (report each pair once — use `allocation.id < other.id`) |
| `Student Transport Conflict` | allocation start time is before the vehicle's "free after" time that weekday |

Conflict `id` = `<type-prefix>-<allocationId>` (`unavailable-…`, `offday-…`, `double-<a>-<b>`, `student-transport-…`) — stable so notifications can dedupe.

**Conflict actions (Transport Office staff):**
- **Reject trip** → same as an Administrator reject with reason `Schedule conflict`, remarks "Rejected due to a detected conflict", and the allocation is removed. (The frontend lets staff do this from the Conflicts page. Backend: allow `TransportInCharge` and `TransportAdministrator`; log in audit.)
- **Reassign vehicle** → same endpoint as assigning a vehicle (11.6), replacing the allocation.

**Conflict notifications.** The frontend bell currently creates "Conflict" notifications on the client. Move this to the server: after any event that can create a conflict (vehicle status/availability change, off-day created, schedule changed, allocation created/changed), run `detectConflicts` for the affected vehicle/date and, for each **new** conflict, create a `Conflict` notification for every active `TransportInCharge` and `TransportAdministrator` using `dedupe_key = conflict:<conflictId>:<recipientId>` so it fires only once.

### 11.10 The 3-hour hold limit and route rules (port of `validators.ts`, `routeUtils.ts`)

- Trip duration: `end ≥ start` and `(end − start) ≤ 3 hours` (`isWithinHoldWindow`). Violation → `422` with `details.path = trips.N.endTime`, message "This trip exceeds the 3-hour vehicle-hold limit." (Spec §4.) A trip may not cross midnight.
- Each trip requires `date`, `startTime`, `endTime`.
- **Personal** requisitions: **exactly one trip**; the client sends a `destination`; the server builds `stoppageSequence = ["Campus", destination, "Campus"]` and `route = "Campus to {destination} and Return to Campus"`.
- **Departmental/Official** (and Club): one or more trips; each has a `routeText` parsed into stops. Parse separators: `->`, `→`, `=>`, `—>`, `>`, or newline (regex `\s*(?:->|→|=>|—>|>)\s*|\s*\r?\n\s*`); trim and drop empties; **at least 2 stops**. `route = stoppageSequence.join(" → ")`.
- `startDate = endDate = first trip's date` (the frontend sets both to the first trip date; `scheduleType` is always `Single`).
- `passengerGroups` is always `[]` for new requisitions (legacy field).
- Vehicle category on a trip: a valid category or `Any`.
- **Trip dates may not be in the past** (SHOULD; the prototype did not check — product owner to confirm, see 20).

### 11.11 Department Head scoping and routing

- The requisition's `department` is a **snapshot** of the requester's `department` (or `office` for officers): `department ?? office`.
- Recommendation recipients (`findDepartmentHeadsForRequisition`): all users with `role = DepartmentHead`, `is_verified = 1`, `is_active = 1` whose `head_of_department` or `head_of_office` equals the requisition's `department` (case-insensitive, trimmed). If there are none, the submission still succeeds but the status stays `Pending Recommendation`; additionally notify all `SuperAdmin`s ("No Department Head is configured for {department}") so it is not lost. (Product owner may prefer blocking submission — see 20.)
- "Recommended by me" = `recommender_id = me`.
- The inbox = `status = 'Pending Recommendation'` **and** scope matches. A head must not see their **own** requisition in their inbox.

---

## 12. API specification

Conventions for this section: `Auth` column = who may call it (`public`, `any` = any logged-in full-scope user, or a role list). All routes are under `/api/v1`. "Body"/"Response" shapes are TypeScript-style; fields marked `?` are optional. Every endpoint validates input with Zod and returns the error format of 7.4.

### 12.1 Auth — `/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | Start applicant registration, send OTP |
| POST | `/auth/otp/verify` | public (email + code) | Verify OTP, return onboarding token |
| POST | `/auth/otp/resend` | public | Send a new OTP (cooldown) |
| POST | `/auth/login` | public | Email + password login |
| POST | `/auth/refresh` | cookie | Rotate refresh token, new access token |
| POST | `/auth/logout` | any / onboarding | Revoke refresh token |
| GET | `/auth/me` | any / onboarding | Current user (+ `nextStep`) |

**`POST /auth/register`** — body `{ email: string }`.
Rules: lowercase+trim; must pass `isSustEmail` (else `422 EMAIL_DOMAIN_NOT_ALLOWED`, message "Use your SUST email address (e.g. name@student.sust.edu)"); if a **verified** user exists → `409 EMAIL_TAKEN`; if an **unverified** user exists → reuse it (resend OTP) instead of failing. Creates `users(role='Applicant', is_verified=0)` and the OTP challenge. Response `202 { email, otpExpiresAt, resendAvailableAt, devCode? }`.

**`POST /auth/otp/verify`** — body `{ email, code }` → `200 { onboardingToken, user }`; errors per 8.2. Marks verified.

**`POST /auth/login`** — body `{ email, password }`. Behaviour exactly as 8.3. Response `200 { accessToken, expiresIn, user }` + `Set-Cookie` refresh. For the unverified/no-password cases: `200 { onboardingToken, nextStep: "otp" | "profile-setup", user }` (not an error, so the frontend can route).
`user` object (`PublicUser`): `{ id, email, role, applicantProfile?, fullName?, mobile?, studentRegNumber?, department?, office?, designation?, headOfDepartment?, headOfOffice?, hasSignature: boolean, signatureUrl?: "/api/v1/files/<id>", isVerified, isActive, createdAt }` (never the hash).

**`GET /auth/me`** → `PublicUser` plus `nextStep?: "otp" | "profile-setup"` when onboarding incomplete.

### 12.2 Directory — `/directory`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/directory/departments` | public | `{ data: string[] }` (names, sorted) |
| GET | `/directory/offices` | public | `{ data: string[] }` |

(The frontend's `DEPARTMENTS` / `OFFICES` constants in `src/data/sustDirectory.ts` become this data — seeded from that file, section 16.)

### 12.3 Profile — `/me`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/me` | any | Own profile |
| PUT | `/me/profile` | any / onboarding | Complete or update profile |
| POST | `/me/signature` | any / onboarding | Upload signature image (multipart `file`) |
| PUT | `/me/password` | any | Change password (`{ currentPassword, newPassword }`) |

**`PUT /me/profile`** body `{ applicantProfile?, fullName, mobile, department?, office?, designation?, studentRegNumber?, password? }`.
Validation (port of `ProfileSetupPage`):
- `fullName`, `mobile` required; a signature must exist (uploaded first) — **required to complete** onboarding.
- By profile: **Student** → `department` + `studentRegNumber` required. **Teacher** → `department` + `designation` required. **Officer** → `office` + `designation` required.
- `department`/`office` MUST exist in the directory (exact name).
- `password` required **only during first-time completion** (account has no password yet); ≥ `PASSWORD_MIN_LENGTH`; hash it.
- For Transport Office/Super Admin/DepartmentHead accounts: only `fullName`, `mobile`, (and `password` change via `/me/password`) are editable; role-scope fields are not editable here.
- The prototype had "profile-locked" fields feature **temporarily disabled**; the backend lets users edit their own profile fields (no lock) for now.
- Changing `department`/`office` does **not** change existing requisitions (they hold snapshots).
Response: `PublicUser`.

**`POST /me/signature`** multipart `file` (PNG/JPEG, ≤ 1 MB). Replaces the previous signature file. Response `{ hasSignature: true, signatureUrl }`. (The frontend sends the signature as a data URL today; for the first iteration the server MAY also accept `{ signatureDataUrl }` JSON and convert it to a file — see 14.)

### 12.4 Users (Super Admin) — `/users`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/users` | SuperAdmin | List all accounts (filters `role`, `isActive`, `q`; paginated) |
| POST | `/users` | SuperAdmin | **Add Transport Office account** |
| PATCH | `/users/:id` | SuperAdmin | Edit name/email/mobile/role/active/head scope |
| DELETE | `/users/:id` | SuperAdmin | Delete (only other Super Admin accounts) |

**`POST /users`** body `{ fullName, email, role: 'TransportInCharge'|'TransportAdministrator'|'SuperAdmin', password }`.
Rules (port of `UsersPage` create form): name+email required; email unique (`409`); password ≥ min length; account is created **verified + active**, skipping OTP ("appointed internally by a Super Admin"). Audit `user.created`.

**`PATCH /users/:id`** body `{ fullName?, email?, mobile?, role?, isActive?, headOfDepartment?, headOfOffice? }`.
Rules (port of `rowLockFor` + `handleSaveEdit`):
- Email unique among other users.
- **Cannot change your own role or active status** (`403 FORBIDDEN`, "You can't change your own role or active status here.").
- **Cannot remove the last active SuperAdmin** — block demoting/deactivating when `role='SuperAdmin' AND is_active=1` and the count of active SuperAdmins is ≤ 1 (`409`).
- If new role is `DepartmentHead`, require `headOfDepartment` or `headOfOffice` (both validated against directory).
- When `role` or `isActive` changes: create an `Account Status Changed` notification for that user with message `Your account was {reactivated|deactivated}[ and ]role changed to {role} by a Super Admin.` Deactivation also **revokes all refresh tokens** of the user. Audit `user.updated` / `user.role_changed` / `user.deactivated` with before/after.

**`DELETE /users/:id`** — only if target `role = SuperAdmin` and target ≠ caller (prototype rule: "Delete is only available for other Super Admin accounts"). Else `403`. Because other tables reference users, prefer a **soft rule**: refuse delete if the user owns requisitions; for Super Admins (who own none) hard delete is fine. Audit `user.deleted`.

### 12.5 Vehicles — `/vehicles`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/vehicles` | any admin role | List (filters `q`, `category`, `status`) |
| GET | `/vehicles/:id` | any admin role | One vehicle (+ driver, off-days) |
| POST | `/vehicles` | TIC, TA, SuperAdmin | Create |
| PATCH | `/vehicles/:id` | TIC, TA, SuperAdmin | Update |
| DELETE | `/vehicles/:id` | TIC, TA, SuperAdmin | Delete (blocked if it has allocation history) |

Vehicle JSON: `{ id, registrationNumber, category, fuelType?, operationalStatus, availableForRequisition, permanentDriverId? }` — **no `reservedFor`** (removed feature).
Rules:
- `registrationNumber` trimmed, **upper-cased**, unique case-insensitively (`409 DUPLICATE_REGISTRATION`; port of `isDuplicateRegistration`).
- `category` ∈ the 10 values; `operationalStatus` ∈ `Active | Under Maintenance | Out-of-Service`.
- Setting `permanentDriverId`: the driver must exist, be `Active`, and not be the permanent driver of another vehicle (`409`). Changing it moves the link (old driver freed) — in one transaction (port of `useVehicleDriverAssignment`).
- **Delete** blocked with `409 VEHICLE_HAS_HISTORY` if any allocation or `allocation_history` row references it; otherwise allowed (off-days and schedule entries cascade).
- On update of `operationalStatus` or `availableForRequisition`, run conflict detection for that vehicle (11.9) and raise `Conflict` notifications.
- Read access note: Applicants/DepartmentHeads never call vehicle endpoints; they only get vehicle info embedded in their own requisition detail (registration + category + driver name for approved trips).

### 12.6 Drivers — `/drivers`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/drivers` | any admin role | List (`status`, `q`) |
| POST | `/drivers` | TIC, TA, SuperAdmin | Create |
| PATCH | `/drivers/:id` | TIC, TA, SuperAdmin | Update |
| POST | `/drivers/:id/deactivate` | TIC, TA, SuperAdmin | `status=Inactive` and clear vehicle link |
| POST | `/drivers/:id/activate` | TIC, TA, SuperAdmin | `status=Active` |
| DELETE | `/drivers/:id` | TIC, TA, SuperAdmin | Delete (blocked if referenced by any allocation or slip) |

Driver JSON: `{ id, name, designation, phone?, status, permanentVehicleId? }` (`permanentVehicleId` is **computed** from `vehicles.permanent_driver_id`).
Deactivating a driver that is a vehicle's permanent driver clears `vehicles.permanent_driver_id`.

### 12.7 Requisitions — applicant and Department Head

Requisition JSON (matches the frontend `Requisition` type + the new send-back fields):

```ts
interface RequisitionDto {
  id: string;                       // "TRS-2026-001"
  requesterId: string;
  requesterName: string;
  applicantProfile?: "Teacher"|"Student"|"Officer";
  department?: string;
  contactNumber?: string;
  requisitionType: "Personal"|"Departmental/Official"|"Club";
  purpose: string;
  startDate: string; endDate: string;       // YYYY-MM-DD ("" for an empty draft)
  scheduleType: "Single";
  status: ApplicationStatus;
  recommenderId?: string; recommenderName?: string;
  recommenderMessage?: string; recommendedAt?: string;
  transportOfficeRemarks?: string;
  sendBackNote?: string; sentBackBy?: string; sentBackAt?: string; resubmittedAt?: string;
  supportingDocumentName?: string;
  supportingDocumentUrl?: string;           // "/api/v1/files/<id>" (replaces supportingDocumentDataUrl)
  createdAt: string;
  trips: TripDto[];
  mileageStatus?: { kind: "not-applicable"|"not-ready"|"awaiting"|"recorded"; distanceKm?: number };
}
interface TripDto {
  id: string; date: string; startTime: string; endTime: string;
  vehicleCategory: string; route: string; stoppageSequence: string[]; passengerGroups: string[];
  status: "Pending"|"Approved"|"Rejected"|"Completed";
  rejectionReason?: string; rejectionRemarks?: string;
  allocation?: { id: string; vehicleId: string; vehicleRegistrationNumber: string; vehicleCategory: string; driverId?: string; driverName?: string; driverPhone?: string };  // only included for admin roles, and for the owner once the trip is Approved/Completed
}
```

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/requisitions/next-number` | any | Preview the next application number (display only) |
| POST | `/requisitions` | Applicant, DepartmentHead | Create (draft or submitted) |
| GET | `/requisitions/mine` | Applicant, DepartmentHead | Own requisitions (newest first) |
| GET | `/requisitions/:id` | owner / scoped head / admin roles | Detail |
| PUT | `/requisitions/:id` | owner | Edit a `Draft` |
| POST | `/requisitions/:id/submit` | owner | Submit a `Draft` |
| PUT | `/requisitions/:id/resubmit` | owner | Edit + resubmit when `Information Requested` |
| DELETE | `/requisitions/:id` | owner | Delete own `Draft` only |
| POST | `/requisitions/:id/supporting-document` | owner | Upload/replace file (multipart) while Draft/Information Requested |

**`POST /requisitions`** body:
```ts
{
  mode: "draft" | "submit",
  requisitionType: RequisitionType,
  purpose: string,                 // required when mode = submit
  declarationConfirmed: boolean,   // MUST be true when mode = submit
  transportUser?: { fullName: string; designation?: string; mobile: string },  // present when "same as requester" is unchecked
  trips: Array<{
    id?: string,
    date: string, startTime: string, endTime: string,
    vehicleCategory: RequestedVehicleCategory,
    destination?: string,          // Personal only
    routeText?: string             // Departmental/Official & Club only
  }>
}
```
Server logic:
1. Requester = the authenticated user (never taken from the body). Snapshot: `requesterName = fullName || email`, `applicantProfile`, `department = user.department ?? user.office`, `contactNumber = user.mobile ?? transportUser.mobile`.
2. If `mode = draft`: **no trip validation, trips are not required** (the frontend currently stores a draft with an empty trips array — keep that); status `Draft`. Persist whatever valid pieces were sent (recommended: store trips if provided so a draft can be resumed — improvement over the prototype).
3. If `mode = submit`: validate everything (rules below), generate the number (10.4), compute initial status (11.3), insert requisition + trips, create notifications (13), audit.
4. Validation on submit (all return `422 VALIDATION_ERROR` with per-field `details`):
   - `purpose` non-empty (≤ 2000).
   - `declarationConfirmed === true` (message "You must confirm the declaration before submitting.").
   - If `transportUser` provided (not "same as requester"): `fullName` and `mobile` required.
   - Each trip: date, start, end required; hold limit ≤ 3 h; `Personal` → exactly 1 trip + `destination` required; others → `routeText` with ≥ 2 stops.
   - `Personal` with more than one trip → `422`.
   - Requester's profile must be complete (`fullName`, `mobile`, signature, profile fields) — else `409 PROFILE_INCOMPLETE`.
5. Student default: for `applicantProfile = Student` the UI defaults the type to `Departmental/Official`; the server does **not** forbid other types (product owner to confirm whether Students may request `Personal` — see 20).
Response `201 RequisitionDto`.

**`GET /requisitions/mine`** → `{ data: RequisitionDto[] }`; includes `mileageStatus`; the owner sees `sendBackNote` etc.

**`GET /requisitions/:id`** access rules: owner always; `DepartmentHead` when `scopeMatches`; `TransportInCharge`/`TransportAdministrator`/`SuperAdmin` always; else `404`.

**`PUT /requisitions/:id`** — owner, `Draft` only; same body as create with `mode` ignored; recomputes trips fully.

**`PUT /requisitions/:id/resubmit`** — owner, status must be `Information Requested`; same editable fields as create; applies 11.4. Notifications: if routed to recommender → heads get `Resubmission`; else all active `TransportInCharge` get `Resubmission` ("{name} resubmitted a corrected requisition"). Response `RequisitionDto`.

**Supporting document:** optional, one file (PDF/PNG/JPG, ≤ 5 MB). Visible to the owner and Transport Office staff and the scoped Department Head. Not part of any slip.

### 12.8 Requisitions — Department Head (recommender)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/recommender/inbox` | DepartmentHead | `Pending Recommendation` in my scope (excluding my own) |
| GET | `/recommender/history` | DepartmentHead | Requisitions with `recommender_id = me` ("Recommended by me") |
| GET | `/recommender/inbox/count` | DepartmentHead | `{ count }` for the nav badge |
| POST | `/requisitions/:id/recommend` | DepartmentHead | `{ message?: string }` |
| POST | `/requisitions/:id/reject` | DepartmentHead | `{ reason: RejectionReason, remarks?: string }` |
| POST | `/requisitions/:id/send-back-to-applicant` | DepartmentHead **or** TransportInCharge | see below |

Rules:
- Recommend: status must be `Pending Recommendation`; head in scope; stamps `recommender_id/name/message/recommended_at`; status → `Recommended`; notify all active **TransportInCharge** (`New Requisition`, message "{requester} 's requisition was recommended by {head} and is awaiting Transport Office review. Message: "…""), and the applicant (`Recommendation`, "Your requisition was recommended by {head} and forwarded to the Transport Office.").
- Reject: reason required, remarks optional; status → `Rejected` (terminal); **only the applicant is notified** (`Recommendation`: "Your requisition was rejected by {head}: {reason} — {remarks}"). The Transport Office is **not** notified.
- Send back by a head: `remarks` **required** (non-empty); status → `Information Requested`; trips reset to `Pending`; stores `send_back_note`, `sent_back_by = <head name>`, `sent_back_at`; applicant notified (`Sent Back to Applicant`). Transport Office not notified.
- Send back by TransportInCharge (**note optional**): body `{ note?: string }`; allowed from `Recommended` and `Pending on Transport Office` only; **releases all allocations**; stores `send_back_note` (null if empty), `sent_back_by = "Transport In-Charge"`, `sent_back_at`; applicant notified (`Sent Back to Applicant`): with note → "Your requisition was sent back by the Transport In-Charge for correction: {note}"; without note → "Your requisition was sent back by the Transport In-Charge for correction. Please review it, edit and resubmit." A missing note MUST still succeed.
- Both send-back callers use the same endpoint; the **role in the token decides** which rules apply (head: note required + status `Pending Recommendation` + scope; In-Charge: note optional + the other statuses).

### 12.9 Requisitions — Transport Office

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/requisitions` | TIC, TA, SuperAdmin | List with `tab=queue|approved|rejected|all`, `type`, `status`, `from`, `to`, `q`, paging |
| GET | `/admin/requisitions/:id` | same | Detail incl. allocations, slips history, mileage |
| GET | `/trips/:tripId/vehicle-options` | TIC | Vehicles with `{eligible, blockers[], warnings[]}` for the trip |
| PUT | `/trips/:tripId/allocation` | TIC | Assign or change vehicle (+ driver) |
| DELETE | `/trips/:tripId/allocation` | TIC | Remove assignment |
| POST | `/requisitions/:id/forward` | TIC | Forward to Administrator |
| POST | `/trips/:tripId/approve` | TA | Approve trip |
| POST | `/trips/:tripId/reject` | TA | `{ reason, remarks? }` |
| POST | `/trips/:tripId/reset-decision` | TA | Back to Pending |
| POST | `/requisitions/:id/send-back-to-in-charge` | TA | `{ remarks }` required |
| POST | `/trips/:tripId/complete` | TIC, TA | Mark Completed |

Tabs for the queue listing (port of the page): `queue` = the caller's role queue (TIC → In-Charge queue; TA → Administrator queue; SuperAdmin → all active); `approved` = status ∈ {`Approved`,`Completed`,`Ready for Accounts`}; `rejected` = `Rejected`; `all` = everything except `Draft` (**Drafts must never be visible to the Transport Office**). Sort `createdAt` asc for queues (oldest first), desc otherwise.

Rules per action:
- **`PUT /trips/:id/allocation`** body `{ vehicleId: string, driverId?: string }`: 11.6 algorithm. `driverId` defaults to the vehicle's permanent driver; if given it must be an `Active` driver. If the trip already has an allocation this is a reassign (history `reassigned`). Allowed only when the requisition is in the In-Charge queue.
- **`DELETE /trips/:id/allocation`**: only in In-Charge queue; history `removed`.
- **`POST /requisitions/:id/forward`**: 11.6 forward check; status → `Pending Administrator`; clears `transport_office_remarks`; notify all active **TransportAdministrators** (`Forwarded to Administrator`: "{requester}'s requisition has a vehicle assigned and is ready for your decision.").
- **`POST /trips/:id/approve`**: requisition in Administrator queue; trip must be `Pending`; sets `Approved`, clears rejection fields; recompute requisition status (11.5); notify the applicant (`Trip Approved`: "One of your trips was approved.").
  - The server SHOULD re-run the eligibility/conflict check on the trip's allocation at approval time and block with `409 VEHICLE_NOT_ELIGIBLE` if a blocking conflict exists (improvement; the prototype did not check).
- **`POST /trips/:id/reject`**: `reason` required (enum), `remarks` optional; trip → `Rejected`; **delete its allocation**; recompute status; notify applicant (`Trip Rejected`: "One of your trips was rejected — {reason}{: remarks}.").
- **`POST /trips/:id/reset-decision`**: trip must be `Approved` or `Rejected`; → `Pending`, clear rejection fields; **allocation kept**; recompute status (can move `Approved`/`Partially Approved` back); no notification.
- **`POST /requisitions/:id/send-back-to-in-charge`**: `remarks` required; requisition in Administrator queue; status → `Pending on Transport Office`; stores `transport_office_remarks`; every trip → `Pending` + clear rejection fields; **delete all allocations**; notify all active **TransportInCharge** (`Sent Back to Transport In Charge`, "Transport Administrator sent this requisition back: {remarks}").
- **`POST /trips/:id/complete`**: 11.7.

### 12.10 Conflicts — `/conflicts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/conflicts` | TIC, TA, SuperAdmin | Computed list (11.9) |
| POST | `/conflicts/:conflictId/reject-trip` | TIC, TA | Reject the conflicting trip (Schedule conflict) |
| (reassign) | `PUT /trips/:tripId/allocation` | TIC | Use the normal allocation endpoint |

Response item: `{ id, type, severity, vehicleId, vehicleLabel, requisitionId, requesterName, tripId, date, startTime, endTime, description }`.
`conflictId` is the stable id from 11.9; the server recomputes and 404s if it no longer exists.

### 12.11 Off-days — `/vehicles/:vehicleId/off-days` and `/off-days`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/off-days` | admin roles | All off-days (`vehicleId?`, `from?`, `to?`) |
| POST | `/off-days` | TIC, TA, SuperAdmin | `{ vehicleId, type, date?, weekday?, reason? }` |
| PATCH | `/off-days/:id` | same | Update |
| DELETE | `/off-days/:id` | same | Delete |

Validation: `One-time` requires `date` and forbids `weekday`; `Recurring` requires `weekday` and forbids `date`. After create/update, run conflict detection for that vehicle and raise notifications.

### 12.12 Student-transport schedule — `/transport-schedule`

(The frontend calls this "Transport Schedule"; internally it was named "routes".)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/transport-schedule` | admin roles | All entries |
| PUT | `/transport-schedule/:vehicleId` | TIC, TA, SuperAdmin | Create-or-replace the entry for a vehicle |
| DELETE | `/transport-schedule/:vehicleId` | same | Remove the entry |

Entry JSON `{ id, vehicleId, schedule: { Sun?: "HH:mm", Mon?: …, … } }`. A weekday missing/empty ⇒ free all day. `HH:mm` validated. After a change → conflict detection for that vehicle.

Also expose `GET /schedule/lookup?date=YYYY-MM-DD` (admin roles) used by the "Schedule Lookup" page: for a date, return each vehicle with `{ vehicleId, registrationNumber, onOffDay, offDayInfo?, studentTransportFreeAfter?, allocations: [{tripId, requisitionId, startTime, endTime}] }`.

### 12.13 Slips — `/slips`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/requisitions/:id/confirmation-slip` | owner, TA | Slip **data** (JSON) for the frontend PDF generator + records the generation |
| GET | `/requisitions/:id/duty-slips` | TIC, TA, SuperAdmin | Eligible driver groups + slip history per driver |
| POST | `/requisitions/:id/duty-slips` | TA | `{ driverId }` — generate/regenerate (creates a record, supersedes old) |
| GET | `/requisitions/:id/duty-slips/:driverId/data` | TIC, TA | Slip **data** for download (no new record) |

Rules:
- **Slip availability (`canGenerateSlips`)**: requisition status ∈ {`Approved`, `Partially Approved`, `Completed`, `Ready for Accounts`}.
- **Confirmation slip**: owner (Applicant/Head, own requisition) or Transport Administrator; available once status allows (above); payload: requester block, trips with decision/vehicle/driver, rejection reasons — the same content as `confirmationSlip.ts` today. Each generation inserts a `confirmation_slips` row (snapshot).
- **Duty (driver) slip**: groups = for each driver, their **`Approved`** trips that have an allocation (port of `getEligibleDutySlipGroups`; `Completed` trips are excluded for *new* slips).
  - **TransportAdministrator** generates/regenerates: creates a `duty_slips` + `duty_slip_trips` rows with **snapshots** (vehicle registration/category, driver name/designation, trip date/times/route); the previous active slip for the same requisition+driver gets `superseded_by_id = newId`. UI shows "Superseded — see new slip" for older ones and a "Vehicle changed — regenerate" badge when the current allocation vehicle differs from the slip snapshot (port of `hasStaleVehicleAssignment`).
  - **TransportInCharge** may **download** the current slip data once the requisition is approved (status per `canGenerateSlips`): `GET …/data` returns the data to render the PDF **without** creating a new record or superseding anything. A driver with no trips yet gets `404`.
  - Super Admin, Applicant, DepartmentHead → `403`.
- The PDF layout itself stays in the frontend (`utils/pdf/*.ts`); the API only supplies verified data, so the file is always consistent with the server state (see 15).

### 12.14 Mileage — `/mileage`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/mileage/awaiting` | TIC, TA | Trips awaiting mileage (eligible + Completed + no entry) |
| GET | `/mileage` | TIC, TA, SuperAdmin | Recorded entries (paged, newest first) |
| GET | `/mileage/mine` | Applicant, DepartmentHead | Own mileage per requisition ("My Mileage") |
| POST | `/trips/:tripId/mileage` | TIC, TA | `{ distanceKm: number > 0 }` |

Rules: 11.8. After recording, if no more awaiting trips remain on the requisition → status `Ready for Accounts` (and the applicant is notified — `Mileage Recorded`, optional new type).

### 12.15 Notifications — `/notifications`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/notifications` | any | Own notifications (newest first, paged, `unreadOnly?`) |
| GET | `/notifications/unread-count` | any | `{ count, recommendationsCount? }` |
| POST | `/notifications/:id/read` | any | Mark one read (only own) |
| POST | `/notifications/read-all` | any | Mark all own read |

JSON: `{ id, type, message, timestamp, linkType, linkId, recipientUserId, isRead }` (`timestamp` = `created_at`). The frontend polls `unread-count` every 30–60 s. `recommendationsCount` = unread notifications of type `New Requisition`/`Resubmission` for a DepartmentHead (powers the "Request" nav badge).

### 12.16 Dashboards — `/dashboard`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/dashboard/operations` | TIC, TA, SuperAdmin | Counts for the Transport Office dashboard |
| GET | `/dashboard/applicant` | Applicant, DepartmentHead | Counts for the applicant dashboard |

Operations: `{ totalVehicles, activeVehicles, underMaintenance, todaysAllocations: Allocation-with-context[], pendingRequisitions (in role queue), conflicts: {count, items(top 5)}, unreadNotifications, activeDrivers }`. Applicant: `{ total, byStatus: {...}, pendingMileage, recent: RequisitionDto[] (5) }`. Use "today" in `Asia/Dhaka`.

### 12.17 Files — `/files`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/files/:id` | owner, scoped head, admin roles | Stream a file (`Content-Disposition: inline` for images, attachment for documents) |

Authorisation per file purpose: **signature** → the owner, Transport Office roles (to render slips), and the head in scope of a requisition that user owns; **supporting_document** → the requisition owner, the head in scope, and Transport Office roles. Anything else `404`.

### 12.18 Health and meta

`GET /health` (public) → `{ status: "ok", db: "up", time }`. `GET /version`. Both excluded from auth and rate limits.

---

## 13. Notifications catalogue

All notifications have **one recipient** (`recipient_user_id`) — the prototype's "global notification when recipient unset" behaviour is dropped. Create them inside the same transaction as the state change using `notify.ts`.

| Event | Recipients | `type` | `linkType`/`linkId` | Message |
|---|---|---|---|---|
| Applicant submits requisition **needing** recommendation | all in-scope active DepartmentHeads | `New Requisition` | requisition / id | "{name} submitted an official requisition ({type}) awaiting your recommendation." |
| Applicant submits requisition **not** needing recommendation | all active TransportInCharge | `New Requisition` | requisition / id | "{name} submitted a {type} requisition ({n} trip(s))" |
| Applicant resubmits | in-scope heads **or** all active TransportInCharge (per 11.4) | `Resubmission` | requisition / id | "{name} resubmitted a corrected {type} requisition …" |
| Head recommends | all active TransportInCharge **and** the applicant | `New Requisition` (to TIC) / `Recommendation` (to applicant) | requisition / id | see 12.8 |
| Head rejects | applicant only | `Recommendation` | requisition / id | "Your requisition was rejected by {head}: {reason}{ — remarks}." |
| Head sends back | applicant only | `Sent Back to Applicant` | requisition / id | "Your requisition was sent back by {head}: {reason} — {remarks}." (head's note) |
| In-Charge sends back | applicant | `Sent Back to Applicant` | requisition / id | per 12.8 (with / without note) |
| In-Charge forwards | all active TransportAdministrators | `Forwarded to Administrator` | requisition / id | "{name}'s requisition has a vehicle assigned and is ready for your decision." |
| Administrator approves a trip | applicant | `Trip Approved` | requisition / id | "One of your trips was approved." |
| Administrator rejects a trip | applicant | `Trip Rejected` | requisition / id | "One of your trips was rejected — {reason}{: remarks}." |
| Administrator sends back to In-Charge | all active TransportInCharge | `Sent Back to Transport In Charge` | requisition / id | "Transport Administrator sent this requisition back: {remarks}" |
| New blocking conflict detected | all active TransportInCharge + TransportAdministrator | `Conflict` | conflict / conflictId | the conflict `description`; `dedupe_key` prevents repeats |
| Super Admin changes role/active | the affected user | `Account Status Changed` | user / userId | "Your account was … by a Super Admin." |
| Submission with no Department Head configured | all active SuperAdmins | `Configuration` (new type) | requisition / id | "No Department Head is configured for {department}." |
| (optional) Mileage recorded / Ready for Accounts | applicant | `Mileage Recorded` | requisition / id | "Mileage was recorded for your trip(s)." |

> The user-facing wording "Transport In-Charge" (with a hyphen) is what the UI shows; the stored type string `Sent Back to Transport In Charge` is kept for backward compatibility with the frontend's type union.

Recipient resolution helpers (port of `notificationUtils.ts`): `findDepartmentHeadsForRequisition` (role DepartmentHead, verified, scope match — also require `is_active=1` on the server), `findTransportInCharge` and `findTransportAdministrators` (verified + `is_active`).

Click-through routing is the **frontend's** job (already built: applicants → `/my-requisitions?open=<id>`; DepartmentHead → `/admin/recommender/<id>` or `/my-requisitions?open=` when it is their own requisition; Transport Office → `/admin/requisitions`; conflict → `/admin/conflicts`; user → `/admin/users` or `/profile-setup`).

---

## 14. Files and uploads

- **Where:** `UPLOAD_DIR` (outside any public/static directory). File on disk = `storage_name` (UUID + extension). Metadata in `files`.
- **Allowed types:** signature → `image/png`, `image/jpeg`; supporting document → `application/pdf`, `image/png`, `image/jpeg`. Verify by **magic bytes**, not only the `Content-Type` header.
- **Limits:** signature 1 MB, document 5 MB (env). Reject larger with `413`/`422`.
- **Serving:** only via `GET /files/:id` after the authorisation rules of 12.17. Set `X-Content-Type-Options: nosniff`.
- **Replacement:** uploading a new signature/document deletes the old file row + disk file (inside a transaction; disk delete after commit).
- **Migration of the frontend:** today signatures and supporting documents are **base64 data URLs** stored on the user/requisition. Two acceptable approaches:
  1. *(Recommended)* new endpoints accept `multipart/form-data`; the frontend sends the `File`.
  2. *(Transitional)* accept `signatureDataUrl` / `supportingDocument: { name, dataUrl }` JSON, decode, validate magic bytes + size, and store as files. Remove once the frontend is updated.
- **PDF slips need the signature image:** the confirmation/duty slip data endpoints return `signatureUrl`; the frontend fetches it with the access token (or the API returns a short-lived signed URL) to embed in jsPDF.
- Orphan cleanup: a nightly job deletes `files` rows not referenced by `users.signature_file_id` or `requisitions.supporting_document_file_id` and older than 24 h.

---

## 15. Slips and PDFs

- The two PDF generators (`confirmationSlip.ts`, `dutySlip.ts`, jsPDF + jspdf-autotable, SUST logo via `pdfTheme.ts`) **stay in the frontend**. Rationale: they are finished, themed and verified; server-side PDF would duplicate them.
- Backend responsibilities:
  1. Authorise (12.13) and return a **JSON payload** containing everything the PDF needs, using **snapshot data** (so a later vehicle edit cannot alter an old slip).
  2. Record generation events (confirmation: every download; duty: only Administrator generate/regenerate).
  3. Provide the signature image URL.
- Payload shape for the confirmation slip: `{ requisition: RequisitionDto-lite, requester: { name, department, type, contact }, trips: [{ date, startTime, endTime, vehicle: {registrationNumber, category}|null, driver: {name, phone}|null, route, status, rejectionReason?, rejectionRemarks? }], generatedAt, applicationNo, signatureUrl? }`.
- Payload for a duty slip: `{ applicationNo, driver: {name, designation, phone}, vehicle(s) per trip, trips: [{ date, reportingLocation (= first stop, default "Campus"), reportingTime (= trip start), route, vehicle }], purpose, generatedAt, slipId, status: "Active"|"Superseded" }`.
- (Optional future) server-side rendering with `pdf-lib`/Puppeteer if the university wants emailed PDFs — out of scope now.

---

## 16. Seed data and reference data

1. **Directory** — seed `directory_units` from `src/data/sustDirectory.ts`: **27 departments across 7 schools** and the `OFFICES` list (read the file; do not retype). Names are exact-match keys for routing — preserve spelling.
2. **Seeded privileged accounts** (from `useUsers.ts`, verified + active; password from `SEED_ADMIN_PASSWORD`, default `Admin@123` for development **only**):

   | Email | Name | Role |
   |---|---|---|
   | `transport-in-charge@sust.edu` | Transport In-Charge | `TransportInCharge` |
   | `transport-admin@sust.edu` | Transport Administrator | `TransportAdministrator` |
   | `superadmin@sust.edu` | Super Admin | `SuperAdmin` |

   In production: no default password — either generate a random one printed once, or require a Super Admin password reset flow; set a flag `must_change_password` (optional column) forcing change at first login.
3. **Demo fleet** (dev/test seed only; from `src/data/vehicles.ts`, **without** `reservedFor`): Jeeps `Sylhet Metro Gha 11-0035/0036/0037` (not available for requisition), Microbus `Sylhet Cha 11-0593 LPG` (LPG, available) — plus a few drivers so the allocation flow can be tried.
4. **One-off import script (optional):** `scripts/import-local-storage.ts` that reads a JSON export of the browser's localStorage keys (section 3) and loads them. Users' fake password hashes **cannot** be migrated — imported users must reset/set a password (mark `password_hash = NULL`, `is_verified = 1` ⇒ they go to "profile-setup" step on next login).
5. The legacy vehicle category `Eicher Bus` stays in the enum (see 20).

---

## 17. Frontend integration plan

Goal: replace each `localStorage` hook with an API-backed hook **without changing page components much**.

### 17.1 Infrastructure to add to the frontend

- `src/api/client.ts` — `fetch` wrapper: base URL from `VITE_API_BASE_URL`, attaches `Authorization`, sends `credentials: "include"`, parses the error format (7.4), on `401 UNAUTHENTICATED` calls `/auth/refresh` once then retries.
- `src/api/*.ts` — one file per module (`auth.ts`, `requisitions.ts`, `vehicles.ts`, …) with typed functions.
- **TanStack Query (React Query)** for caching/invalidations (recommended) — each hook below becomes `useQuery`/`useMutation`.
- `AuthProvider`: holds access token **in memory**; on app load calls `/auth/refresh` then `/auth/me` to restore the session; replaces `localStorage["sust-transit-session"]`.
- Remove: `utils/passwordUtils.ts` (hashing moves to the server), `hooks/useOtp.ts` (OTP moves to the server), seed logic in `useUsers.ts`, `data/storage.ts`/`storageKeys.ts`, client-side notification creation (`notificationUtils.build*` used to create records → the server creates them).
- Keep: `utils/pdf/*`, all UI components, route guards (`RequireAuth` now uses `/auth/me`; **the server remains the real enforcer**).

### 17.2 Hook → endpoint mapping

| Frontend hook / place | Replace with |
|---|---|
| `useAuth` (login/logout/currentUser) | `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/me` |
| `useOtp` + `RegisterPage` + `OtpPage` | `/auth/register`, `/auth/otp/verify`, `/auth/otp/resend` |
| `ProfileSetupPage` | `/me/profile`, `/me/signature`, `/directory/*` |
| `useUsers` (admin `UsersPage`) | `/users` CRUD |
| `useVehicles` | `/vehicles` |
| `useDriver`, `useVehicleDriverAssignment` | `/drivers`, `/vehicles` (permanent driver) |
| `useOffDays` | `/off-days` |
| `useTransportSchedule` | `/transport-schedule` |
| `useRequisitions` — `addRequisition` | `POST /requisitions` |
| `…recommendRequisition / rejectRequisition / sendBackToApplicant` | `/requisitions/:id/recommend|reject|send-back-to-applicant` |
| `…resubmitRequisition` | `PUT /requisitions/:id/resubmit` |
| `…forwardToAdministrator` | `POST /requisitions/:id/forward` |
| `…approveTrip / rejectTrip / resetTripDecision` | `/trips/:id/approve|reject|reset-decision` |
| `…sendBackToTransportInCharge` | `POST /requisitions/:id/send-back-to-in-charge` |
| `…completeTrip`, `markReadyForAccounts` | `POST /trips/:id/complete` (Ready-for-Accounts is automatic after mileage) |
| `useAllocations` + `AllocationPicker` + `getVehicleEligibility` | `GET /trips/:id/vehicle-options`, `PUT/DELETE /trips/:id/allocation` |
| `ConflictsPage` + `detectConflicts` | `GET /conflicts`, `POST /conflicts/:id/reject-trip` |
| `useDutySlips`, `generateDutySlipPdf` | `/requisitions/:id/duty-slips…` (data) + existing jsPDF |
| `generateConfirmationSlip` | `/requisitions/:id/confirmation-slip` (data) + existing jsPDF |
| `useMileageEntries`, `MyMileagePage`, `MileageEntryForm` | `/mileage…`, `POST /trips/:id/mileage` |
| `useNotifications`, `NotificationBell`, `NotificationsPage` | `/notifications…` (poll `unread-count`) |
| `DashboardPage`, `ApplicantDashboardPage` | `/dashboard/operations`, `/dashboard/applicant` |

### 17.3 Frontend changes that the backend requires

1. Requisition `supportingDocumentDataUrl` → `supportingDocumentUrl`; signature `signatureDataUrl` → `signatureUrl`. Update `ApplicantRequisitionDetail`, `RequisitionDetail`, PDF code to fetch images with the token.
2. The form header's application number: call `GET /requisitions/next-number` for display, but treat the number returned by `POST /requisitions` as authoritative.
3. `RequisitionForm.buildRequisition` becomes a plain payload builder (section 12.7 body); remove client-side status computation (`requiresRecommendation` can stay **only** to choose the button label "Proceed to Recommendation" vs "Submit Application").
4. `isInTransportAdministratorQueue` must follow the stricter rule in 11.5.
5. Password minimum length text → server's value.
6. Remove the OTP "Dev preview" banner in production builds.
7. Remove all `window.confirm`-only safety on destructive actions where the server now enforces rules; keep confirmations as UX.

### 17.4 Rollout strategy

Feature-flag per module is unnecessary; do a **module-by-module cut-over** following the implementation plan (Part 2): auth → reference data → fleet → requisitions → allocations → slips/mileage → notifications → dashboards. Each cut-over deletes the corresponding localStorage hook.

---

## 18. Testing strategy

### 18.1 Levels

- **Unit tests** (`tests/unit`) for every function in `src/domain/` — these are direct ports; reuse the frontend cases. Must-have cases are listed below.
- **Integration tests** (`tests/integration`) with Supertest against a **real MySQL** (Docker, a separate `_test` database, migrations run once, tables truncated between tests). Cover every endpoint: success, validation failure, auth failure, wrong-role, wrong-state.
- **Contract tests**: validate responses against `docs/openapi.yaml`.
- **Concurrency test**: two parallel `PUT /trips/:id/allocation` calls for the same vehicle/overlapping time → exactly one `200`, the other `409`.
- **Security tests**: IDOR (applicant A fetching applicant B's requisition → 404), role escalation attempts, token expiry/rotation/reuse, rate limits, upload type spoofing.

### 18.2 Must-have scenarios

1. Registration: bad domain; duplicate verified email; OTP wrong ×5 → locked; OTP expiry; resend cooldown; successful onboarding → login.
2. Login: unknown email vs wrong password return the same error; deactivated; unverified returns onboarding token only; onboarding token rejected on `/requisitions`.
3. Requisition create: Personal with 2 trips → 422; 3.5 h trip → 422; Official route with 1 stop → 422; missing declaration → 422; `Student/Teacher/Officer + Departmental/Official` → `Pending Recommendation`; `Personal` and `DepartmentHead` applicant → `Pending on Transport Office`; application numbers sequential and race-free (50 parallel creates → 50 distinct numbers).
4. Recommender scope: head of CSE cannot see/act on a Physics requisition (404/403); head cannot see own requisition in inbox; reject notifies only the applicant.
5. Send-back by In-Charge **with and without note**; applicant sees note; applicant edits + resubmits; routing 11.4 both branches; allocations released; old note cleared.
6. Allocation: each blocker (inactive vehicle, not available, no driver, off-day one-time/recurring, overlap, student-transport) → 409 with the right blocker text; back-to-back trips allowed; reassign excludes own allocation; category mismatch → warning only.
7. Forward blocked while a non-rejected trip lacks a vehicle.
8. Administrator: approve/reject/reset recompute status (all approved / all rejected / mixed); reject deletes allocation; reset keeps it; send back resets trips + clears allocations; In-Charge cannot approve; Administrator cannot allocate; Super Admin cannot mutate.
9. Driver slip: TIC download allowed only when approved; before approval 409/403; TIC download creates **no** slip row; Administrator regenerate supersedes the old slip; slip data uses snapshot after the vehicle is edited.
10. Completion + mileage: complete only `Approved` trips; requisition → `Completed`; mileage only for eligible (Personal + Teacher/Officer) completed trips with allocation; second entry for a trip → 409; last entry → `Ready for Accounts`.
11. Conflicts: each of the four types detected; conflict notification created once (dedupe); reject-from-conflict removes allocation.
12. Users: cannot change own role; cannot demote last SuperAdmin; DepartmentHead requires scope; deactivated user's next request → 403 and refresh tokens revoked; delete only other SuperAdmin.
13. Vehicles: duplicate registration (case-insensitive) → 409; delete with history → 409; permanent driver exclusivity; deactivating a driver frees the vehicle.
14. Notifications: only own; mark read; read-all; each event in section 13 creates exactly the right rows.

### 18.3 Quality gates

CI (GitHub Actions) runs: install → lint → typecheck → unit → integration (MySQL service) → `npm audit --omit=dev`. Target ≥ 80 % line coverage on `src/domain` and `src/modules/*/service`.

---

## 19. Logging, audit, operations and deployment

### 19.1 Logging

`pino-http` with a request id (also returned in error bodies and the `X-Request-Id` header). Log level by env. Never log passwords, tokens, OTP codes, or file contents. Log slow queries (> 500 ms) in non-production.

### 19.2 Audit log (FRD §25)

Write an `audit_logs` row for: login success/failure, logout, password change, user create/update/role change/deactivate/delete, every requisition transition (11.2), allocation assign/reassign/remove, trip approve/reject/reset/complete, slip generation, mileage entry, vehicle/driver/off-day/schedule create/update/delete. Store `before_json`/`after_json` for updates. Provide `GET /audit-logs` (SuperAdmin, filters `entityType`, `entityId`, `actorId`, `from`, `to`, paged) — read-only.

### 19.3 Operations

- **Graceful shutdown** (stop accepting, finish in-flight, close pool).
- **Scheduled jobs** (node-cron or a separate worker): purge expired OTP challenges and revoked/expired refresh tokens daily; orphan file cleanup nightly; (optional) a nightly conflict re-scan that raises notifications for conflicts that arose from date passing etc.
- **Backups:** daily `mysqldump` of the database + the `uploads/` directory; test restore.
- **Time zone:** DB stores UTC; "today", application-number year, and dashboard "today's allocations" use `Asia/Dhaka`.
- **Docker:** `Dockerfile` (multi-stage: build → run with `node dist/server.js`, non-root user) and `docker-compose.yml` (api + mysql + optional mailhog).
- **Environments:** `development`, `test`, `production` with the env validation of section 6. Run migrations as a deploy step (`knex migrate:latest`), never automatically on app boot in production.
- **Reverse proxy:** serve behind Nginx with HTTPS; set `TRUST_PROXY=true`, `COOKIE_SECURE=true`.
- **Indexes/perf:** the indexes in 10.2 cover the main queries (`requisitions(status, created_at)`, `allocations(vehicle_id, alloc_date, start_time)`, `notifications(recipient, is_read, created_at)`). Review slow queries before launch.

---

## 20. Known gaps and decisions needed from the product owner

Each item has a **recommended default** the implementer can use until the owner decides.

| # | Question / gap | Recommended default |
|---|---|---|
| 1 | Password minimum is 6 in the prototype. | Use 8; update frontend copy. |
| 2 | Can **Students** request `Personal` vehicles? The UI only defaults them to Official; nothing forbids Personal. | Allow (as today); mileage excludes Students anyway. |
| 3 | If **no Department Head** exists for a requisition's department, what happens? | Accept the submission, keep `Pending Recommendation`, notify Super Admins (12.8/13). Alternative: block the submit with a clear message. |
| 4 | Should trip dates in the **past** be rejected? | Reject (`422`) except for drafts. |
| 5 | Mixed approved/rejected requisitions remain in the Administrator queue in the prototype. | Leave the queue once no trip is `Pending` (11.5). |
| 6 | Vehicle category **`Eicher Bus`** is not in the FRD list but exists in data. | Keep until the owner confirms retirement. |
| 7 | Administrator approval of a trip whose vehicle later became unavailable. | Block with `VEHICLE_NOT_ELIGIBLE` (12.9). |
| 8 | A head who is also an applicant: their own Official requisition skips recommendation (existing rule). | Keep. |
| 9 | Who may **delete** vehicles/drivers: all three Transport roles in the prototype. | Keep; consider restricting hard delete to SuperAdmin later. |
| 10 | Email delivery provider for production (SUST SMTP vs a service). | Make SMTP configurable; no vendor lock-in. |
| 11 | Data retention for requisitions/audit logs. | Keep indefinitely; archive after N years later. |
| 12 | **Club / Society** accounts and recommender routing. | Out of scope (skip-list). The enum value `Club` is accepted and treated like `Personal` for routing (no recommendation) — owner to define later. |
| 13 | Account recovery: **forgot password** does not exist in the prototype. | Add `POST /auth/forgot-password` + `POST /auth/reset-password` using the same OTP machinery in a later phase (strongly recommended before go-live). |
| 14 | Multi-day or recurring requisitions: type has `scheduleType: "Single"` only. | Keep single; each trip is its own date. |
| 15 | "Super Admin read-only on operations" — confirm they should still be able to manage fleet data (prototype allows). | Keep (matches `canManageVehicles = isAdminRole`). |

---

## 21. Definition of done

The backend is complete when **all** are true:

1. Every endpoint in section 12 exists, is validated by Zod, role-protected, documented in `docs/openapi.yaml`, and covered by an integration test.
2. All state transitions in 11.2 are enforced server-side; illegal ones return `409 INVALID_STATE`; the client can never set `status`.
3. Double-booking is impossible (concurrency test passes).
4. Every notification in section 13 is produced in the same transaction as its event; no notification is created by the client.
5. Passwords hashed with argon2id/bcrypt; OTP codes hashed and generated with `crypto`; refresh tokens hashed and rotated; deactivated users lose access within a minute.
6. No secrets in the repository; `.env.example` complete; app refuses to start with invalid configuration.
7. Frontend runs entirely against the API with **no** `localStorage` data stores left (only optional UI preferences), all five roles can complete their journeys end-to-end:
   - Applicant: register → OTP → profile/signature → apply → get sent back with/without note → edit → resubmit → see approval → download confirmation slip → view mileage.
   - Department Head: inbox → recommend / reject / send back → "Recommended by me"; applies for own requisitions.
   - Transport In-Charge: assign vehicles (with blockers shown) → forward / send back (note optional) → download driver slip after approval → mark completed → record mileage.
   - Transport Administrator: approve/reject/reset per trip → send back to In-Charge → generate/regenerate duty slip → confirmation slip.
   - Super Admin: create/edit/deactivate accounts (guards for self and last Super Admin) → audit log.
8. Lint, typecheck, and the full test suite pass in CI; README documents setup (`docker compose up`, `npm run migrate`, `npm run seed`, `npm run dev`), env variables, scripts and the module map.

---

*Next document (Part 2): the **step-by-step implementation plan** — an ordered list of small, verifiable build steps (project scaffold → DB migrations → auth → reference data → fleet → requisitions → allocations → approvals → slips → mileage → notifications → dashboards → frontend cut-over → hardening), each with files to create, acceptance checks and tests.*
