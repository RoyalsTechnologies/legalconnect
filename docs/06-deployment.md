# Deployment

Status: live at <https://legalconnect-beryl.vercel.app>, migrated and **seeded** on
15 Aug 2026. Verified the same day against the live URL: the landing page and hashed assets
serve, `/api/health` returns `{"status":"ok","database":"connected"}`, the API returns nine
legal categories, three subscription packages, and five approved lawyers, and all three
roles sign in — admin (`role=ADMIN`, `/admin/stats` answers), citizen (`USER`), and lawyer
(`LAWYER`). The directory, matching, and the consultation workflow can therefore be walked
on the live URL.

The seeded practitioners are **fictional demonstration profiles**, not real lawyers — see
TD-032 for why that is a deliberate, recorded trade-off on a public deployment.

The exam needs one public origin plus PostgreSQL. The client calls `/api/v1` on the same
host, so Vercel serves the Vite build (`outputDirectory: client/dist`) from its CDN and
runs the whole API as one Function at `api/index.js`, which exports the app returned by
`createApp()` from `server/dist`. `vercel-build` compiles that JavaScript with the server
tsconfig; Vercel must not typecheck `server/src`, because its Express framework preset
treats the helmet/cors default exports as non-callable. Local Docker still starts from
`server/src/server.ts`.

The Express preset is deliberately **off** (`framework: null`). Under that preset every
request is routed to the Function and a `public/` folder created during the build is not
picked up as static output, so the SPA 404s while `/api/health` works. Serving
`client/dist` as the output directory and routing `/api/*` to the Function avoids that.
`express.static()` is ignored on Vercel; do not rely on it.

Companion database: **Supabase Postgres**. The Function should use a connection string
Vercel can reach (not `localhost:5433`). For this exam, set `DATABASE_URL` to the
Supabase **direct** URI (host `db.<project>.supabase.co`, port `5432`, `sslmode=require`)
so `prisma migrate deploy` and the API share one URL. Do not use the Transaction pooler
(port `6543`) unless `directUrl` is added to the Prisma schema (TD-030).

## What to set on Vercel before the first deploy

Create the project from this Git repository (root directory = repo root). Add these
**Production** environment variables, then deploy. The server validates config at import
time and the build will fail if `DATABASE_URL` or `JWT_SECRET` is missing.

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | Supabase **direct** URI (`db.<ref>.supabase.co:5432?sslmode=require`). **Edit the existing variable** if it still says `localhost:5433` — adding a second `DATABASE_URL` does nothing. Not the Transaction pooler on port `6543`. The Supabase Vercel integration’s `POSTGRES_URL_NON_POOLING` is used if `DATABASE_URL` is still local |
| `JWT_SECRET` | Yes | ≥ 32 characters. `openssl rand -base64 48` |
| `CLIENT_ORIGIN` | Should | `https://<project>.vercel.app` (update after the first URL is known). Left unset on Vercel the API now falls back to `VERCEL_PROJECT_PRODUCTION_URL`, so emailed links stay reachable; set it explicitly once a custom domain is in play |
| `NALOPAY_CALLBACK_URL` | If NaloPay is set | `https://<project>.vercel.app/api/v1/payments/callback` |
| `AI_PROVIDER_*` | No | Unset → intake fallback (FR-010) |
| `EMAIL_*` / `SMS_*` / `NALOPAY_*` | No | Unset → log / local-dev behaviour; production NaloPay without credentials returns 503 |

Never put secrets in git. Never paste `server/.env` into Vercel — that file is for
`docker compose` on your machine. In Supabase: **Project Settings → Database →
Connect → URI → Direct**. Paste that value only into the Vercel project environment.
`CLIENT_ORIGIN` and the callback URL can be filled on the second deploy once Vercel
prints the hostname.

## Commands Vercel runs

Defined in `vercel.json` and the root `vercel-build` script:

1. `npm ci` at the root, then in `server/` and `client/` with devDependencies (Vite and
   `prisma` are devDependencies; a production-only install would fail the build)
2. `prisma generate` and `prisma migrate deploy` via the server npm scripts (so the
   working directory is `server/`, where `prisma/schema.prisma` lives)
3. `tsc` compiles `server/src` to `server/dist` (the Function loads that JS, not the
   TypeScript sources)
4. `vite build` → `client/dist`, which `outputDirectory` publishes to the CDN

`/api/*` rewrites to the `api/index` Function, so every `/api/v1/...` path reaches Express
rather than being resolved as a file. Everything else falls back to `/index.html` for SPA
routes (`/login`, `/app`, …). Static files win before rewrites, so hashed JS and CSS under
`/assets/` are still served as themselves.

One-off seed against the hosted database (from your machine, not on every deploy). **Not yet
run** — `/api/v1/categories` returns `[]` and `/api/v1/lawyers` returns zero results on the
live URL:

```bash
DATABASE_URL='postgresql://…' SEED_DEMO_DATA=true SEED_DEMO_PASSWORD='…' npm --prefix server run prisma:seed
```

Record the printed admin password only in `Deployment_and_Source_Links.txt`, not in the repo.

## Pre-deployment verification

Checked against the live URL on 15 Aug 2026. Unticked items are not yet evidenced — do not
tick one without running it.

- [x] Production build succeeds — the deployed build serves
- [x] Environment variables configured on the host — 28 Production variables are set,
      including `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, `NALOPAY_CALLBACK_URL`, the
      `EMAIL_*` set and `SEED_ADMIN_*`; the Function boots and reaches the database. All of
      them are marked **sensitive**, so `vercel env pull` returns `"[SENSITIVE]"` rather than
      values — the connection string cannot be recovered from Vercel and has to come from
      Supabase when seeding from a workstation
- [x] `CLIENT_ORIGIN` points at the live host — corrected on 15 Aug 2026. It previously
      carried the local development origin, so every emailed confirmation link from the live
      site pointed at localhost (DEF-010): a CORS probe showed the API allowing
      `http://localhost:5173` and refusing its own host. The Production variable was replaced
      with `https://legalconnect-beryl.vercel.app` and the project redeployed; the same probe
      now returns `access-control-allow-origin: https://legalconnect-beryl.vercel.app` and no
      header for the localhost origin. The API also falls back to the Vercel host if the
      variable is ever absent again
- [x] Database connection works — `/api/health` returns `{"status":"ok","database":"connected"}`
- [x] Migrations applied — `prisma migrate status` against the hosted database reports all
      11 migrations applied and the schema up to date
- [x] Seed run — 15 Aug 2026, from a workstation using the Supabase direct URI. Nine
      categories, three packages, one admin, one demo citizen, and five approved demo
      lawyers with a year of subscription each. The seed upserts, so re-running is safe
- [x] API endpoints work — `/api/health`, `/api/v1/categories` (9), `/api/v1/packages` (3),
      and `/api/v1/lawyers` (total 5) all respond
- [x] Authentication works — admin, citizen, and lawyer all returned `200` with the expected
      role from `POST /api/v1/auth/login` against the live API
- [x] Static assets load — every `/assets/*` JS and CSS request returns 200 and the SPA
      renders; deep routes such as `/lawyers` fall back to `index.html`
- [x] Critical workflows work end to end — the directory lists five lawyers across four
      cities, and an admin token reads `/api/v1/admin/stats` (5 approved, 5 subscribed,
      9 active categories). A paid consultation cannot be completed on the live URL because
      the test merchant refuses amounts at real fee levels (TD-031)
- [x] No secrets exposed in the bundle or in API responses — audited 15 Aug 2026. The client
      source contains no `import.meta.env` or `process.env` reference at all, so no
      environment value can reach the bundle by construction. A scan of the built assets for
      key-shaped strings (`sk-…`, `AKIA…`, `postgresql://`, secret variable names, provider
      hostnames) returns nothing, and the local build reproduces the same asset hashes the
      live page loads (`index-vFypezLz.js`, `react-dwAUvDdu.js`), so the audit applies to the
      served bundle. The public `/api/v1/lawyers` response carries no email address,
      password hash, or payment account field
- [ ] URLs are stable — the project has not been renamed since deployment, but no alias is
      pinned, so a rename would move the URL
- [x] Test credentials work — verified by signing in as each role on 15 Aug 2026. The
      accounts are listed below; the passwords live in `server/.env` and are injected into
      the generated links file, never committed

Never mark deployment complete on the strength of a successful build. Test the live
application.

## Gate before deployment

Core Must requirements working · critical tests passing on GitHub Actions
(`.github/workflows/ci.yml`) · critical security issues addressed · production
configuration prepared. Confirm the latest workflow run before treating this gate as
met — do not assume CI is green from the workflow file existing.

## Logging and observability

The API writes four files under `server/logs/` and also prints the same lines to stdout
so the Vercel function log still shows them (TD-029):

| File | Contents |
| --- | --- |
| `sys.log` | Process start/stop, unhandled errors, AI fallback (length only, not intake text) |
| `security.log` | Login success, 401/403, auth mail failures — no passwords or tokens |
| `payment.log` | NaloPay collection/payout and callbacks — phone last-4 only |
| `notification.log` | Email and SMS send/skip — masked email, subject, SMS last-4; never message bodies |

Never log passwords, access tokens, secret keys, full email addresses, full phone
numbers, names, full sensitive records, or full legal-intake text. The logger masks
those fields and any email or Ghana MSISDN that appears in a message (NFR-002).

## Submission links

`Deployment_and_Source_Links.txt` is generated by `npm run docs:submission` from
`submission.json`, alongside the five PDFs. Everything lands in `submission/`, which is
gitignored precisely because the links file carries live credentials once they are filled in.

Passwords are never written into `submission.json`, because that file is tracked. The
config holds `${SEED_ADMIN_PASSWORD}` and `${SEED_DEMO_PASSWORD}`, which the build resolves
from `server/.env`, so the value only ever reaches the generated file. The build reports any
token it could not resolve rather than emitting it silently.

```
Student Name:            Alexander Adade
Student ID:              22424693
Project Title:           LegalConnect Ghana — An AI-Powered Platform for Improving
                         Access to Legal Services
Live Application:        https://legalconnect-beryl.vercel.app
Admin URL:               https://legalconnect-beryl.vercel.app/app/admin
Citizen Username:        ama.mensah@example.com
Lawyer Username:         akua.owusu@example.com
Admin Username:          admin@legalconnect.com
Passwords:               resolved from server/.env at build time — see the generated file
Source Code Repository:  https://github.com/RoyalsTechnologies/legalconnect
```

All three accounts were verified against the live API on 15 Aug 2026 and returned their
expected roles.

## Package contents

`npm run docs:submission` renders the diagrams, then writes the package and a ZIP beside it:

```
submission/22424693_LegalConnect_Ghana/
├── Project_Documentation.pdf          15 numbered chapters, every required section
├── SRS.pdf                            specification, plus the requirements register
├── Testing_Report.pdf                 testing report
├── Technical_Debt_Plan.pdf            register and repayment plan
├── User_Manual.pdf                    end-user guide
├── Deployment_and_Source_Links.txt    links and working credentials
└── Supporting_Files/
    ├── diagrams/                      Mermaid sources plus PNG and SVG renders
    └── uat-evidence/                  5 UAT screenshots
submission/22424693_LegalConnect_Ghana.zip   3.3 MB
```

This is the structure the brief names, file for file. The brief also permits combining those
PDFs into one document if every required section is clearly identified, so both routes are
provided rather than choosing between them: each of the four is its own file **and** a
numbered chapter of `Project_Documentation.pdf`, which opens with a *Required sections* page
mapping the brief's nineteen documentation topics to chapters. There is one source document
per section — the standalone files and the chapters are rendered from the same markdown in the
same run, so they cannot disagree.

`SRS.pdf` carries the requirements register with the specification. The brief's SRS structure
expects acceptance criteria and a traceability matrix inside the SRS, and both live in
`01-requirements.md`, so a standalone specification without it would be incomplete.

## Final submission check

Verified 15 Aug 2026. Every row states where the evidence is; nothing is ticked on the
strength of a document merely existing.

| Brief requirement | State | Evidence |
| --- | --- | --- |
| Realistic problem defined | Met | `01-requirements.md` problem statement; `10-srs.md` §1 |
| Stakeholders and users identified | Met | `01-requirements.md` users and stakeholders; use-case diagram |
| Requirements analysis completed | Met | 21 functional and 8 non-functional requirements, prioritised, with acceptance criteria |
| SRS completed | Met | `10-srs.md`, chapter 1 of the PDF |
| Effort estimated, technique justified | Met | `02-effort-estimation.md` — story points with expert judgement, baseline 48.5 h, re-estimation of added scope, variance analysis |
| System designed | Met | `03-architecture.md` and five diagrams in `diagrams/` |
| Major prioritised requirements implemented | Met | FR-001…FR-021; build phases 1–8 complete in `03-architecture.md` |
| Functional application works | Met | Live directory returns five lawyers; all three roles sign in |
| Tests executed, results documented | Met | 164 unit, 220 integration, 6 Playwright E2E, all passing 15 Aug 2026; recorded in `04-testing.md` |
| Technical debt identified with resolution strategies | Met | 32 items in `05-technical-debt-register.md`, each with cause, impact, resolution and target, plus a repayment plan giving every open item a priority, prerequisite, target release, estimated effort, and expected benefit |
| Application deployed, live deployment tested | Met | Vercel plus Supabase; the checklist above, verified against the live URL |
| User manual prepared | Met | `user-manual.md` |
| Maintenance strategy and future evolution prepared | Met | `07-maintenance-and-evolution.md` |
| Repository accessible | **Action needed** | The repository is public, but the default branch `main` is 15 commits behind the working branch. A grader opening the repository URL would not see the submitted work |
| URLs verified | Met | Live and admin URLs respond; `/api/health` reports the database connected |
| Credentials verified | Met | `node scripts/verify-live-credentials.mjs` signs in as each role against the live API and prints the outcome, never a password |
| Name, student ID, project title included | Met | PDF cover and `Deployment_and_Source_Links.txt` |
| Third-party resources acknowledged | Met | `12-references.md` |
| Submission package complete | Met | Structure above, built by `npm run docs:submission`: `Project_Documentation.pdf`, `SRS.pdf`, `Testing_Report.pdf`, `Technical_Debt_Plan.pdf`, `User_Manual.pdf`, `Deployment_and_Source_Links.txt`, and `Supporting_Files/`, matching the brief file for file. The combined PDF additionally opens with a *Required sections* page mapping the brief's nineteen documentation topics to chapters |

Known gaps carried into the submission, all recorded rather than hidden: no independent UAT
participant session (developer walkthroughs only), performance sampled on the read paths but
not load-tested and a cold first request over the NFR-006 target (DEF-013), a live
mobile-money capture at a real consultation fee blocked by the test merchant (TD-031), the
emailed confirmation link on the live site not yet retested end to end since `CLIENT_ORIGIN`
was corrected (DEF-010), and four open Low defects (DEF-007, DEF-008, DEF-009, DEF-013).
