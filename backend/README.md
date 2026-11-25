# Backend

Node.js 22 LTS · TypeScript · Express · MySQL 8 · Knex · Zod · Vitest + Supertest.

The design is in `BACKEND_IMPLEMENTATION_PLAN.md` (Part 1) and the build order in
`BACKEND_STEP_BY_STEP_PLAN.md` (Part 2). Progress is logged in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Run locally

```bash
cd backend
cp .env.example .env          # then adjust values if needed
docker compose up -d          # MySQL 8 (+ MailHog on :8025); creates sust_transit and sust_transit_test
npm install
npm run migrate               # create tables (migrations arrive in Step 2)
npm run seed                  # seed data (available from Step 16 of the plan's seeds)
npm run dev                   # http://localhost:4000/api/v1/health
```

## Scripts

| Script                         | What it does                                                 |
| ------------------------------ | ------------------------------------------------------------ |
| `npm run dev`                  | Start the API with file watching (`tsx watch src/server.ts`) |
| `npm run build`                | Compile to `dist/`                                           |
| `npm start`                    | Run the compiled server                                      |
| `npm run lint`                 | ESLint                                                       |
| `npm run format:check`         | Prettier check (`npm run format` to fix)                     |
| `npm run typecheck`            | `tsc --noEmit`                                               |
| `npm test`                     | Vitest                                                       |
| `npm run migrate`              | Apply migrations                                             |
| `npm run migrate:rollback`     | Roll back the last batch                                     |
| `npm run migrate:rollback:all` | Roll back every migration                                    |
| `npm run seed`                 | Run seeds                                                    |
| `npm run db:reset`             | Roll back everything, migrate, seed. **Development only.**   |

## Layout

`src/modules/*` (routes → controller → service), `src/domain/` (pure business rules, no DB or Express),
`src/services/`, `src/middleware/`, `src/config/`, `migrations/`, `seeds/`, `tests/`.
