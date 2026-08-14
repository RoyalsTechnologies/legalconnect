# Deployment

Status: Vercel configuration is in the repository. A live URL is **not yet deployed**.

The exam needs one public origin plus PostgreSQL. The client calls `/api/v1` on the same
host, so Vercel serves the Vite build from `public/` (CDN) and runs Express as one Function
(`index.ts` → `createApp()`). `express.static()` is ignored on Vercel; do not rely on it.
`outputDirectory` is intentionally unset so Vercel does not treat the project as a
static site.

Companion database: a hosted Postgres (Neon, Vercel Postgres, or similar). The Function
must use a **pooled** connection string (Neon’s `-pooler` host) or it will exhaust
connections (TD-030).

## What to set on Vercel before the first deploy

Create the project from this Git repository (root directory = repo root). Add these
**Production** environment variables, then deploy. The server validates config at import
time and the build will fail if `DATABASE_URL` or `JWT_SECRET` is missing.

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | Pooled `postgresql://…` URL, `sslmode=require` |
| `JWT_SECRET` | Yes | ≥ 32 characters. `openssl rand -base64 48` |
| `CLIENT_ORIGIN` | Yes | `https://<project>.vercel.app` (update after the first URL is known) |
| `NALOPAY_CALLBACK_URL` | If NaloPay is set | `https://<project>.vercel.app/api/v1/payments/callback` |
| `AI_PROVIDER_*` | No | Unset → intake fallback (FR-010) |
| `EMAIL_*` / `SMS_*` / `NALOPAY_*` | No | Unset → log / local-dev behaviour; production NaloPay without credentials returns 503 |

Never put secrets in git. `CLIENT_ORIGIN` and the callback URL can be filled on the second
deploy once Vercel prints the hostname.

## Commands Vercel runs

Defined in `vercel.json` and the root `vercel-build` script:

1. `npm ci` at the root, then in `server/` and `client/` with devDependencies (Vite and
   `prisma` are devDependencies; a production-only install would fail the build)
2. `prisma generate` and `prisma migrate deploy`
3. `vite build` → copy `client/dist` to `public/` (Vercel’s CDN directory; do not set
   `outputDirectory` or the project is treated as static-only and `/api` disappears)

SPA routes (`/login`, `/app`, …) rewrite to `/index.html`. `/api/*` and `/assets/*` are
left alone so Express and hashed JS/CSS are not replaced by the HTML shell.

One-off seed against the hosted database (from your machine, not on every deploy):

```bash
DATABASE_URL='postgresql://…' SEED_DEMO_DATA=true SEED_DEMO_PASSWORD='…' npm --prefix server run prisma:seed
```

Record the printed admin password only in `Deployment_and_Source_Links.txt`, not in the repo.

## Pre-deployment verification

- [ ] Production build succeeds
- [ ] Environment variables configured on the host
- [ ] Database connection works
- [ ] Migrations applied
- [ ] API endpoints work (`/api/health` returns `ok`)
- [ ] Authentication works
- [ ] Static assets load
- [ ] Critical workflows work end to end
- [ ] No secrets exposed in the bundle or in API responses
- [ ] URLs are stable
- [ ] Test credentials work

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
Live Application:        <not yet deployed>
Admin URL:               <not yet deployed>
Test Username:           <not yet created>
Test Password:           <supply in submission file only, not in the repository>
Admin Username:          <not yet created>
Admin Password:           <supply in submission file only, not in the repository>
Source Code Repository:  https://github.com/RoyalsTechnologies/legalconnect
```
