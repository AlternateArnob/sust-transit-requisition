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
