# LegalConnect Ghana

An AI-powered platform for improving access to legal services.

CSCD602 Advanced Software Engineering — 48-hour individual examination project.

## Problem

Ghana does not lack lawyers. What ordinary people lack is a clear way to work out which
kind of legal professional they need, how to describe their problem, and how to make
contact. LegalConnect reduces that access friction: describe a legal problem in everyday
language, let AI classify and summarise it, and get connected to suitable lawyers by
practice area, location, and availability.

The platform is an access, triage, and matching tool. **It does not give legal advice.**
AI assists with categorisation, summarisation, and matching support only; professional
judgement stays with a qualified lawyer.

## Status

All fifteen MVP functional requirements are implemented, tested, and walkable through the
web interface: registration and login, AI-assisted intake with a safe fallback,
deterministic lawyer matching with visible reasons, a filterable lawyer directory, the
consultation request workflow, and administration.

Deployed and reachable at <https://legalconnect-beryl.vercel.app>. Developer UAT against the
local stack was run on 2026-08-13 and extended on 2026-08-15; independent participant UAT is
not yet completed.
The AI provider key is unset by default, so triage takes the fallback path until one is
configured — the intake and consultation flow works either way, which is the point of
building it that way. See [docs/03-architecture.md](docs/03-architecture.md) for the phase
plan and [docs/05-technical-debt-register.md](docs/05-technical-debt-register.md) for what
was deliberately left out.

## Stack

React 18, TypeScript, Vite, and Ant Design on the frontend. Express and TypeScript with
Zod validation on the backend. PostgreSQL via Prisma. bcrypt password hashing with JWT
sessions. Vitest and Supertest for testing. One external LLM provider behind a
backend-only service adapter.

## Getting started

Requires Docker. Node.js 22+ only if you run the apps directly rather than in containers.

### Option A — everything in Docker

```bash
cp server/.env.example server/.env    # set JWT_SECRET: openssl rand -base64 48
docker compose up --build             # first run pulls images and installs deps
```

Then, once, to create the initial migration and seed data:

```bash
docker compose exec server npx prisma migrate dev --name init
docker compose exec server npm run prisma:seed    # prints an admin password once
```

Frontend on http://localhost:5173, API on http://localhost:4000, database on port 5433.
Source is bind-mounted, so both apps hot-reload on edit.

### Option B — database in Docker, apps on the host

```bash
docker compose up -d postgres

cd server && cp .env.example .env && npm install
npm run prisma:migrate && npm run prisma:seed && npm run dev

cd client && npm install && npm run dev            # second terminal
```

Either way, the setup panel at http://localhost:5173 should report the API reachable and
the database connected.

### Demo data

To get a walkable dataset, seed with the demo flag:

```bash
SEED_DEMO_DATA=true npm run prisma:seed        # in server/, or via docker compose exec
```

That adds one citizen and five approved fictional lawyers across different regions and
practice areas. Every demo account shares the password `demo-password-2026`, overridable
with `SEED_DEMO_PASSWORD`. Re-running is safe — the seed upserts and replaces practice
areas rather than appending.

| Account | Email | Role |
| --- | --- | --- |
| Citizen | `ama.mensah@example.com` | `USER` |
| Employment & contract, Accra | `akua.owusu@example.com` | `LAWYER` |
| Property, tenancy & family, Kumasi | `kwame.asante@example.com` | `LAWYER` |
| Family & consumer, Takoradi | `efua.danso@example.com` | `LAWYER` |
| Criminal, Tamale | `yaw.boakye@example.com` | `LAWYER` |
| Business, contract & immigration, Accra | `abena.sarpong@example.com` | `LAWYER` |

**This is gated behind a flag for a reason.** These are approved lawyer profiles sharing a
publicly known password. Seeding them into a real deployment would publish fictional
practitioners to people genuinely looking for legal help. Leave `SEED_DEMO_DATA` unset
anywhere that is not a local demonstration.

## Walking the system

**Without an account at all**, open http://localhost:5173/lawyers. The directory, its
filters, and any approved lawyer's profile are readable by anyone (ADR-009) — a member of
the public can see whether the platform serves their kind of problem before handing over
a name, an email, and a phone number. Nothing more opens up: unapproved and suspended
lawyers stay hidden, and every write still needs a session.

Everyone signs in at http://localhost:5173/login through the same form. The server decides
what you see from the role on your account — there is no separate lawyer or admin login.

**As a citizen** (`ama.mensah@example.com`, or register a new account): describe a problem
in plain language, see the organised summary, open the suggested lawyers with the reason
each one appeared, and send a consultation request. Every screen keeps your original words
alongside anything the AI produced.

**As a lawyer** (any of the demo lawyer emails): demo lawyers already have a live plan.
Incoming requests arrive with the structured summary and the citizen's own description.
Accept, decline, or complete them, and keep your practice areas within your plan's cap —
matching only reaches subscribed lawyers who list the relevant area.

**As an admin** (the account printed by the seed script): approve practitioners, manage the
category taxonomy, suspend accounts, and watch the counters for enquiries the AI could not
place confidently.

Public registration creates a `USER` by default, or a `LAWYER` with a pending profile when
`accountType=lawyer` (ADR-006 / FR-016). Pending lawyers stay out of the directory until
an admin approves them **and** they have a live plan (FR-018). Booking a consultation requires paying that lawyer's fee (FR-017);
the lawyer is notified only after payment.

The API is equally usable directly if you prefer:

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"ama.mensah@example.com","password":"demo-password-2026"}'
```

Send the returned `token` as `authorization: Bearer <token>`.

## Commands

| Task | Where | Command |
| --- | --- | --- |
| Start full stack | root | `docker compose up` |
| Start database only | root | `docker compose up -d postgres` |
| Stop everything | root | `docker compose down` |
| Reset database | root | `docker compose down -v` |
| Logs | root | `docker compose logs -f server` |
| Shell into API | root | `docker compose exec server sh` |
| Dev server | `server/` | `npm run dev` |
| Dev client | `client/` | `npm run dev` |
| Migrate | `server/` | `npm run prisma:migrate` |
| Seed | `server/` | `npm run prisma:seed` |
| Test | `server/` | `npm test` (unit then integration) |
| Unit tests | `server/` | `npm run test:unit` |
| Integration tests | `server/` | `npm run test:integration` |
| Frontend E2E | root or `client/` | `npm run test:e2e` |
| Measure read-path latency | root | `npm run measure:latency -- <baseUrl> <samples>` |
| Typecheck | either | `npm run typecheck` |
| Build | either | `npm run build` |
| CI | GitHub | `.github/workflows/ci.yml` |

### Code quality

Run from the repo root. `npm install` once at the root to get Biome.

| Task | Command |
| --- | --- |
| **Everything** | `npm run verify` |
| Unit tests | `npm run test:unit` |
| Integration tests | `npm run test:integration` |
| Frontend E2E | `npm run test:e2e` |
| Lint + format check | `npm run check` |
| Lint + format, applying fixes | `npm run check:fix` |
| Format only | `npm run format` |
| Typecheck both packages | `npm run typecheck` |
| Dependency audit | `npm run audit` |

`npm run verify` runs Biome, both typechecks, the test suite (unit then integration), and
the dependency audit, failing on the first problem. Unit tests do not need a database.
Integration tests need PostgreSQL (`docker compose up -d postgres`).

GitHub Actions (`.github/workflows/ci.yml`) runs lint/typecheck/audit/builds, then
**unit tests**, **integration tests**, and **coverage** as separate jobs.
Integration starts its own Postgres 16 service. Frontend E2E is local-only
(`npm run test:e2e`).

Hosting is Vercel (`vercel.json`): the Vite build in `client/dist` is served from the CDN
and `/api/*` is rewritten to the Express Function at `api/index.js`. Create a hosted
Postgres, set the variables in `docs/06-deployment.md`, then deploy. Live at
<https://legalconnect-beryl.vercel.app>, migrated and seeded on 15 Aug 2026: the directory,
matching, and sign-in for all three roles were verified there. The practitioners shown are
fictional demonstration profiles (TD-032), and a live payment still cannot be completed
because the test merchant caps the amount (TD-031).

Frontend E2E: `npm run test:e2e` (first time: `npx --prefix client playwright install chromium`).

Inside Docker the API reaches the database at `postgres:5432` and the client proxies
`/api` to `server:4000`; `docker-compose.yml` overrides `DATABASE_URL` accordingly, so
`server/.env` stays configured for host-based development.

## Configuration

All configuration is via environment variables, validated at startup by
`server/src/config/env.ts` — the server refuses to boot on invalid config rather than
failing at the first request. See `server/.env.example` for the full list.

`.env` is gitignored. Never commit API keys, database passwords, or admin credentials.
The AI provider key is server-side only and never reaches the client bundle.

## Structure

```
client/    React frontend
server/    Express API, Prisma schema, tests
docs/      lifecycle documentation — start at docs/README.md
diagrams/  design diagrams
```

## Documentation

| Document | Contents |
| --- | --- |
| [docs/01-requirements.md](docs/01-requirements.md) | FR-001–FR-021, NFRs, acceptance criteria, traceability |
| [docs/02-effort-estimation.md](docs/02-effort-estimation.md) | Estimation technique, estimate, and actuals |
| [docs/03-architecture.md](docs/03-architecture.md) | Architecture, data model, ADRs, phase plan |
| [docs/04-testing.md](docs/04-testing.md) | Test strategy, cases, results, defects |
| [docs/05-technical-debt-register.md](docs/05-technical-debt-register.md) | Debt register and repayment plan |
| [docs/06-deployment.md](docs/06-deployment.md) | Deployment configuration, steps, and live verification |
| [docs/07-maintenance-and-evolution.md](docs/07-maintenance-and-evolution.md) | Maintenance strategy, future evolution, limitations |
| [docs/10-srs.md](docs/10-srs.md) | Software Requirements Specification |
| [docs/11-conclusion.md](docs/11-conclusion.md) | Project conclusion |
| [docs/12-references.md](docs/12-references.md) | References and acknowledgements |
| [docs/13-implementation.md](docs/13-implementation.md) | Implementation — modules, workflows, algorithms, security, deviations |
| [docs/user-manual.md](docs/user-manual.md) | End-user guide, common errors, troubleshooting |

The full index, including the process playbook and the estimation and testing detail, is in
[docs/README.md](docs/README.md).

## Contributing

Commit continuously, one logical change at a time, using a Conventional Commits prefix and a
scope: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:` — for example
`feat(auth): add lawyer role guard` or `test(matching): cover the tie-break order`. Run
`npm run verify` from the repository root before a change is considered complete; it runs
Biome, both typechecks, the test suites, and the dependency audit. Never rewrite history to
make the work look more extensive than it was.

## Acknowledgements

Every third-party framework, library, API, and service used is acknowledged in
[docs/12-references.md](docs/12-references.md).
