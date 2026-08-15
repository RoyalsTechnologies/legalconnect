# Implementation

What was actually built, and where it lives. The reasoning behind the structure is in
`03-architecture.md` (architecture, data model, ADRs); the evidence that it works is in
`04-testing.md`. This document is the bridge between the two: modules, workflows,
algorithms, and the cross-cutting concerns — authentication, authorization, validation,
error handling, security — as implemented in code.

Every path below is a real file in the repository. Code excerpts are kept to a few lines
and only appear where the code makes a point that prose would blur.

## Implemented modules

The backend is a single Express application. Each module under `server/src/modules/` owns
its routes, its service, and its Zod schemas; nothing reaches the database except through
a service.

| Module | Endpoints (under `/api/v1`) | Responsibility |
| --- | --- | --- |
| `auth` | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password` | Registration for both account types, login, and the email-token flows |
| `users` | `GET /users/me`, `PATCH /users/me` | Own profile read and update, including the phone used for payments |
| `lawyers` | `GET /lawyers`, `GET /lawyers/:id`, `GET|PATCH /lawyers/me`, `POST /lawyers`, `PATCH /lawyers/:id`, `POST /lawyers/me/subscription`, `POST /lawyers/me/subscription/confirm`, `GET|POST /lawyers/me/withdrawals` | Lawyer profiles, the public directory, and the lawyer-facing plan and wallet actions |
| `legal-categories` | `GET /categories`, `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id` | The practice-area taxonomy; delete retires rather than removes (ADR-008) |
| `legal-intake` | `POST /intakes`, `GET /intakes`, `GET /intakes/:id` | Persists the citizen's own words, then calls triage |
| `matching` | `GET /intakes/:intakeId/recommendations` | Deterministic ranking of eligible lawyers |
| `consultations` | `POST /consultations`, `GET /consultations`, `GET /consultations/:id`, `PATCH /consultations/:id`, `POST /consultations/:id/pay`, `POST /consultations/:id/confirm`, `POST /consultations/verify-payment` | The consultation lifecycle, its payment, and its escrow release |
| `subscriptions` | `GET /packages`, `POST /packages`, `PATCH /packages/:id` | Plan catalogue, plus the subscription payment and activation logic used by the lawyer routes |
| `admin` | `GET /admin/users`, `PATCH /admin/users/:id/status`, `GET /admin/stats`, `POST /admin/lawyers/:id/subscription` | User administration, platform counts, and granting a plan without payment |
| `wallet` | none of its own — reached through `/lawyers/me/withdrawals` and consultation confirmation | Ledger credits, refunds, and withdrawal requests |

Supporting directories, all server-side:

| Directory | Contents |
| --- | --- |
| `server/src/ai/` | `ai-client.ts` (the only place a provider is spoken to), `prompts.ts`, `schemas.ts`, `legal-triage.service.ts` |
| `server/src/middleware/` | `auth.ts` (`requireAuth`, `optionalAuth`, `requireRole`), `validate.ts`, `error-handler.ts` |
| `server/src/email/` | `mailer.ts` (SMTP plus token issue/consume), `templates.ts`, `notifications.ts` |
| `server/src/sms/` | `sms-client.ts`, `sms-messages.ts` — optional, silent when unconfigured |
| `server/src/payments/` | `nalopay.ts` (collections, payouts, verification), `callback.routes.ts` (signed webhook) |
| `server/src/config/` | `env.ts` — Zod-validated environment, with AI, email, SMS, and payments all optional |
| `server/src/lib/` | `prisma.ts`, `jwt.ts`, `errors.ts`, `async-handler.ts`, `logger.ts`, `money.ts`, `google-calendar.ts` |

The frontend is a Vite React application. `client/src/` holds `api/` (one `apiRequest`
helper in `client.ts`, typed wrappers in `endpoints.ts`), `auth/` (an `AuthProvider` that
bootstraps the session from `GET /users/me`), `components/`, `hooks/`, and `pages/`.
Routing is `react-router-dom` in `client/src/App.tsx`, where `RequireAuth` and
`RequireRole` wrap the private routes: intake screens for `USER`, profile and wallet for
`LAWYER`, `/app/admin/*` for `ADMIN`. The client never contains a prompt, a provider key,
or a matching rule.

## Major workflows

### Citizen concern to consultation — FR-006 to FR-014

`IntakePage.tsx` posts the description to `POST /intakes`. `createIntake`
(`legal-intake.service.ts`) writes the row **before** calling `triageLegalIssue`
(`ai/legal-triage.service.ts`), which is ADR-002: the citizen's own words survive any
provider failure. Triage returns a category, urgency, keywords, a neutral summary, and a
confidence, all parsed through `ai/schemas.ts` before anything is stored.

`RecommendationsPage.tsx` then calls `GET /intakes/:intakeId/recommendations`, which
`recommendLawyers` (`matching.service.ts`) answers with scored candidates and a reason
string per candidate. Selecting one posts `POST /consultations`;
`createConsultation` snapshots the lawyer's fee and opens the request at
`AWAITING_PAYMENT`. `POST /consultations/:id/pay` starts the mobile-money collection
through `payments/nalopay.ts`, and only when the collection is confirmed — by the polled
`verify-payment` call or by the signed callback — does `markPaid` move the request to
`PENDING` and notify the lawyer. The lawyer opens `RequestDetailPage.tsx`, reads the
structured intake, and `PATCH /consultations/:id` records `ACCEPTED` (with a Meet URL) or
`DECLINED`.

### Lawyer onboarding to visibility — FR-016, FR-015, FR-018

`RegisterPage.tsx` with `accountType: 'lawyer'` creates a `LAWYER` user and a
`LawyerProfile` at `approvalStatus: PENDING`; the applicant cannot set that field, which
`rejectSelfApproval` in `lawyers.routes.ts` enforces. An admin approves from
`AdminLawyersPage.tsx` through `PATCH /lawyers/:id`. Approval alone does not publish the
profile: `publicLawyerWhere` in `lawyers/eligibility.ts` is the single predicate for
visibility, and it requires an approved profile, an active account, and an unexpired plan.

That predicate is used by the directory, by matching, and by consultation creation, so
there is one definition of "eligible" rather than three:

```ts
export function publicLawyerWhere(now = new Date()): Prisma.LawyerProfileWhereInput {
  return {
    approvalStatus: ApprovalStatus.APPROVED,
    user: { status: UserStatus.ACTIVE },
    subscriptionPackageId: { not: null },
    subscriptionPeriodEnd: { gt: now },
  };
}
```

### The money path — FR-017, FR-020, FR-021

A paid consultation fee is held, not paid out. `confirmConsultation` requires a
confirmation from both the client and the lawyer; only then does `creditConsultationFee`
(`wallet.service.ts`) write the `WalletLedger` credit, mark the consultation `COMPLETED`,
and stamp `settledAt`. A cancellation or decline after payment goes to `refundHeldFee`,
which issues a `REFUND` payout to the paying number. Withdrawals from `WalletPage.tsx`
debit the ledger and start a payout, with `capturePayoutCallback` recording the outcome.
The disbursement leg is the least-proven part of the system and is recorded honestly as
TD-028.

## Important algorithms

### Deterministic matching — FR-011, NFR-007, ADR-001

`matching.service.ts` filters to eligible lawyers whose practice areas include the intake
category, scores them with fixed integer weights, and sorts with explicit tie-breaks:

```ts
const WEIGHT = { practiceArea: 100, region: 30, city: 15, available: 20 } as const;
```

Score is `practiceArea` plus `region` when the intake region matches case-insensitively,
plus `city` on the same basis, plus `available` when the lawyer is marked available. Ties
fall to more years of experience, then display name, then id, so the same intake always
produces the same order. At most ten recommendations are returned. When triage produced no
category, or the fallback category `Other / Needs Review`, matching is skipped rather than
guessed at. The weights are chosen, not calibrated — TD-022.

### Confidence handling and fallback — FR-007, FR-009, FR-010

`legal-triage.service.ts` treats `LOW_CONFIDENCE_THRESHOLD = 0.5` as the review line.
Below it the intake is flagged `needsHumanReview` with a note explaining why; a category
outside the configured list is replaced by `Other / Needs Review` rather than accepted. A
provider timeout, network error, or schema-invalid response produces an `AiStatus` of
`FAILED_FALLBACK` with an excerpt summary — no exception escapes to the caller, which is
how NFR-003 is met. The threshold is judgement, not measurement — TD-011.

For that fallback to run at all, the provider wait has to end before the host stops the
invocation it runs inside. `ai-client.ts` therefore caps the wait at 25 seconds
(`providerWaitMs`) instead of trusting `AI_REQUEST_TIMEOUT_MS`, which was configured at 180
seconds against a 60-second Vercel ceiling — DEF-014, found by walking the deployed site.

### Directory paging and search — FR-012

`GET /lawyers` takes `limit` (default 20, maximum 50) and `offset`, and returns
`{ results, total, limit, offset }`. The `q` term matches display name, firm, and bio
case-insensitively. Both choices are deliberately simple and both are logged as debt:
offset paging drifts under concurrent writes (TD-018) and a case-insensitive `LIKE` is not
real search (TD-019). Other list endpoints return a bounded set without paging.

## Database implementation

PostgreSQL through Prisma. Twelve models — `User`, `EmailToken`, `LawyerProfile`,
`SubscriptionPackage`, `SubscriptionPayment`, `LegalCategory`, `LawyerPracticeArea`,
`LegalIntake`, `ConsultationRequest`, `WalletLedger`, `WithdrawalRequest`, `Payout` — and
thirteen enums, including `Role`, `ConsultationStatus`, `AiStatus`, and
`ApprovalStatus`. Money is stored as integer pesewas throughout (`lib/money.ts`); no
floating point touches a fee.

Integrity is expressed in the schema rather than in application checks where possible:
`User.email`, `EmailToken.tokenHash`, `LawyerProfile.userId`, category and package
name/slug, and every payment reference are unique, and
`ConsultationRequest (intakeId, lawyerProfileId)` is unique so the same intake cannot be
sent to the same lawyer twice — the constraint that produces DEF-007. `WalletLedger` is
unique per consultation, which makes a double credit impossible rather than unlikely.
Indexes cover the read paths that matter: `(approvalStatus, isAvailable)`, `(region)`, and
`(subscriptionPackageId, subscriptionPeriodEnd)` on lawyer profiles,
`(lawyerProfileId, status)` and `(clientId)` on consultations.

Eleven migrations exist under `server/prisma/migrations/`, applied with
`prisma migrate deploy` in CI, in tests, and against the hosted database. `prisma/seed.ts`
upserts the nine categories, three plans, and an admin; it never rewrites an existing
admin password, only filling in `emailVerifiedAt` if it is missing. Demo accounts are
created only when `SEED_DEMO_DATA=true`.

## API design

Versioned from the first commit at `/api/v1` (ADR-007), with an unversioned
`GET /api/health` for the platform. Successful responses are the resource itself, with no
wrapper envelope; a `204` carries no body. Errors are uniform:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ ... ] } }
```

`lib/errors.ts` provides the factories that fix the status codes — `badRequest` 400,
`unauthorized` 401, `forbidden` 403, `notFound` 404, `conflict` 409, `unprocessable` 422,
`serviceUnavailable` 503 — and `middleware/error-handler.ts` maps Zod failures to 422 and
malformed JSON to 400 (ADR-011). Services therefore express intent, not HTTP.

## Authentication

Passwords are hashed with bcrypt at cost 12 (`BCRYPT_COST` in `auth.service.ts`) and the
hash is never selected into a response — `publicUserFields` decides what a user object
contains. Login issues a JWT through `lib/jwt.ts` carrying only `sub` and `role`, expiring
after `JWT_EXPIRES_IN` (default `2h`), signed with a `JWT_SECRET` that `config/env.ts`
refuses to accept below 32 characters. The client keeps the token in `localStorage` under
`lc_token` (`client/src/api/client.ts`) and treats its expiry as the session end. Holding it
there is a known exposure rather than an oversight — see TD-035.

Email verification and password reset share one token mechanism in `email/mailer.ts`. The
emailed value is random; only its SHA-256 hash is stored. Issuing a token invalidates any
unused token of the same type, consuming one stamps `usedAt`, and lifetimes differ by
purpose — 24 hours to verify an address, one hour to reset a password. A successful reset
or password change consumes every outstanding reset token for that user.

## Authorization

Three roles, `USER`, `LAWYER`, `ADMIN`, as a Prisma enum. `middleware/auth.ts` verifies
the token, re-reads the user on every request so a suspension takes effect immediately,
and `requireRole` gates by role. The admin router applies both once at the router level;
other modules gate per route.

Role is necessary but not sufficient — ownership is checked in the service, where the data
is. Intakes are scoped by `clientId`; consultations are scoped by `clientId` for a citizen
and by `lawyerProfileId` for a lawyer, with `AWAITING_PAYMENT` requests hidden from the
lawyer until they are paid; a lawyer edits their profile only through `/lawyers/me`. This
is why the security tests probe for another user's intake by id rather than trusting the
route guard.

## Validation

Every request body is parsed by a Zod schema declared in the module's `*.schema.ts` and
applied by `validateBody` (`middleware/validate.ts`), which replaces `req.body` with the
parsed value so handlers receive typed data. Failures reach the error handler as a
`ZodError` and become a 422 with a `details` array of `{ field, message }`. Path and query
parameters are parsed inline in the handlers with the same schemas; `validateParams` and
`validateQuery` exist and are unit-tested but are not currently wired into any route,
which is an inconsistency rather than a gap in coverage.

## Error handling

`asyncHandler` (`lib/async-handler.ts`) wraps handlers so a rejected promise cannot become
a hung request. `notFoundHandler` answers unknown routes. `errorHandler` is the only place
that decides a status code: an `AppError` reports its own, a `ZodError` becomes 422, body
parser failures become 400, 413, or 415, and anything unrecognised is logged through
`log.sys.error` and answered as a generic 500 so internals never reach a client in
production. Authorization refusals are logged on the security channel, payment problems on
the payment channel.

## Security controls

Present, and verifiable in code: `helmet()` and a CORS allowlist in `app.ts`; bcrypt
hashing; server-side enforcement of every role and ownership rule; HMAC verification of
the NaloPay callback (`payments/callback.routes.ts`); redaction of emails, phone numbers,
names, and intake text in `lib/logger.ts` so NFR-002 holds in the logs as well as the API;
`passwordHash` excluded from every response and payment account fields excluded from the
public directory; and the AI provider key read only inside `server/src/ai/`, with no AI
reference anywhere in `client/`.

Absent, and recorded rather than implied: there is no rate limiting on the anonymous read
endpoints (TD-023), no server-side token revocation before expiry (TD-003), and the
prompt-injection defence is a system-prompt instruction to treat the enquiry as data
rather than a filter (TD-013). The security test cases SEC-LG-001 to SEC-LG-036 in
`04-testing.md` state which of these are tested and which are known holes.

## Key third-party dependencies

| Dependency | Version | Used for |
| --- | --- | --- |
| `express` | ^4.21.2 | HTTP server and routing |
| `@prisma/client` / `prisma` | ^6.2.1 | Data access, migrations, seeding |
| `zod` | ^3.24.1 | Request and AI response validation, environment parsing |
| `bcryptjs` | ^2.4.3 | Password hashing |
| `jsonwebtoken` | ^9.0.2 | Session tokens |
| `helmet` | ^8.0.0 | Response security headers |
| `cors` | ^2.8.5 | Cross-origin allowlist |
| `nodemailer` | ^9.0.5 | Verification, reset, and notification email |
| `react` / `react-dom` | ^18.3.1 | Frontend rendering |
| `react-router-dom` | ^7.1.1 | Client routing and route guards |
| `antd` | ^6.6.0 | UI component library |
| `vite` | ^6.0.7 | Frontend build and dev server |
| `typescript` | ^5.7.3 | Types across both packages |
| `vitest` / `supertest` | ^4.1.10 / ^7.0.0 | Unit and API integration tests |

Full attribution, including the hosted services, is in `12-references.md`.

## Deviations from the original design

| Deviation | Why | Consequence |
| --- | --- | --- |
| Lawyers self-register and wait for approval, rather than being created by an admin | ADR-004 was superseded by ADR-006 once FR-016 was accepted | An approval queue and a `PENDING` state exist that the original design did not need |
| Subscriptions, a lawyer wallet, and fee escrow were added after the baseline | Product owner changes CH-018 to CH-022 during implementation | Six models and three payment paths beyond the approved MVP; `02-effort-estimation.md` re-estimates them and reports the variance |
| Visibility depends on a live plan, not only on approval | ADR-010, a consequence of FR-018 | `publicLawyerWhere` became the single eligibility predicate for directory, matching, and booking |
| The frontend was built alongside phases 6 to 8 instead of as its own phase | A backend slice was only demonstrably finished once a screen used it | The phase table in `03-architecture.md` records the actual order |
| Integration tests migrate a per-run `test_<pid>` schema | Concurrent runs corrupted a shared schema twice, CH-023 | Closed TD-009; a crashed run can still leave a schema behind |
| Fictional lawyer profiles are published on the live deployment | The deployed site has to be walkable by an examiner, CH-024 | Accepted for the examination window only, with removal steps in TD-032 |

## Verification

33 test files under `server/tests/` hold 385 automated cases, split by
`vitest.unit.config.ts` (pure logic, no database) and the integration config (Supertest
against a migrated schema). `04-testing.md` records what each covers and what it does not,
and `01-requirements.md` carries the requirement-to-test traceability matrix.
