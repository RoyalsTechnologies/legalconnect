# LegalConnect Ghana — Agent Instructions

AI-powered platform for improving access to legal services. Built as an individual
48-hour CSCD602 Advanced Software Engineering examination project.

Detailed process, requirements, and lifecycle material lives in `docs/`. Read the
relevant document when the task calls for it rather than assuming its contents.
Scoped coding rules load automatically from `.cursor/rules/`.

## What the product is

The problem is **access friction**, not a shortage of lawyers in Ghana. Ordinary users
struggle to identify the right kind of legal professional, describe their issue clearly,
and make contact. The platform is an access, triage, matching, and coordination tool.

The core flow: a citizen describes a concern in plain language → AI triage suggests a
category and produces a structured intake summary → deterministic matching surfaces
eligible lawyers with a visible reason → the citizen sends a consultation request → the
lawyer reviews the structured intake and accepts or declines.

Guiding principle: *use AI to reduce the friction of accessing appropriate legal
professionals, not to replace the professional judgment of a lawyer.*

## Non-negotiable boundaries

The system must never present itself as providing professional legal advice. AI may
categorise, summarise, orient, and support matching. AI must never give definitive legal
advice, determine guilt or liability, predict court outcomes, guarantee a remedy, or
produce legal citations.

Never fabricate anything: test results, PASS statuses, UAT participants, performance
numbers, screenshots, deployment success, commit history, references, or credentials.
Where evidence does not exist yet, write "not yet completed". This applies to code,
documentation, and anything said in chat.

Never commit secrets. API keys, database passwords, and admin credentials stay in `.env`
(gitignored) and in the hosting platform's environment settings, never in tracked files.
The AI provider key is server-side only and must never reach the client bundle.

## Stack

Decided — do not substitute or introduce alternatives without asking.

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 22 LTS, npm |
| Frontend | React 18, TypeScript, Vite, Ant Design |
| Backend | Express, TypeScript, Zod validation |
| Database | PostgreSQL with Prisma ORM |
| Auth | bcrypt hashing, JWT sessions, roles `USER`/`LAWYER`/`ADMIN` |
| Testing | Vitest (unit), Supertest (API integration) |
| AI | One external LLM provider behind a backend-only adapter |

No microservices, message brokers, Redis, Kubernetes, vector databases, or additional
datastores. If you believe one is genuinely required, raise it before adding it.

Deployment target is not yet fixed. See `docs/06-deployment.md`; confirm with the user
before writing platform-specific configuration.

## Repository layout

```
client/          React + Vite frontend
  src/
server/          Express API
  src/
    modules/     auth, users, lawyers, legal-categories,
                 legal-intake, matching, consultations, subscriptions, admin
    ai/          ai-client.ts, prompts.ts, schemas.ts, legal-triage.service.ts
    middleware/
    config/
  prisma/        schema.prisma, migrations, seed
  tests/
docs/            lifecycle documentation (see docs/README.md)
diagrams/        exported design diagrams
```

Each backend module holds its own routes, service, and validation schemas. Keep AI
prompts out of route handlers and out of the frontend entirely.

## Commands

Keep this table accurate as scripts change. Do not invent output from commands you have
not run.

| Task | Command |
| --- | --- |
| Start full stack | `docker compose up` (repo root) |
| Start database only | `docker compose up -d postgres` |
| Install | `npm install` in `client/` and `server/` |
| Dev — backend | `npm run dev` in `server/` (port 4000) |
| Dev — frontend | `npm run dev` in `client/` (port 5173) |
| Migrate | `npm run prisma:migrate` in `server/` |
| Seed | `npm run prisma:seed` in `server/` |
| Test | `npm test` in `server/` (unit then integration) |
| Unit tests | `npm run test:unit` |
| Integration tests | `npm run test:integration` |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Lint + format | `npm run check:fix` (repo root, Biome) |
| Full quality gate | `npm run verify` (repo root) |
| CI | GitHub Actions `.github/workflows/ci.yml` (quality, unit tests, integration tests) |

Run `npm run verify` from the root before considering a phase complete — it runs Biome,
both typechecks, the tests, and the dependency audit.

## How to work

Build the intake and consultation workflow **without AI first**, then add AI as an
enhancement to a working process. This keeps provider problems from blocking the project.
The full sequence is in `docs/03-architecture.md`.

Priority order is Must requirements, then tests for Must paths, then Should. Never work a
Could feature while a Must feature is broken. When a request threatens the 48-hour scope,
say so, classify it Must/Should/Could/Won't, propose the smallest acceptable version, and
record what is deferred — never silently expand scope.

A feature is done when it is implemented, validated, error-handled, tested, documented,
and verified in the deployed environment. Generated code is not done code.

Prefer incremental reversible changes over rewrites. Do not create abstractions with a
single trivial implementation. Do not add a screen or endpoint that no requirement calls
for. Record real trade-offs in `docs/05-technical-debt-register.md` as you make them —
never invent debt to fill a document, and never hide it either.

## Responses

Be concise and implementation-focused. Reference requirement IDs (`FR-001`, `NFR-001`)
where they apply, flag assumptions, and mention tests to add and debt introduced. For
substantial features, cover requirement impact, the proposed change, files affected,
tests, and debt/documentation impact — briefly, not as a twelve-part form. Small changes
just need doing.

Commit style: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:` with a scope, e.g.
`feat(auth): add lawyer role guard`. Never fabricate or rewrite history to make work
appear more extensive.
