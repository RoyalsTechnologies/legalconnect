# Analysis and design

Status: confirmed for MVP (2026-08-12). Update to match the system as actually built and
document any deviation rather than quietly revising the design.

## Analysis — core workflow

The critical workflow is AI-assisted intake. Analysed before choosing any technology:

| Aspect | Detail |
| --- | --- |
| Actor | USER |
| Input | Free-text legal concern, optional city and region |
| Validation | Authenticated; description non-empty, 20–5000 characters; location against known regions if supplied |
| Business rules | The intake persists **before** any AI call. AI may only classify into a configured category. Original text is immutable. |
| Data changes | `LegalIntake` created with `aiStatus = PENDING`, then updated to `COMPLETED` or `FAILED_FALLBACK` |
| Output | Category, summary, urgency, keywords, confidence — plus ranked eligible lawyers with reasons |
| Failure conditions | Provider unavailable, timeout, invalid JSON, out-of-list category, low confidence |
| Permissions | The author may read their own intake. A lawyer may read it only via a consultation request addressed to them. |
| External dependencies | One LLM provider, called server-side only |

The decisive analysis finding: **the AI provider is the only component that can fail in a
way the system does not control.** Everything else is local CRUD. That single fact drives
the architecture — persist first, call AI second, validate the response, and always leave
a path forward when it fails (FR-010, NFR-003).

## Architecture

```
┌─────────────────────────────────────────┐
│  React + Vite + Ant Design (client/)    │
└───────────────────┬─────────────────────┘
                    │ JSON over HTTPS, bearer token
┌───────────────────▼─────────────────────┐
│  Express REST API (server/)             │
│  routes → middleware (auth, validate)   │
├─────────────────────────────────────────┤
│  Service layer                          │
│  auth · lawyers · categories · intake   │
│  matching · consultations · admin       │
│  subscriptions                          │
├──────────────┬──────────────────────────┤
│  AI adapter  │  Prisma ORM              │
└──────┬───────┴───────────┬──────────────┘
       │                   │
┌──────▼────────┐   ┌──────▼──────────────┐
│ LLM provider  │   │ PostgreSQL          │
│ (external)    │   └─────────────────────┘
└───────────────┘
```

Three tiers plus one external service. No microservices, queues, Redis, Kubernetes, or
second datastore — none is justified by a requirement, and each would add deployment risk
against CON-001.

The AI adapter is the only place a provider SDK may be imported (NFR-005). Routes never
call it directly; they call the intake service, which calls the triage service, which
calls the adapter.

### AI request path

```
POST /api/v1/intakes
  → validate body (Zod)
  → persist LegalIntake (aiStatus = PENDING)   ← survives everything below
  → triage service
      → build prompt with allowed category list
      → AI adapter call with timeout
      → parse JSON
      → validate against Zod schema
      → check category ∈ configured list
  → success: update intake (COMPLETED)
  → failure: update intake (FAILED_FALLBACK, needsHumanReview = true)
  → return intake either way, HTTP 201
```

The intake is written before the AI call, so no provider outcome can lose a user's words.
The endpoint returns `201` on the fallback path too — an AI failure is a degraded result,
not a request failure.

`aiStatus` records which of those happened:

| Value | Meaning |
| --- | --- |
| `PENDING` | Written, triage not finished. Only visible mid-request. |
| `COMPLETED` | The model's output passed validation and was stored. |
| `FAILED_FALLBACK` | No usable output. Summary is an excerpt of the user's own text. |

An invented category is deliberately **not** a fallback. If the model returns a valid
response naming a category that does not exist, the summary, urgency, and keywords are
still good work — only the category is untrustworthy. That case stays `COMPLETED`, the
category is replaced with *Other / Needs Review*, and `needsHumanReview` is set. Collapsing
it into `FAILED_FALLBACK` would throw away a usable summary to punish one bad field.

`needsHumanReview` is set by the application, never by the model alone. It is true if the
category was not recognised, or confidence fell below the threshold, or the model asked for
review. The model can request review but cannot waive it (`SEC-LG-013`).

## API surface

All product endpoints sit under `/api/v1`:

| Prefix | Module |
| --- | --- |
| `/api/v1/auth` | Registration, login, logout |
| `/api/v1/users` | Own profile |
| `/api/v1/categories` | Legal category taxonomy — read for anyone, write for admins |
| `/api/v1/packages` | Lawyer plans — read for anyone, write for admins |
| `/api/v1/lawyers` | Lawyer directory with filters — read for anyone; own-profile editing, admin creation and approval require a session |
| `/api/v1/lawyers/me/subscription` | Lawyer pays for a month or a yearly equivalent of a plan |
| `/api/v1/lawyers/me/withdrawals` | Lawyer lists and requests wallet withdrawals |
| `/api/v1/intakes` | Legal issue submission and retrieval |
| `/api/v1/intakes/:id/recommendations` | Deterministic lawyer matching for one intake |
| `/api/v1/consultations` | Consultation requests and their status workflow |
| `/api/v1/consultations/:id/confirm` | Client or lawyer confirms the session happened |
| `/api/v1/payments/callback` | NaloPay signed webhook — no JWT; raw body for HMAC |
| `/api/v1/admin` | User management, suspension, platform statistics |
| `/api/health` | Operational probe — **not** versioned |

Four read endpoints — the directory, an individual profile, the category list, and the
plan list — use `optionalAuth` rather than `requireAuth`. They answer anyone, but the
answer depends on who asked: the public and citizens see approved lawyers on active
accounts with a live subscription, and only active plans; admins see every profile and
retired categories and plans. See ADR-009 and ADR-010.

Recommendations hang off the intake path rather than living at `/api/v1/matching`,
because a recommendation is meaningless without the intake it was computed for. The
resource nesting makes the ownership check the natural default: there is no way to ask
for recommendations without naming an intake the caller must be entitled to read.

Health sits outside the version deliberately. It is consumed by the container health
check and the host platform rather than by the product, so tying it to a version would
mean introducing `/api/v2` silently breaks every deployment probe.

## API error convention

Every error leaves the API in one shape, `{ "error": { "code", "message", "details?" } }`,
produced by a single Express error handler so no route invents its own format.

| Status | Meaning | Raised by |
| --- | --- | --- |
| `400` | The request could not be parsed | `express.json()` on invalid JSON |
| `401` | No valid credentials | Missing, expired, or malformed token |
| `403` | Authenticated but not permitted | Role guard, suspended account |
| `404` | No such route or resource | Router fallback, service lookups |
| `409` | Conflicts with existing state | Duplicate email on registration |
| `413` | Body exceeds the 100 kB limit | `express.json()` |
| `422` | Parsed correctly but failed the schema | Zod validation |
| `500` | Unexpected fault | Anything unhandled |

The `400`/`422` split is deliberate: `400` means the server could not read the request at
all, `422` means it was read fine and was semantically wrong. Only `422` carries
field-level `details`, because only then does the server know which field is at fault.

In production a `500` returns a fixed message; the underlying error is logged server-side
but never returned, so internal detail cannot leak through the error path (NFR-001).

## Data model

```
User 1───0..1 LawyerProfile ──< LawyerPracticeArea >── LegalCategory
 │                   │                                      │
 │                   │ 0..1                                 │
 │                   ˅                                      │
 │           SubscriptionPackage                            │
 │                   │                                      │
 │ 1                 │ 1                                    │ 0..1
 ˅                   ˅                                      ˅
LegalIntake 1───< ConsultationRequest >───────────────── (category)
LawyerProfile 1───< SubscriptionPayment >── SubscriptionPackage
```

| Entity | Purpose | Fields |
| --- | --- | --- |
| `User` | Account, credentials, role | id, email (unique), passwordHash, fullName, phone?, role, status, createdAt, updatedAt |
| `LawyerProfile` | Professional profile | id, userId (unique), displayName, firmName?, bio, licenseNumber?, city, region, isAvailable, approvalStatus, yearsExperience?, consultationFeePesewas, subscriptionPackageId?, subscriptionPeriodEnd?, paymentAccountName?, paymentPhone?, paymentNetwork?, createdAt, updatedAt |
| `SubscriptionPackage` | Plan capping practice areas | id, name (unique), slug (unique), description, monthlyFeePesewas, maxPracticeAreas, isActive |
| `SubscriptionPayment` | One prepaid plan payment | id, lawyerProfileId, packageId, feePesewas, periodDays, status, paymentReference?, paymentOrderId?, createdAt, updatedAt |
| `LegalCategory` | Configurable taxonomy | id, name (unique), slug (unique), description, isActive |
| `LawyerPracticeArea` | Specialisation join | lawyerProfileId, legalCategoryId — composite primary key |
| `LegalIntake` | Submitted concern and triage result | id, clientId, originalDescription, city?, region?, categoryId?, aiSummary?, urgency?, keywords[], confidence?, needsHumanReview, aiStatus, aiError?, createdAt, updatedAt |
| `ConsultationRequest` | Client ↔ lawyer request | id, intakeId, clientId, lawyerProfileId, status, clientMessage?, matchReason, feePesewas, paymentReference?, paymentOrderId?, scheduledAt, meetUrl?, clientConfirmedAt?, lawyerConfirmedAt?, payerPhone?, payerNetwork?, settledAt?, createdAt, updatedAt |
| `WalletLedger` | Signed pesewas for a lawyer | id, lawyerProfileId, amountPesewas, type CREDIT/DEBIT, consultationId? (unique), withdrawalId?, createdAt |
| `WithdrawalRequest` | Lawyer cash-out | id, lawyerProfileId, amountPesewas, status PENDING/PAID/FAILED, paymentReference?, paymentOrderId?, createdAt, updatedAt |
| `Payout` | MoMo send (refund or withdrawal) | id, type REFUND/WITHDRAWAL, amountPesewas, destinationPhone, destinationNetwork?, status, paymentReference?, paymentOrderId?, consultationId?, withdrawalId?, createdAt, updatedAt |

Enums: `Role` = USER · LAWYER · ADMIN. `UserStatus` = ACTIVE · SUSPENDED.
`ApprovalStatus` = PENDING · APPROVED · REJECTED. `Urgency` = NORMAL · IMPORTANT · URGENT.
`AiStatus` = PENDING · COMPLETED · FAILED_FALLBACK. `ConsultationStatus` = AWAITING_PAYMENT · PENDING ·
ACCEPTED · DECLINED · COMPLETED · CANCELLED. `SubscriptionPaymentStatus` = PENDING · PAID.
`MomoNetwork` = MTN · AT · TELECEL. `WalletLedgerType` = CREDIT · DEBIT.
`WithdrawalStatus` = PENDING · PAID · FAILED. `PayoutType` = REFUND · WITHDRAWAL.
`PayoutStatus` = PENDING · PAID · FAILED.

Design notes worth defending:

- `originalDescription` is written once and never updated by AI output (FR-010).
- `categoryId` on `LegalIntake` is **nullable** — an intake with no category is a valid
  state, reached whenever AI fails. A non-null constraint would have made the fallback
  path impossible.
- `aiStatus` is explicit rather than inferred from null fields, so the fallback path is
  queryable and testable.
- `matchReason` is stored on the consultation request, not recomputed, so the lawyer sees
  the reason the client actually saw (NFR-007).
- `confidence` is stored so low-confidence intakes can be found later.
- Payment account columns on `LawyerProfile` are omitted from the public directory
  select. Own-profile and admin detail return a nested `paymentAccount` object (FR-020).
  Wallet ledger and withdrawals are own-profile only (FR-021). Live NaloPay disbursement
  uses `/clientapi/disbursement/`; that path is not confirmed with merchant docs (TD-028).

All six `ConsultationStatus` values are reachable: a booking starts as `AWAITING_PAYMENT`
until the fee is paid, then a lawyer accepts or declines. `COMPLETED` requires both
parties to confirm. A client can cancel an unpaid, pending, or accepted request; cancel
or decline after payment refunds the payer. Transitions are declared as a role-to-status
table in `consultations.service.ts`; confirm is a separate endpoint.

## Matching design

Deterministic application logic, not AI (ADR-001, NFR-007).

Eligibility, all mandatory: `approvalStatus = APPROVED`, user `status = ACTIVE`, a live
subscription (`subscriptionPeriodEnd` in the future), and at
least one practice area equal to the intake category.

Score among eligible candidates:

| Criterion | Weight |
| --- | --- |
| Practice area matches intake category | 100 |
| Region matches intake region | 30 |
| `isAvailable` is true | 20 |
| City matches intake city | 15 |

Availability outscores a city match because a lawyer who is not taking work cannot help
regardless of how close they are, whereas a nearby-region lawyer in the wrong city still
can. It is a ranking factor rather than an eligibility rule: an unavailable lawyer stays
visible, ranked lower, with a reason that says so.

Ties break on `yearsExperience`, then `displayName`, then `id`. The final tiebreak on a
unique column is what makes the ordering a *total* order — without it two otherwise
identical lawyers would come back in whatever order the database chose, and the
determinism claim in MT-005 would be untestable.

Each result carries a generated reason built from the criteria that actually scored, so
the explanation cannot drift from the ranking, e.g. "Recommended because Akua Owusu lists
Employment & Labour as a practice area, is based in Accra and is currently accepting new
enquiries."

When an intake has no category because AI failed, matching is skipped and the client is
directed to browse the directory (FR-012) instead — the fallback still leads somewhere.

## Repository structure

```
legalconnect/
├── AGENTS.md                  agent rules (always-on)
├── .cursor/rules/             scoped agent rules
├── docker-compose.yml         local dev stack: postgres, server, client
├── docs/                      lifecycle documentation
├── diagrams/                  Mermaid sources; exports/ holds the rendered SVG and PNG
├── client/
│   ├── src/
│   │   ├── api/               typed fetch wrappers, shared response types
│   │   ├── auth/              auth context and session handling
│   │   ├── components/        layout and shared UI primitives
│   │   ├── hooks/             useAsync data loading
│   │   └── pages/             one file per screen, admin screens nested
│   └── ...
└── server/
    ├── prisma/
    │   ├── schema.prisma
    │   ├── migrations/
    │   └── seed.ts
    ├── src/
    │   ├── config/            env loading and validation
    │   ├── middleware/        auth, role guards, validation, errors
    │   ├── modules/
    │   │   ├── auth/          routes · service · schemas
    │   │   ├── users/
    │   │   ├── lawyers/
    │   │   ├── legal-categories/
    │   │   ├── legal-intake/
    │   │   ├── matching/
    │   │   ├── consultations/
    │   │   ├── subscriptions/
    │   │   └── admin/
    │   ├── ai/                ai-client · prompts · schemas · legal-triage.service
    │   ├── lib/               prisma client, errors
    │   ├── app.ts
    │   └── server.ts
    └── tests/
```

Each module owns `*.routes.ts`, `*.service.ts`, and `*.schema.ts`. Prompts never appear in
route handlers; the provider is never reachable from the client.

## Design artefacts

Produced in `../diagrams/` (Mermaid `.mmd`): use-case diagram (Citizen, Lawyer, Admin,
Visitor), architecture diagram, ER diagram, sequence diagram for AI-assisted intake
including the fallback branch, and the optional consultation lifecycle activity. See
`diagrams/README.md`. No further diagram types.

## Implementation phases

| Phase | Content | Requirements | Status |
| --- | --- | --- | --- |
| 1 | Setup, Docker Postgres, Prisma schema, migration, seed, config, env validation | CON-002 | Complete |
| 2 | Authentication and authorization | FR-001, FR-002, NFR-001 | Complete |
| 3 | Legal categories and lawyer profiles | FR-004, FR-005 | Complete |
| 4 | Legal issue submission **without AI** | FR-006 | Complete |
| 5 | AI triage, summarisation, validation, fallback | FR-007–FR-010 | Complete |
| 6 | Lawyer matching and discovery | FR-011, FR-012 | Complete |
| 7 | Consultation requests | FR-013, FR-014 | Complete |
| 8 | Admin functionality | FR-015 | Complete |
| 9 | Testing pass | All | Automated suite complete; developer UAT 2026-08-13, extended 2026-08-15 to cover UAT-003/004/005 (independent participants not yet completed) |
| 10 | Deployment and documentation | CON-002, NFR-008 | Deployed and verified live 2026-08-15 — hosted database seeded, all three roles sign in, `/api/health` reports the database connected. Documentation is packaged by `npm run docs:submission` |

The frontend was built alongside phases 6–8 rather than as a separate phase, because
each backend slice was only demonstrably finished once a screen exercised it.

Phase 4 precedes phase 5 deliberately: a working intake and consultation path exists
before AI is attached, so a provider problem degrades the product instead of blocking it.
User profile (FR-003) is folded into phase 2, and lawyer discovery (FR-012) into phase 6.

## Architecture decision records

### ADR-001 — Deterministic lawyer matching rather than AI ranking

**Decision:** Filtering and ranking are application logic; AI only classifies.
**Context:** Recommendations must be explainable (NFR-007) and testable, and must not vary
between identical runs.
**Options:** AI-generated ranking · hybrid AI scoring · deterministic rule-based scoring.
**Chosen:** Deterministic weighted scoring with mandatory eligibility gates.
**Reason:** Testable, explainable in a viva, no nondeterminism in a core path.
**Trade-offs:** Less nuanced than a learned ranker; cannot use soft signals.
**Debt introduced:** TD-004 — no feedback-informed ranking.

### ADR-002 — Persist intake before calling the AI provider

**Decision:** `LegalIntake` is written to PostgreSQL before the triage service runs.
**Context:** FR-010 and NFR-003 require that a user's words survive an AI failure.
**Options:** Call AI then persist the combined result · persist first then enrich ·
persist and process asynchronously via a queue.
**Chosen:** Persist first, then enrich in the same request.
**Reason:** Guarantees no data loss with no extra infrastructure. A queue would satisfy it
too but adds a broker, a worker, and deployment risk against CON-001.
**Trade-offs:** The request blocks on AI latency, so the endpoint is as slow as the
provider; two writes instead of one.
**Debt introduced:** TD-002 — synchronous AI call on the request path.

### ADR-003 — Session tokens as stateless JWTs

**Decision:** Authentication uses a signed JWT in the `Authorization` header.
**Context:** FR-002 needs sessions; the deployment should stay single-service.
**Options:** Server-side sessions in PostgreSQL · JWT · a hosted auth provider.
**Chosen:** JWT with a short expiry.
**Reason:** No session store, no third-party dependency, trivial to deploy.
**Trade-offs:** Tokens cannot be revoked before expiry; logout is client-side discard.
**Debt introduced:** TD-003 — no server-side token revocation.

### ADR-004 — Lawyer accounts created by an admin

**Decision:** No public lawyer self-registration; admins create lawyer accounts and set
approval status.
**Context:** FR-004 and FR-015 need approved lawyer profiles, but real credential
verification is out of scope.
**Options:** Self-registration with admin approval · admin-created accounts · open
self-registration.
**Chosen:** Admin-created accounts.
**Reason:** Removes an entire verification slice worth roughly 3 hours and avoids implying
that the platform has verified anyone's licence.
**Trade-offs:** Does not scale; unrealistic for production onboarding.
**Debt introduced:** TD-005 — no lawyer self-service onboarding or licence verification.
**Superseded by:** ADR-006 (2026-08-13), after the product owner asked for lawyer sign-up
with admin approval.

### ADR-006 — Lawyer self-registration with admin approval

**Decision:** Public registration accepts `accountType=lawyer`, creates a `LAWYER` account
and a `PENDING` profile, and keeps that profile out of the directory and matching until an
admin approves it. Admin-created accounts remain available.
**Context:** ADR-004 blocked self-signup to save schedule. The owner later required lawyers
to apply themselves.
**Options:** Keep admin-only creation · self-register with pending approval · open
publication on signup.
**Chosen:** Self-register + pending until admin approval.
**Reason:** Smallest version of the requested flow. Existing eligibility rules already hide
unapproved profiles (FR-011, FR-012). The applicant still cannot set `approvalStatus`.
**Trade-offs:** Approval means "an admin reviewed this record", not that a Ghana Bar
register or uploaded licence was checked. No document upload.
**Debt remaining:** TD-005 residual — no licence verification against a professional
register, no document upload.

### ADR-005 — Role named USER rather than CLIENT

**Decision:** The `Role` enum value for an ordinary member of the public is `USER`.
**Context:** The role was initially implemented as `CLIENT`, reading better in a legal
domain where the person seeking help becomes a lawyer's client. The approved requirement
specifies `USER`, `LAWYER`, `ADMIN`.
**Options:** Keep `CLIENT` and note the deviation · rename to `USER`.
**Chosen:** Rename to `USER`, applied in migration
`20260812163000_rename_role_client_to_user`.
**Reason:** The stated requirement is authoritative; an unexplained mismatch between the
SRS and the schema is worse than the marginal naming gain.
**Trade-offs:** `USER` is slightly ambiguous, since lawyers and admins are also users. The
foreign keys `LegalIntake.clientId` and `ConsultationRequest.clientId` deliberately keep
the `client` name — they describe the party's role in that specific consultation, not the
account's role, and that distinction is worth preserving.
**Debt introduced:** None.

### ADR-006 — Validation failures return 422, parse failures return 400

**Decision:** Zod schema failures return `422`; only unparseable input returns `400`.
**Context:** The handler originally returned `400` for both. Once body-parser failures were
mapped correctly, `400` carried two unrelated meanings.
**Options:** Collapse everything to `400` · split `400` and `422`.
**Chosen:** Split them, matching the convention already written into the project's API
rules.
**Reason:** A client can act on the distinction — `422` always carries field-level
`details` naming the offending fields, `400` never can, because nothing was parsed.
**Trade-offs:** `422` is less familiar than `400`, so the frontend error handling in Phase 4
must treat both as user-correctable.
**Debt introduced:** None.

### ADR-007 — Version the API from the start with `/api/v1`

**Decision:** Mount every product route under `/api/v1`; leave `/api/health` unversioned.
**Context:** The project's own API rule says to version only when a real need appears, and
with no external consumers there is no such need yet.
**Options:** Unversioned `/api/*` until something breaks · `/api/v1` from the start ·
header-based versioning.
**Chosen:** `/api/v1` from the start, on request.
**Reason:** The cost is a single mount point while no clients exist. Retrofitting a prefix
later means changing every caller at exactly the moment a breaking change is already in
flight. Header-based versioning is invisible in logs and awkward to test by hand.
**Trade-offs:** A version number that never increments is mild dead weight, and it can
imply a compatibility commitment the project has not actually made.
**Debt introduced:** None. No `v2` is planned; if one is ever needed, `v1` routes stay
mounted until consumers migrate.

### ADR-008 — Categories are retired, never deleted

**Decision:** `DELETE /api/v1/categories/:id` sets `isActive = false`. There is no hard
delete.
**Context:** Categories are referenced by past intakes and by lawyers' practice areas.
**Options:** Hard delete · block deletion when referenced · soft retire.
**Chosen:** Soft retire.
**Reason:** A hard delete either fails on the foreign key or, with a cascade, rewrites
history — an intake classified last week would lose the classification a lawyer acted on.
Blocking deletion when referenced gives an admin no way to withdraw a category that is in
use, which is exactly when they would want to.
**Trade-offs:** Rows accumulate, and the list endpoint must filter by `isActive` in every
caller. A retired category still shows on the intakes that already use it, which is
correct but can look like a bug.
**Debt introduced:** None.

### ADR-009 — The lawyer directory is readable without an account

**Decision:** `GET /lawyers`, `GET /lawyers/:id`, and `GET /categories` accept anonymous
callers through an `optionalAuth` middleware. Everything else keeps `requireAuth`.
**Context:** The platform exists to reduce access friction (FR-012, NFR-004). Requiring
registration before a visitor can see a single lawyer asks them to hand over their name,
email, and phone number in exchange for an unknown — the precise hesitation the product
is meant to remove. It also strands practitioners and anyone simply checking whether the
service is real.
**Options:** Keep everything behind login · open the directory to anonymous callers ·
build a separate cut-down public directory endpoint.
**Chosen:** Open the existing endpoints with optional authentication.
**Reason:** The data is already public-facing — an approved profile contains what a firm
would publish on its own website, and no contact details are released until a lawyer
accepts a request. A second public endpoint would duplicate the filter, pagination, and
eligibility logic, and the duplicate is exactly where the two would eventually disagree
about who is visible. One code path with a widening scope keeps the eligibility rule in
one place.
**Trade-offs:** The directory becomes scrapeable, and read volume is no longer bounded by
the number of registered users. Neither is a new exposure of private data, but both are
new load. `optionalAuth` also degrades a bad or revoked token to anonymous instead of
rejecting it, which is right for a public resource and would be wrong anywhere else — so
it must not be reached for as a general-purpose replacement for `requireAuth`.
**Debt introduced:** TD-023 — no rate limiting on the now-anonymous read endpoints.

### ADR-010 — Lawyer visibility requires a live plan

**Decision:** Directory, matching, and new consultation requests require an unexpired
`subscriptionPeriodEnd` in addition to approval and an active account. Each package caps
how many practice areas the lawyer may list. Payment is one month (30 days) or a yearly
equivalent (365 days at 12 × the current monthly fee), reusing the NaloPay adapter; an
admin may grant a period without payment. The collected amount and duration are stored on
`SubscriptionPayment` so a later fee change cannot rewrite a period already paid.
**Context:** The product owner asked lawyers to subscribe to packages defined by number of
legal areas of interest, and later to pay monthly or yearly. Recurring billing, proration,
and dunning would be a separate product (CON-001). There is no separate yearly fee field —
the yearly amount is derived from the admin-set monthly fee.
**Options:** Unlimited areas as today · AI-priced plans · monthly plans with an area cap ·
a distinct yearly price.
**Chosen:** Three seeded plans (Starter 1, Practice 3, Chambers 8) plus admin-editable
packages, including monthly fee. Eligibility lives in one helper (`publicLawyerWhere`) so
the three surfaces cannot drift. A fee change updates the package row; `SubscriptionPayment.feePesewas`
and `periodDays` keep what was actually collected.
**Reason:** Smallest version of the requested monetisation. The cap is a server-side
business rule, not a client checkbox limit. Expired plans drop out without a cron job
because queries use `subscriptionPeriodEnd > now()`.
**Trade-offs:** No automatic renewal; a lawyer who forgets to pay disappears from matching
at period end. Switching plans resets the period to now plus the newly paid duration
rather than carrying unused days.
**Debt introduced:** TD-026 — no recurring collection, proration, or failed-payment retry.
