# Deployment

Status: live at <https://legalconnect-beryl.vercel.app> (verified 15 Aug 2026 — landing page,
hashed assets, and `/api/health` all serve). Migrations are applied on the hosted database
but the one-off seed has **not** been run, so there are no legal categories, no lawyers, and
no demo accounts there yet; triage, matching, and sign-in cannot be demonstrated on the live
URL until it is.

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
- [x] Migrations applied — table queries return empty result sets rather than errors
- [x] API endpoints work — `/api/health`, `/api/v1/categories`, `/api/v1/lawyers` all respond
- [ ] Authentication works — no accounts exist on the hosted database yet
- [x] Static assets load — every `/assets/*` JS and CSS request returns 200 and the SPA
      renders; deep routes such as `/lawyers` fall back to `index.html`
- [ ] Critical workflows work end to end — blocked until the database is seeded
- [ ] No secrets exposed in the bundle or in API responses
- [ ] URLs are stable
- [ ] Test credentials work — not created yet

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

Maintain this for the final `Deployment_and_Source_Links.txt`. **Keep real passwords out of
the repository** — fill them in only in the submitted file, or reference credentials held
outside version control. Use placeholders here until real values exist, and never invent a
missing value.

```
Student Name:            <not yet recorded>
Student ID:              <not yet recorded>
Project Title:           LegalConnect Ghana — An AI-Powered Platform for Improving
                         Access to Legal Services
Live Application:        https://legalconnect-beryl.vercel.app
Admin URL:               https://legalconnect-beryl.vercel.app/app/admin
Test Username:           <not yet created — hosted database not seeded>
Test Password:           <supply in submission file only, not in the repository>
Admin Username:          <not yet created — hosted database not seeded>
Admin Password:           <supply in submission file only, not in the repository>
Source Code Repository:  https://github.com/RoyalsTechnologies/legalconnect
```
