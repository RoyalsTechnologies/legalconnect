# Technical debt register

Status: initial debt identified at design time (2026-08-12). Items TD-001 to TD-007 are
**accepted design trade-offs** unless a later status says otherwise. TD-008 is partially
mitigated on the server; the frontend is still untested.

Technical debt is worth 6 of 48 marks. Record actual trade-offs; never invent debt to fill
the document and never hide it.

## Entry format

Every item follows **Debt → Cause → Impact → Priority → Proposed resolution**, with
category, status, target, and the related requirement or module.

## Register

### TD-001 — Prompt-based classification instead of a trained classifier

**Cause:** No labelled Ghanaian legal-issue dataset exists and none can be built in 48
hours (CON-001).
**Impact:** Classification quality is unmeasured and depends on a general-purpose model.
Accuracy cannot be claimed, only observed on a handful of examples.
**Priority:** Medium · **Category:** architecture · **Status:** Acceptable temporarily
**Resolution:** Build a labelled evaluation set, measure category agreement, then consider
a fine-tuned or classical classifier.
**Target:** v1.1 · **Related:** FR-007, `server/src/ai/`

### TD-002 — Synchronous AI call on the request path

**Cause:** ADR-002 chose to persist then enrich in-request rather than introduce a queue,
which CON-001 and the no-extra-infrastructure rule rule out.
**Impact:** `POST /api/v1/intakes` is as slow as the provider, so NFR-006's 2-second target
cannot apply to it. Under load the API holds connections open.
**Priority:** Medium · **Category:** performance · **Status:** Scheduled for future
resolution
**Resolution:** Move triage to a background worker and have the client poll or subscribe;
`aiStatus = PENDING` already models this state.
**Target:** v1.2 · **Related:** FR-007, NFR-006

### TD-003 — No server-side token revocation

**Cause:** ADR-003 chose stateless JWTs to avoid a session store.
**Impact:** A stolen token stays valid until it expires; logout only discards it client-
side. An admin cannot force-terminate a session.
**Priority:** Medium · **Category:** security · **Status:** Acceptable temporarily
**Resolution:** Short expiry plus refresh tokens with a server-side revocation list.
**Target:** v1.1 · **Related:** FR-002, NFR-001

### TD-004 — No feedback-informed matching

**Cause:** ADR-001 chose fixed deterministic weights for explainability and testability.
**Impact:** Weights are asserted by the developer, not validated against outcomes. Match
quality cannot improve from usage.
**Priority:** Low · **Category:** architecture · **Status:** Acceptable temporarily
**Resolution:** Capture acceptance and completion outcomes, then tune weights against them.
**Target:** v1.2 · **Related:** FR-011, NFR-007

### TD-005 — No lawyer self-onboarding or licence verification

**Cause:** ADR-004 removed the verification slice to protect the schedule.
**Impact:** Was: lawyers could not join without an admin. Now they can self-register
(ADR-006 / FR-016), but `approvalStatus` still means "an admin approved this record", not
"this person's licence was checked against a register".
**Priority:** High for production, Low for the MVP · **Category:** architecture
**Status:** Partially mitigated
**Resolution:** Remaining work is document upload and a check against a professional
register. Self-service registration with admin approval is implemented.
**Target:** Future major version · **Related:** FR-004, FR-015, FR-016, ADR-006

### TD-006 — Single AI provider with no failover

**Cause:** CON-004 permits one provider; a second adapter and its testing were not
budgeted.
**Impact:** A provider outage sends every intake down the fallback path. The product
degrades correctly (NFR-003) but the AI feature is wholly unavailable.
**Priority:** Low · **Category:** dependency · **Status:** Acceptable temporarily
**Resolution:** A second adapter behind the existing interface with health-based
switching. The NFR-005 boundary is what makes this cheap later.
**Target:** v1.2 · **Related:** NFR-003, NFR-005

### TD-007 — Legal intake data sent to an external provider

**Cause:** Triage requires an external LLM; no self-hosted model is feasible under CON-001.
**Impact:** Sensitive personal legal information leaves the application boundary and is
processed under a third party's terms. This is a privacy consideration that must be
disclosed to users and documented in the limitations, not a defect to be hidden.
**Priority:** High · **Category:** data · **Status:** Acceptable temporarily, requires
disclosure
**Resolution:** Send the minimum necessary text, state the processing clearly in the UI and
privacy notice, and evaluate a self-hosted or in-region model.
**Target:** v1.1 for disclosure, future major version for self-hosting
**Related:** NFR-002, CON-003

### TD-008 — Targeted rather than broad test coverage

**Cause:** E-13 budgets 4.5 hours; broad coverage was estimated near 12.
**Impact:** Server `src/` is measured at **95.86% statements / 97.39% lines / 99.64%
functions / 89.16% branches** (`npm run test:coverage`, 2026-08-15, 385 tests). Remaining
server gaps are env-gated mail paths and defensive catches. **The React client still has
no component tests**, so isolated UI regressions would not be caught. Playwright E2E
covers landing, citizen intake, and lawyer plan payment against a mocked `/api/v1`.
**Priority:** Medium · **Category:** testing · **Status:** Partially mitigated
**Resolution:** Add frontend component tests. Remaining server branch gaps are listed in
`docs/04-testing.md`.
**Target:** v1.1 · **Related:** All, `server/tests/`, `client/src/`

### TD-009 — Tests share one database schema and run sequentially (resolved)

**Cause:** Phase 2 test setup truncates a shared `test` schema before each test, so
`fileParallelism` is disabled to stop parallel workers truncating each other's data.
**Impact:** Two costs. The suite runs sequentially and gets slower as coverage grows — 52 s
for 131 tests. More seriously, **two suite runs overlapping in time destroy each other**,
because the schema is shared across processes as well as across workers. Measured on
2026-08-12: starting a second run three seconds after the first produced 52 and 53 failures
respectively, against 0 when either runs alone. The failures are unique-constraint
collisions on seeded emails and rows vanishing mid-test, and they present as authorization
and validation failures, which is thoroughly misleading — the first instinct on seeing
`SEC-LG-001` fail is to go looking for an access-control bug that is not there. It recurred
on 2026-08-15 during editing, costing two runs (108 then 112 failures) before the signature
was recognised again — `seedPackages()` counting zero rows and then colliding on a unique
name, truncated admin rows reappearing as duplicate emails.
**Priority:** Medium · **Category:** testing · **Status:** **Resolved**
**Resolution:** `tests/global-setup.ts` now migrates a per-run schema, `test_<pid>`, exported
to the workers as `LC_TEST_SCHEMA` and dropped on teardown, so overlapping runs no longer
share tables. Verified 2026-08-15 by starting two suites in the same second: 23 and 53 tests,
both green, where the shared schema previously produced ~52 failures each. The suite still
runs serially within a run (`fileParallelism: false`), which remains the speed cost; a crashed
run can leave one `test_<pid>` schema behind.
**Target:** v1.1 · **Related:** `server/tests/`, `server/vitest.config.ts`

### TD-010 — Password reset and email verification (resolved)

**Cause:** Originally deferred as unbudgeted under CON-001.
**Impact:** Was: forgotten passwords required an admin; emails were unverified.
**Priority:** Medium · **Category:** security · **Status:** Resolved
**Resolution:** SMTP mailer with email verification on public registration, token-based
password reset, and login blocked until `emailVerifiedAt` is set. Lawyer/admin accounts
created by an admin are treated as verified. Credentials live only in `.env`.
**Target:** done · **Related:** FR-001, FR-002

### TD-011 — The low-confidence threshold was chosen by judgement, not measurement

**Cause:** `LOW_CONFIDENCE_THRESHOLD = 0.5` in `ai/legal-triage.service.ts` decides which
classifications go to human review. No labelled evaluation set exists to calibrate it
against, and building one was not affordable under CON-001.
**Impact:** The split between "trusted" and "needs review" is arbitrary. Set too low, wrong
categories reach users unflagged; too high, review volume becomes unusable. There is
currently no evidence for which is happening, and a self-reported LLM confidence is a weak
signal to begin with.
**Priority:** Medium · **Category:** AI quality · **Status:** Acceptable temporarily
**Resolution:** Label a set of representative Ghanaian enquiries, measure precision and
recall at several thresholds, and set it from the data.
**Target:** v1.1 · **Related:** FR-007, `AI-TC-003`

### TD-012 — No retry on a transient AI failure

**Cause:** The triage service falls back on the first failure. Retry with backoff was left
out to keep the request path simple and bounded.
**Impact:** A single blip — one timeout, one rate-limit response — sends an enquiry to
human review that a retry a second later would probably have classified. This inflates the
review queue with recoverable failures.
**Priority:** Low · **Category:** reliability · **Status:** Accepted
**Resolution:** One bounded retry for timeouts and `429`/`5xx` only, never for a schema
failure, which will fail identically on a retry.
**Target:** v1.1 · **Related:** FR-010, NFR-003

### TD-013 — Prompt-injection defence is instruction-only

**Cause:** The enquiry is user-controlled text placed in a prompt. The defences are an
instruction to treat it as data, strict output validation, and category whitelisting.
**Impact:** A crafted enquiry may still steer the model. The blast radius is genuinely
small — the worst achievable outcome is a wrong category or a misleading summary, both of
which sit next to the untouched original text and neither of which can execute anything or
reach another user's data. But it is not prevented, only contained.
**Priority:** Low · **Category:** security · **Status:** Accepted
**Resolution:** Add adversarial cases to the evaluation set and measure how often output
validation catches them.
**Target:** v1.1 · **Related:** CON-003, `AI-TC-007`

### TD-014 — AI failures are logged but not aggregated

**Cause:** `logFailure` writes a structured warning to stdout. There is no counter, no
alert, and no persisted failure rate.
**Impact:** `aiStatus` on each intake is the only record, so answering "is the provider
degraded right now" means querying the intake table. A sustained outage would show up as a
growing review queue rather than as an alert.
**Priority:** Low · **Category:** observability · **Status:** Accepted
**Resolution:** Count outcomes by `aiStatus` and expose them on an admin view or a metrics
endpoint.
**Target:** v1.1 · **Related:** NFR-003

### TD-015 — Renaming a category silently changes its slug

**Cause:** `updateCategory` regenerates the slug from the name, because leaving a slug
that contradicts its name is worse than changing it.
**Impact:** Nothing links by slug today, so this currently costs nothing. The moment a
public URL, a bookmark, or an external integration uses one, a rename becomes a silent
broken link with no redirect.
**Priority:** Low · **Category:** data · **Status:** Accepted
**Resolution:** Freeze the slug after creation and let admins change it deliberately, or
keep a table of previous slugs and redirect.
**Target:** v1.1 · **Related:** FR-005

### TD-016 — Admins set lawyer passwords by hand

**Cause:** `POST /api/v1/lawyers` takes a password because invitation-only onboarding was
out of MVP scope (ADR-004).
**Impact:** The admin still chooses the initial password. A welcome email now delivers
that temporary password to the lawyer when SMTP is configured, but there is still no
forced change on first login.
**Priority:** Medium · **Category:** security · **Status:** Partially mitigated
**Resolution:** Email a single-use invitation link and let the lawyer set their own
password; failing that, force a change on first login.
**Target:** v1.1 · **Related:** FR-004, ADR-004

### TD-017 — Lawyer directory has no search, filter, or pagination

**Cause:** Phase 3 built the profile and eligibility rules; FR-012's discovery features
were not in this slice.
**Impact:** `GET /api/v1/lawyers` returned every eligible lawyer in one unpaginated array
sorted by name. Fine at demonstration scale, unusable past a few hundred.
**Priority:** Medium · **Category:** performance · **Status:** **Resolved** in FR-012
**Resolution:** Added category, region, availability, and keyword filters with
offset pagination capped at 50 per page. Note the residual issue in TD-018 — this is
offset paging, not cursor paging as originally proposed.
**Target:** FR-012 completion · **Related:** FR-012, NFR-006

### TD-018 — Directory pagination is offset-based

**Cause:** Offset paging is a few lines and reads naturally against a `total` count, which
is what the UI needs to render "page 3 of 7". Cursor paging would have meant giving up the
total or running a second query for it.
**Impact:** Two costs, neither biting at present scale. Deep offsets make PostgreSQL scan
and discard every skipped row, so page 200 is measurably slower than page 1. And a profile
approved between two page requests shifts every later row, so an item can be seen twice or
missed. With tens of lawyers and a stable `(displayName, id)` sort, neither is observable.
**Priority:** Low · **Category:** performance · **Status:** Accepted
**Resolution:** Move to keyset pagination on `(displayName, id)` if the directory grows
past a few thousand profiles, accepting the loss of a cheap exact total.
**Target:** v1.2 · **Related:** FR-012, NFR-006

### TD-019 — Free-text search is a case-insensitive `LIKE`

**Cause:** `contains` across name, firm, and bio needed no extension, no index strategy,
and no migration.
**Impact:** No stemming, ranking, or typo tolerance — "evictions" does not find "eviction",
and results are ordered by name rather than relevance. Every query is a sequential scan
with a leading wildcard, so no index can help it.
**Priority:** Low · **Category:** performance · **Status:** Accepted
**Resolution:** Move to PostgreSQL full-text search with a `tsvector` column and a GIN
index, which brings stemming and relevance ranking without adding a search service — the
stack rules exclude one, and rightly so at this size.
**Target:** v1.2 · **Related:** FR-012

### TD-020 — Consultation status changes send no notification

**Cause:** Originally deferred with TD-010.
**Impact:** Was: citizens and lawyers had to poll the app for updates.
**Priority:** Medium · **Category:** functionality · **Status:** Resolved (email + SMS)
**Resolution:** Non-blocking email alerts on new request (to lawyer) and on
accepted / declined / cancelled (to citizen). Optional Nalo-style SMS uses the same
events when `SMS_*` env vars are set and the recipient has a usable phone number.
**Target:** done · **Related:** FR-013, FR-014

### TD-021 — Frontend duplicates the consultation transition rules

**Cause:** `RequestDetailPage` holds a copy of the role-to-status table so it can render
only the buttons that will succeed.
**Impact:** Two definitions of one rule. The server is authoritative and refuses anything
invalid, so a stale copy causes a confusing UI rather than a security hole — but the copy
can drift silently, since nothing fails if they disagree.
**Priority:** Low · **Category:** maintainability · **Status:** Accepted
**Resolution:** Have the API return the permitted next statuses on each consultation and
render from that, removing the second definition entirely.
**Target:** v1.1 · **Related:** FR-014

### TD-022 — Recommendation weights are chosen, not calibrated

**Cause:** The weights (practice area 100, region 30, availability 20, city 15) encode a
reasonable ordering, but no data exists to tune them against.
**Impact:** The ranking is defensible and fully explainable, which is what NFR-007 asks
for, but "region beats availability" is an assumption rather than a finding. A citizen may
be shown a distant available lawyer above a nearby one, or the reverse, based on a guess.
**Priority:** Low · **Category:** AI quality · **Status:** Accepted
**Resolution:** Once consultations accumulate, compare acceptance rates by matched
criterion and adjust. The weights are constants in one object precisely so this is a
one-line change rather than a refactor.
**Target:** v1.2 · **Related:** FR-011, TD-004

### TD-023 — No rate limiting on the anonymous read endpoints

**Cause:** Opening the directory, profile detail, and category list to anonymous callers
(ADR-009) removed the registration wall that had been incidentally limiting who could
call them. No rate limiter was added in its place, because the 48-hour scope prioritised
the access requirement itself over hardening it.
**Impact:** The directory can be scraped, and an unauthenticated caller can drive
arbitrary read load against Postgres — every listing runs a `findMany` and a `count`. No
private data is exposed; the risk is availability and the aggregation of published
profile data, not disclosure. The blast radius is bounded by these three endpoints being
read-only.
**Priority:** Medium · **Category:** security · **Status:** Accepted
**Resolution:** Add per-IP rate limiting at the edge or with `express-rate-limit` on the
`optionalAuth` routes, with a higher ceiling for authenticated callers. Cache the
category list, which is small and changes rarely.
**Target:** v1.1 · **Related:** FR-012, ADR-009, NFR-002

### TD-024 — Ant Design ships as one large client bundle

**Cause:** The UI was moved from Tailwind utility classes to Ant Design for consistent
forms, tables, and admin patterns. Vite currently emits a single JS chunk that includes
most of the component library.
**Impact:** Production bundle is ~1.1 MB minified (~350 KB gzip). Fine for a campus demo
and broadband Accra users; slower on constrained mobile networks.
**Priority:** Low · **Category:** performance · **Status:** Accepted
**Resolution:** Route-level `React.lazy` splits (admin vs citizen vs public) and Ant Design
tree-shaking / modular imports if measured load time becomes a problem.
**Target:** v1.2 · **Related:** NFR-008

### TD-025 — Consultation fees are collected, not settled to lawyers

**Cause:** FR-017 needed a book-and-pay path without a payouts product. NaloPay (when
configured) collects mobile money into the platform merchant account; locally the adapter
logs and marks paid.
**Impact:** FR-021 now holds the fee until both parties confirm, credits a wallet ledger,
refunds on cancel/decline after pay, and accepts withdrawal requests. Live MoMo *push*
still depends on an unverified disbursement URL (TD-028). Invoices and platform commission
are not built. NaloPay cannot POST the webhook to `localhost` and rejects a missing or
http `callback` (`PAY-INVAL-0069`); the adapter sends an https placeholder locally and
the client polls `collection-status` so a booking still completes.
**Priority:** Medium for production · **Category:** functionality · **Status:** Partially repaid
**Resolution:** Confirm the NaloPay disbursement contract (TD-028); receipts; commission if required.
**Target:** v1.1 · **Related:** FR-017, FR-021

### TD-026 — Lawyer plans are prepaid periods, not a recurring subscription

**Cause:** FR-018 needed an area cap and a paid plan without a billing product. NaloPay
collects one month or a yearly equivalent (12 × the current monthly fee) when the lawyer
pays; there is no mandate, webhook-driven renewal, or dunning. Admins can grant a period
for the demo.
**Impact:** A lapsed plan silently removes the lawyer from the directory and matching.
Changing plan carries unused days over — the purchased term is added to whatever is left —
but their *value* is not prorated, so a lawyer who upgrades gets the larger plan for days
bought at the smaller price, and one who downgrades keeps the cheaper plan for days bought
at the dearer price. There is no yearly discount — a year is exactly twelve monthly fees.
Platform subscription fees are not invoiced.
**Priority:** Medium for production · **Category:** functionality · **Status:** Accepted
**Resolution:** Recurring mobile-money or card mandates; reminder before period end;
proration; receipts; optional yearly discount.
**Target:** v1.2 · **Related:** FR-018

### TD-027 — Google Calendar is a template link, not a synced calendar

**Cause:** FR-019 needed a bookable slot and a video call without a Google Cloud OAuth
product. Meet rooms cannot be minted without the Calendar API and a signed-in Google user.
**Impact:** The client adds the event themselves via Google's create-event URL. The lawyer
must open Meet, copy a room link, and paste it when accepting. There is no busy/free
check, no reschedule flow, and no automatic Meet conference on the event.
**Priority:** Medium for production · **Category:** integration · **Status:** Accepted
**Resolution:** Google OAuth (Calendar API `conferenceData`) so accept creates the event
and Meet room; optional lawyer availability calendar.
**Target:** v1.1 · **Related:** FR-019

### TD-028 — NaloPay disbursement URL is not confirmed

**Cause:** FR-021 needed refunds and withdrawals. Public NaloPay docs in this repo only
cover collection (`/clientapi/collection/`). Payouts call `/clientapi/disbursement/` with
the same token and trans_hash pattern. Tests and local-without-credentials capture
immediately; production without credentials or a rejected live call is a 503.
**Impact:** In-app ledger is the source of truth. Live MoMo push to lawyers or refunds to
clients may fail until the merchant contract is confirmed. Do not add a second PSP.
**Priority:** High for production · **Category:** integration · **Status:** Accepted
**Resolution:** Confirm path and payload with NaloPay; keep test/log capture for local demo.
**Target:** v1.1 · **Related:** FR-021

### TD-029 — File logs do not persist on serverless hosts

**Cause:** FR-style operational logging writes `sys.log`, `security.log`, `payment.log`,
and `notification.log` under `server/logs/`. Vercel Functions (and Render free disks) have
no persistent filesystem.
**Impact:** After a sleep, restart, or redeploy those files are gone. Stdout still carries
the same lines for the host log viewer.
**Priority:** Low · **Category:** observability · **Status:** Accepted
**Resolution:** Ship logs to the platform viewer, or attach a disk / log drain if the
product outlives the exam.
**Target:** v1.2 · **Related:** NFR-001, NFR-002

### TD-030 — Prisma on Vercel without a connection pooler

**Cause:** The exam host is Vercel. Each Function invocation may open a new Postgres
connection. Prisma was kept (stack rule) rather than introducing Redis or a second ORM.
**Impact:** A burst of traffic can exhaust the database `max_connections`. Cold starts are
slower than a long-lived Node process.
**Priority:** Medium for the live exam URL · **Category:** infrastructure · **Status:** Accepted
**Resolution:** Use a pooled URL (Supabase pooler + Prisma `directUrl`, or Neon `-pooler`).
Do not add another datastore. The exam deploy uses the Supabase direct URI as
`DATABASE_URL` so migrate and the Function share one connection string.
**Target:** v1.1 · **Related:** NFR-008, CON-002

### TD-031 — Live mobile-money capture is unverified at real consultation fees

**Cause:** The only NaloPay merchant available is the test merchant on
`nalopaytest.nalosolutions.com`. Probed on 2026-08-15 from inside the server container, it
accepts collections of GH₵ 0.10 to GH₵ 5.00 (`201 PAY-CRTD-0055`, with an `order_id`) and
rejects GH₵ 6.00 and above with `400 PAY-INVAL-0058`, "Invalid value for amount" (re-probed
2026-08-15 with the amount as a two-decimal string, a bare string, and a JSON number — all
three are refused identically, so the ceiling is the value, not the format). Demo
consultation fees are GH₵ 150–300, so a real fee cannot be collected there. Two further
blockers are independent of the cap: the demo MSISDN is fictional, so nobody can approve the
prompt, and the callback cannot reach `localhost` (TD-025).
**Impact:** UAT-003 can demonstrate booking, the payload and `trans_hash` being accepted,
and the pending prompt, but not a completed live capture at a real fee. Capture in a
walkthrough therefore relies on the credentials-unset path, which logs and marks paid. A
production deployment carrying these test credentials would reject every real consultation
fee with a 422, so the merchant has to be swapped before the payment path handles money.
**Priority:** High for production · **Category:** integration · **Status:** Accepted
**Resolution:** A live merchant account with a normal transaction ceiling, a public callback
URL, and one end-to-end capture approved on a real handset. Until then do not describe live
payment as verified.
**Target:** v1.1 · **Related:** FR-017, TD-025, UAT-003

### TD-032 — Fictional practitioners are published on the public deployment

**Cause:** The examination requires a deployed application an examiner can walk through, and
the directory, matching, and consultation flows are empty without lawyers. The hosted
database was therefore seeded on 2026-08-15 with `SEED_DEMO_DATA=true`, creating five
`APPROVED` fictional lawyer profiles with a shared, known password — the exact thing the
seed script's own comment warns against doing outside local demonstration.
**Impact:** The live URL is public. A member of the public who finds it sees five invented
practitioners presented the same way a real one would be, and could send a consultation
request that no lawyer will ever read. The shared demo password also means any visitor who
guesses it can sign in as one of those lawyers. This is a deliberate trade-off for
assessability, not an oversight, and it is the one place where the deployed system is
knowingly misleading.
**Priority:** Medium · **Category:** data · **Status:** Accepted for the examination window
**Resolution:** Three options in order of preference. Take the deployment down or restrict it
once assessed; or replace the demo seed with real, verified practitioners who have consented;
or mark demonstration profiles with a flag the interface renders as a visible notice, so no
visitor can mistake one for a real lawyer. Do not leave it as it stands beyond assessment.
**Target:** immediately after assessment · **Related:** FR-004, FR-011, CON-003,
`server/prisma/seed.ts`

### TD-033 — The integration suite fails a test occasionally, as if fresh data were missing

**Cause:** Unknown. On 2026-08-15 the suite failed intermittently in a way that looks like
recently written rows not being visible to the request that follows. Three occurrences, all
in otherwise green runs of 220 tests:

| Run | Test | Symptom |
| --- | --- | --- |
| 13:59 | `subscriptions.test.ts`, admin creates a package | `expected 401 to be 201` |
| reproduction, run 1 of 3 | `lawyers.test.ts`, IT-025 | `expected 401 to be 200` |
| after the fixture change, run 4 of 4 | `matching.test.ts` and `subscriptions.test.ts` IT-056 | `expected 404 to be 200` |
| pre-submission `npm run verify` | `consultations.test.ts`, `seedIntake` | Prisma: `Argument 'client' is missing` |
| the `verify` immediately after | `subscriptions.test.ts` IT-073 | `expected undefined to equal { … }` on `GET /lawyers/me` |
| the `verify` after that | `consultations.test.ts` SEC-LG-023 | `expected 401 to be 404` |

The first two shared a cause and are addressed: both fixtures minted their session by posting
to `/auth/login`, so a sign-in that returned no token surfaced as a 401 against an unrelated
endpoint. Fixtures now sign tokens directly (`tests/session.ts`) and no 401 of this kind has
appeared since.

The fourth occurrence, in the pre-submission `npm run verify`, exposed the same *shape* of
mistake in a place CH-025 had not looked. `seedIntake` called `GET /users/me` to learn the id
its token already carried, so one unsuccessful response left `clientId` undefined and Prisma
reported a missing argument — again in a test of something else entirely. The three fixtures
doing this (`consultations`, `matching`, `nalopay-http`, plus one inline case in
`subscriptions`) now read the id from the token with `verifyToken`. Tests that genuinely
exercise `/users/me`, in `auth.test.ts`, `admin.test.ts`, and `error-handling.test.ts`, still
call it.

A sixth run failed at `consultations.test.ts` SEC-LG-023 with `expected 401 to be 404` — a
`requireAuth` rejection where the test was checking an ownership rule. The fixtures that build
a citizen still register over HTTP and took `res.body.token` on trust, so a registration that
did not return one handed `Bearer undefined` to the next request. Those six fixtures now go
through `tokenFrom`, which throws naming the status and body of the registration response
instead of passing a missing token forward.

The fifth occurrence, on the run before, was an assertion rather than a fixture: a `GET
/lawyers/me` whose body lacked `paymentAccount`. Because the test read `.body` without first
checking `.status`, the failure was reported as `expected undefined to equal { … }` — which
says nothing about whether the request was refused, empty, or answered with something else
entirely. The three assertions of that shape now check the status first. That does not fix the
intermittent; it makes the next occurrence say what actually happened, which is the diagnostic
this entry has been missing every time.

Three of the six are now explained and closed at source. The third occurrence (the `404`) and
the fifth remain unexplained in cause, and the sixth is only *diagnosable* rather than fixed:
if a registration fails again the suite will now say so, but nothing yet says why one would.
The suite is **not** proven clean. The full gate ran green after these changes — 164 unit, 220
integration, both typechecks, lint, and audit — which is one clean gate, not a demonstration
of stability across runs.

The pattern behind three of the four is worth naming, because it is the actual lesson: a
fixture that reaches for a real endpoint to obtain setup data makes every test in the file
depend on that endpoint, and reports the dependency's failure as a failure of whatever was
being tested. Fixtures should construct state by the shortest reliable route — the database or
a signing function — and leave endpoints to the tests that are about those endpoints.

The usual explanations were checked and ruled out for all three: no rate limiter on login,
integration files run serially on a single worker (`fileParallelism: false`, `maxWorkers: 1`),
no other test run or dev server overlapped any of them, and the per-run schema isolation from
TD-009 was in place throughout.
**Impact:** Low for correctness, real for confidence. Roughly one full run in eight fails a
test that passes on a rerun, which trains a reader to dismiss red as noise — the habit that
lets a genuine regression through. No failure has ever pointed at faulty production code; each
one has been a fixture reading state that should have been there.
**Priority:** Low · **Category:** testing · **Status:** Open, two occurrences unexplained
**Resolution:** Capture the failing response body and the server-side reason at the moment it
happens, rather than reasoning backwards from the assertion — that is what was missing every
time. Run the suite in a loop writing full output per run until it reproduces. Do not
close this by adding retries, which would convert a visible intermittent into an invisible
one.
**Target:** v1.1 · **Related:** TD-009, `tests/session.ts`

### TD-034 — Acceptance testing has no independent participants

**Cause:** NFR-004 asks whether a first-time user can reach a recommendation without legal
vocabulary. The only person who ran the UAT scripts is the person who built the system, which
is the one participant who cannot answer that question. CON-001 left no window to recruit
anyone, and the individual-work rule ruled out the obvious substitutes.
**Impact:** The usability requirement is unevidenced rather than unmet. A developer walks the
path he designed, so the walkthrough proves the flow works, not that it is discoverable. The
wording that a stranger would stumble over is exactly the wording that reads as obvious to its
author, so this is the failure mode most likely to survive to production undetected.
**Priority:** Medium · **Category:** validation · **Status:** Accepted, requirement recorded
as partially met
**Resolution:** Run the existing UAT scripts with three to five people who have not seen the
system, recording where they hesitate rather than only whether they finish. No code change is
needed — the scripts and the evidence format already exist.
**Target:** Before any real user is invited on · **Related:** NFR-004, UAT-001, UAT-003…006

### TD-035 — The session token is held in `localStorage`

**Cause:** ADR-003 chose stateless JWTs, and `localStorage` was the shortest path to keeping
one across a page reload in a SPA. An `HttpOnly` cookie would have meant CSRF protection and
a same-site story across the Vercel deployment, which was more than the schedule allowed.
**Impact:** Any script that executes on the page can read the token, so a single XSS becomes a
full session takeover for its two-hour lifetime, and TD-003 means it cannot be revoked once
taken. React escapes rendered content by default and the app sets no `dangerouslySetInnerHTML`,
so there is no known injection point today; the exposure is what a future one would cost.
**Priority:** Medium · **Category:** security · **Status:** Accepted
**Resolution:** Move the session to an `HttpOnly`, `Secure`, `SameSite=Strict` cookie issued by
the API, add CSRF protection for state-changing routes, and keep only non-sensitive display
state in the browser. Best done with TD-003, since a server-side session store answers both.
**Target:** v1.1 · **Related:** TD-003, ADR-003, NFR-001

### TD-036 — No rate limiting on authentication endpoints

**Cause:** TD-023 recorded the missing limiter on the anonymous read endpoints and stopped
there. The same omission applies to sign-in, password reset, and verification resend, which
matter more: those three are the ones an attacker profits from repeating.
**Impact:** Sign-in can be attempted without limit, so password strength is the only thing
standing between a guessed credential and an account. bcrypt at cost 12 slows an online attack
to roughly a few attempts per second per core, which is a brake rather than a stop. Reset and
resend can be driven in a loop to flood a user's mailbox and burn the email quota.
**Priority:** High · **Category:** security · **Status:** Open
**Resolution:** Apply `express-rate-limit` per IP and per account to `/auth/login`,
`/auth/forgot-password`, and `/auth/resend-verification`, with lockout after repeated
failures and a log line per rejection. At two points this is the smallest of the open security
items and the one to do first, even though TD-007 carries the wider impact.
**Target:** Before any real user is invited on · **Related:** TD-023, TD-035, NFR-001, FR-002

### TD-037 — Flagged intakes are counted but there is no queue to work them

**Cause:** FR-010 requires that a failed or low-confidence triage leave a *reviewable*
workflow. The flag, the holding category, and the preserved original text were built, and the
admin dashboard counts how many intakes carry the flag. The screen that would let an
administrator open those intakes and set a category by hand was not built, because the
citizen-facing half of the fallback — never losing the text, never showing an error page,
still being able to browse and contact lawyers — was the half that protects the user.
**Impact:** The system fails safe but does not recover. An administrator can see that eleven
enquiries need review and cannot act on any of them, so a flagged intake stays flagged and the
citizen's only route forward is the directory. The requirement is met from the citizen's side
and only partly from the administrator's, which is why FR-010 is recorded with that
qualification rather than as fully delivered.
**Priority:** Medium · **Category:** functionality · **Status:** Open, requirement partially
delivered
**Resolution:** An admin list filtered to `needsHumanReview`, showing the original text, with
an action to assign a category and clear the flag. The data and the authorisation already
exist; this is one query, one endpoint, and one screen.
**Target:** v1.1 · **Related:** FR-010, FR-015, NFR-003

### TD-038 — The triage model is a free tier whose latency the request path cannot absorb

**Cause:** CON-004 fixed the budget at zero, so triage runs on a free OpenRouter model
(`nvidia/nemotron-3-ultra-550b-a55b:free`). Free capacity is queued behind paid traffic, so its
response time is not a property of this system and cannot be tuned from here. The call is
synchronous on the request path (TD-002), so whatever the provider takes, the citizen waits.
**Impact:** Measured on the deployment at 53.9 s for one enquiry (PERF-005) against a 60-second
platform ceiling. Until DEF-014 was fixed the request could be killed mid-flight, losing the
fallback that makes an AI failure survivable. The cap now converts a slow provider into an
unclassified-but-usable enquiry, which is the designed degradation — but it means a slow day at
the provider silently costs classification quality rather than failing loudly, and a citizen
still waits up to 25 seconds on a screen that only says it is working.
**Priority:** Medium · **Category:** dependency, performance · **Status:** Mitigated, not
resolved — the wait is bounded and the failure path is safe; the latency itself remains
**Resolution:** Two independent moves, either of which helps. Move triage off the request path
so latency stops being user-visible (TD-002), and/or use a paid model with a latency
commitment, which is a funding decision rather than an engineering one. Aggregating provider
timings (TD-014) would show whether the cap is being hit often enough to matter.
**Target:** v1.1 for the timing signal, v1.2 for moving triage off the request path
**Related:** DEF-014, PERF-005, TD-002, TD-006, TD-012, TD-014, CON-004, NFR-003, NFR-006

## Summary

| ID | Debt | Priority | Category | Status |
| --- | --- | --- | --- | --- |
| TD-001 | Prompt-based classification | Medium | architecture | Accepted |
| TD-002 | Synchronous AI call | Medium | performance | Scheduled |
| TD-003 | No token revocation | Medium | security | Accepted |
| TD-004 | No feedback-informed matching | Low | architecture | Accepted |
| TD-005 | No lawyer self-onboarding | Low (MVP) | architecture | Partially mitigated |
| TD-006 | Single AI provider | Low | dependency | Accepted |
| TD-007 | Intake data leaves boundary | High | data | Accepted, needs disclosure |
| TD-008 | Targeted test coverage | Medium | testing | Partially mitigated |
| TD-009 | Shared test schema; concurrent runs corrupt each other | Medium | testing | **Resolved** |
| TD-010 | Password reset and email verification | Medium | security | **Resolved** |
| TD-011 | Confidence threshold not calibrated | Medium | AI quality | Accepted |
| TD-012 | No retry on transient AI failure | Low | reliability | Accepted |
| TD-013 | Instruction-only prompt-injection defence | Low | security | Accepted |
| TD-014 | AI failures logged but not aggregated | Low | observability | Accepted |
| TD-015 | Renaming a category changes its slug | Low | data | Accepted |
| TD-016 | Admins set lawyer passwords by hand | Medium | security | Partially mitigated |
| TD-017 | Directory has no search, filter, or pagination | Medium | performance | **Resolved** |
| TD-018 | Directory pagination is offset-based | Low | performance | Accepted |
| TD-019 | Free-text search is a case-insensitive `LIKE` | Low | performance | Accepted |
| TD-020 | Consultation changes send no notification | Medium | functionality | **Resolved** |
| TD-021 | Frontend duplicates consultation transition rules | Low | maintainability | Accepted |
| TD-022 | Recommendation weights are chosen, not calibrated | Low | AI quality | Accepted |
| TD-023 | No rate limiting on the anonymous read endpoints | Medium | security | Accepted |
| TD-024 | Ant Design ships as one large client bundle | Low | performance | Accepted |
| TD-025 | Fees collected but not settled to lawyers | Medium (prod) | functionality | Partially repaid |
| TD-026 | Lawyer plans are prepaid periods, not recurring | Medium (prod) | functionality | Accepted |
| TD-027 | Calendar template + pasted Meet link, not OAuth sync | Medium (prod) | integration | Accepted |
| TD-028 | NaloPay disbursement URL not confirmed | High (prod) | integration | Accepted |
| TD-029 | File logs ephemeral on serverless hosts | Low | observability | Accepted |
| TD-030 | Prisma on Vercel without a pooler | Medium | infrastructure | Accepted |
| TD-031 | Live MoMo capture unverified at real fees (test merchant caps the amount) | High (prod) | integration | Accepted |
| TD-032 | Fictional practitioners published on the public deployment | Medium | data | Accepted for the examination window |
| TD-033 | Fixtures depending on live endpoints misreported failures; two occurrences still unexplained | Low | testing | Open, two occurrences unexplained |
| TD-034 | Acceptance testing has no independent participants | Medium | validation | Accepted |
| TD-035 | Session token held in `localStorage` | Medium | security | Accepted |
| TD-036 | No rate limiting on authentication endpoints | High | security | Open |
| TD-037 | Flagged intakes are counted but have no review queue | Medium | functionality | Open |
| TD-038 | Free-tier triage model's latency nearly outran the function ceiling | Medium | dependency, performance | Mitigated (DEF-014 capped the wait) |

No item is currently classified Critical. TD-007 is the highest-priority open item, on impact:
it touches every citizen who submits an enquiry. An earlier version of this paragraph said its
mitigation "must ship with the MVP rather than being deferred". It did not — the MVP shipped
without the disclosure, and saying otherwise here would misdescribe what was delivered. It
heads the v1.1 stage of the repayment plan instead — before the product is put in front of
real citizens — with TD-036, the other High-priority security item, immediately after it.
TD-010 and TD-020 are resolved via SMTP email (verification, reset, consultation
alerts) plus optional SMS for consultation alerts when gateway credentials and a
phone number are present. TD-016 remains partially open: welcome email delivers the temporary password, but
forced rotation on first login is still outstanding.

DEF-001 (admin seeded with an empty password) was a Critical **defect**, not debt: it was
fixed rather than accepted. See the defect log in `docs/04-testing.md`.

## Repayment plan

Every open item, with what repaying it involves, what has to be true first, when it is
targeted, and what the project gets back. Effort is in the story points defined in
`02-effort-estimation.md` — the same scale used to estimate the build, so these numbers can
be compared with the ones that were tested against reality. They are estimates, not
measurements. Resolved items (TD-009, TD-010, TD-017, TD-020) are not listed.

### Immediately after the examination window

| Debt | Repayment action | Priority | Prerequisite | Estimated effort | Expected benefit |
| --- | --- | --- | --- | --- | --- |
| TD-032 | Delete the fictional practitioner rows and their accounts; return the hosted database to categories, packages, and an admin only | Medium | Marking complete, so the walkthrough data is no longer needed | 1 | No invented practitioners on a public URL, which is the reason the item was accepted only for the window |

### v1.1 — before the product is used by real citizens or handles real money

| Debt | Repayment action | Priority | Prerequisite | Estimated effort | Expected benefit |
| --- | --- | --- | --- | --- | --- |
| TD-007 | User-facing disclosure that intake text is sent to an external provider, shown before submission, plus a data-minimisation review of what is sent | High | Privacy wording agreed and reviewed | 3 | The citizen consents knowingly; the highest-priority open item stops being silent |
| TD-036 | Per-IP and per-account rate limiting with lockout on `/auth/login`, `/auth/forgot-password`, and `/auth/resend-verification` | High | A counter store shared across serverless instances — same prerequisite as TD-023 | 2 | Online password guessing and mailbox flooding stop being unbounded |
| TD-028 | Confirm the disbursement endpoint with NaloPay and cover it with a contract test like the collection path | High (prod) | Live merchant account and a NaloPay technical contact | 3 | Withdrawals provably reach a lawyer instead of being assumed to |
| TD-031 | One approved end-to-end mobile-money capture at a real consultation fee | High (prod) | Live merchant credentials — the test merchant caps the amount | 2 | The payment path is proven at production amounts, not only below the cap |
| TD-003 | Refresh tokens with a server-side revocation list | Medium | Session model decision (short access token plus refresh) | 5 | Sign-out and compromise become effective immediately rather than at expiry |
| TD-035 | Move the session to an `HttpOnly`, `Secure`, `SameSite=Strict` cookie with CSRF protection on state-changing routes | Medium | Session model decision, shared with TD-003 | 3 | An XSS stops being a session takeover |
| TD-034 | Run the existing UAT scripts with three to five people who have not seen the system, recording hesitation rather than only completion | Medium | Access to participants outside the project | 2 | NFR-004 becomes evidenced rather than partially met |
| TD-037 | Admin list of intakes needing review, with an action to categorise and clear the flag | Medium | None — data and authorisation already exist | 2 | The fallback path recovers rather than only failing safe |
| TD-023 | Rate limiting on the anonymous read endpoints | Medium | A counter store the serverless host can share across instances — related to TD-030 | 2 | The directory resists scraping and login brute force |
| TD-016 | Force a password change on a lawyer's first login after an admin-set password | Medium | None — welcome email already delivers the temporary password | 2 | No account keeps a password a second person has seen |
| TD-030 | Put a connection pooler in front of Prisma on the serverless host | Medium | Hosting plan decision | 2 | Concurrent traffic stops exhausting Postgres connections |
| TD-008 | Extend coverage to the branches the targeted suite deliberately skipped | Medium | None | 3 | Regressions in less-exercised paths are caught by the suite, not by hand |
| TD-001 | Build a labelled evaluation set of Ghanaian legal enquiries, then decide on evidence whether a trained classifier is warranted | Medium | Enough real intake text, ethically obtained | 3 | The classification approach becomes a measured choice rather than an assumption |
| TD-011 | Calibrate the 0.5 confidence threshold against that set | Medium | TD-001 evaluation set | 2 | The review line is set by data instead of judgement |
| TD-027 | Create Meet rooms through the Calendar API with lawyer OAuth consent | Medium (prod) | Google Cloud project, consent screen, verified scopes | 5 | The lawyer stops pasting a link by hand, and the slot appears in a real calendar |
| TD-021 | Have the API return the permitted transitions with each consultation | Low | None | 2 | One definition of the lifecycle instead of a copy in the frontend |

### v1.2 — scale, quality, and operability

| Debt | Repayment action | Priority | Prerequisite | Estimated effort | Expected benefit |
| --- | --- | --- | --- | --- | --- |
| TD-025 | Automate settlement to lawyers, including whatever commission model is agreed | Medium (prod) | TD-028 disbursement confirmed; commercial terms decided | 5 | Money moves without a manual step; escrow becomes a complete cycle |
| TD-002 | Move triage off the request path with a queued or deferred worker | Medium | A background execution mechanism the host supports | 5 | Intake stops waiting on the provider; slow responses stop being user-visible |
| TD-006 | Second provider adapter behind the existing interface, with failover | Low | None — the adapter boundary already exists (NFR-005) | 3 | One provider outage stops degrading every intake |
| TD-013 | Structural prompt-injection defence: isolate and screen the enquiry rather than instructing the model to ignore it | Low | None | 3 | The defence stops depending on the model's compliance |
| TD-014 | Aggregate AI failures and confidence into a metric with a threshold | Low | TD-029 log destination | 2 | Provider degradation is noticed by the system, not by a user |
| TD-038 | Record provider latency per call alongside the failure metric, then decide between a paid model and moving triage off the request path | Medium | TD-014 for the timing signal; TD-002 for the deferred path; a budget for a paid model | 2 | The cap stops being a blind guard — how often the provider runs long becomes visible before a citizen notices |
| TD-029 | Ship logs to a hosted sink instead of files | Low | Choice of sink | 2 | Evidence survives a serverless invocation ending |
| TD-018 | Keyset pagination on the directory | Low | Directory large enough for the drift to matter | 2 | Stable pages while lawyers are added or expire |
| TD-019 | PostgreSQL full-text search with an index | Low | None | 3 | Search that ranks and handles stemming rather than substring matching |
| TD-022 | Calibrate the matching weights against consultation outcomes | Low | TD-004 outcome data | 3 | Ranking justified by results while staying deterministic |
| TD-004 | Feed accept, decline, and completion outcomes back into ranking inputs | Low | Enough consultation history to be meaningful | 5 | Recommendations improve with use, still explainably |
| TD-024 | Route-level code splitting and a trimmed component surface | Low | None | 2 | Faster first load on a Ghanaian mobile connection |
| TD-015 | Decouple a category's slug from its display name | Low | Migration for existing slugs | 1 | Renaming a category stops breaking anything that stored its slug |
| TD-012 | Retry a transient AI failure once with backoff before falling back | Low | None | 1 | Fewer intakes flagged for review for a momentary network fault |

### Future major version

| Debt | Repayment action | Priority | Prerequisite | Estimated effort | Expected benefit |
| --- | --- | --- | --- | --- | --- |
| TD-026 | Genuine recurring billing with a stored mandate and automatic renewal | Medium (prod) | Gateway support for recurring debits — not confirmed for NaloPay | 8 | Lawyers stop losing visibility because they forgot to pay |
| TD-005 | Verify practising certificates against a professional register, with document upload and review | Low (MVP) | A cooperating authority or an accepted manual review process | 8 | Approval means verified, not "an admin looked at it" |
| TD-007 (second stage) | Self-hosted or in-region model so intake text never leaves the boundary | High | Model quality acceptable at affordable hosting | 8 | The privacy problem is removed rather than disclosed |

Critical debt must not be deferred without explicit justification. None is currently
outstanding. The three High items — TD-007, TD-028, TD-031 — all sit in the first release
after the examination for the same reason: each one is a promise the product would
otherwise make without evidence.
