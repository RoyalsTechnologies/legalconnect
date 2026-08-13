# Technical debt register

Status: initial debt identified at design time (2026-08-12). Items TD-001 to TD-008 are
**accepted design trade-offs, not yet incurred in code** — each is dated and its status
updated when the corresponding code lands. Add new entries as real shortcuts are taken.

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
**Impact:** Coverage concentrates on auth, authorization, AI validation and fallback, and
matching. CRUD paths, most of the frontend, and edge cases are untested, so regressions
there would not be caught.
**Priority:** Medium · **Category:** testing · **Status:** Acceptable temporarily
**Resolution:** Extend to remaining service methods and add frontend component tests.
**Target:** v1.1 · **Related:** All, `server/tests/`

### TD-009 — Tests share one database schema and run sequentially

**Cause:** Phase 2 test setup truncates a shared `test` schema before each test, so
`fileParallelism` is disabled to stop parallel workers truncating each other's data.
**Impact:** Two costs. The suite runs sequentially and gets slower as coverage grows — 52 s
for 131 tests. More seriously, **two suite runs overlapping in time destroy each other**,
because the schema is shared across processes as well as across workers. Measured on
2026-08-12: starting a second run three seconds after the first produced 52 and 53 failures
respectively, against 0 when either runs alone. The failures are unique-constraint
collisions on seeded emails and rows vanishing mid-test, and they present as authorization
and validation failures, which is thoroughly misleading — the first instinct on seeing
`SEC-LG-001` fail is to go looking for an access-control bug that is not there.
**Priority:** Medium · **Category:** testing · **Status:** Accepted, with a caveat
**Resolution:** Give each run its own schema keyed by process id or `VITEST_WORKER_ID`, or
wrap each test in a transaction and roll back instead of truncating. Until then, never run
`npm test` and `npm run verify` concurrently, and treat a sudden burst of unrelated
failures as a suspected overlap before believing it.
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
logs and marks paid. Hosted checkout was not wired — collection is a MoMo prompt plus
signed webhook / status poll.
**Impact:** A paid booking does not transfer GH₵ to the lawyer. There is no refund,
invoice, or split. Production without NaloPay credentials refuses to capture. NaloPay
cannot POST the webhook to `localhost`; the client polls `collection-status` so a local
booking still completes without a public callback URL.
**Priority:** High for production · **Category:** functionality · **Status:** Accepted
**Resolution:** Merchant settlement report to lawyers; refunds; receipts; a public HTTPS
callback URL in deployed environments.
**Target:** v1.1 · **Related:** FR-017

### TD-026 — Lawyer plans are prepaid periods, not a recurring subscription

**Cause:** FR-018 needed an area cap and a paid plan without a billing product. NaloPay
collects one month or a yearly equivalent (12 × the current monthly fee) when the lawyer
pays; there is no mandate, webhook-driven renewal, or dunning. Admins can grant a period
for the demo.
**Impact:** A lapsed plan silently removes the lawyer from the directory and matching.
Upgrading or downgrading does not credit unused days. There is no yearly discount — a year
is exactly twelve monthly fees. Platform subscription fees are not invoiced.
**Priority:** Medium for production · **Category:** functionality · **Status:** Accepted
**Resolution:** Recurring mobile-money or card mandates; reminder before period end;
proration; receipts; optional yearly discount.
**Target:** v1.2 · **Related:** FR-018

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
| TD-008 | Targeted test coverage | Medium | testing | Accepted |
| TD-009 | Shared test schema; concurrent runs corrupt each other | Medium | testing | Accepted |
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
| TD-025 | Fees collected but not settled to lawyers | High (prod) | functionality | Accepted |
| TD-026 | Lawyer plans are prepaid periods, not recurring | Medium (prod) | functionality | Accepted |

No item is currently classified Critical. TD-007 is the highest-priority open item and its
mitigation — clear user-facing disclosure — must ship with the MVP rather than being
deferred. TD-010 and TD-020 are resolved via SMTP email (verification, reset, consultation
alerts) plus optional SMS for consultation alerts when gateway credentials and a
phone number are present. TD-016 remains partially open: welcome email delivers the temporary password, but
forced rotation on first login is still outstanding.

DEF-001 (admin seeded with an empty password) was a Critical **defect**, not debt: it was
fixed rather than accepted. See the defect log in `docs/04-testing.md`.

## Repayment plan

**v1.1** — TD-003 refresh tokens and revocation; TD-007 privacy disclosure and data
minimisation review; TD-001 labelled evaluation set; TD-008 extend coverage; TD-020
notifications; TD-021 server-supplied permitted transitions; TD-023 rate limiting on the
anonymous read endpoints.

**v1.2** — TD-002 asynchronous triage; TD-004 outcome-informed matching weights; TD-006
second provider adapter; TD-018 keyset pagination; TD-019 full-text search; TD-022
weight calibration.

**Future major version** — TD-005 licence verification against a professional register and
document upload; TD-007 self-hosted or in-region model.

Critical debt must not be deferred without explicit justification. None is currently
outstanding.
