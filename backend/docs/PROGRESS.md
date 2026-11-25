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
