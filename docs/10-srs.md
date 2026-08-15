# Software Requirements Specification

LegalConnect Ghana — An AI-Powered Platform for Improving Access to Legal Services.
CSCD602 Advanced Software Engineering, 48-hour individual examination project.

Status: written 2026-08-15 against the system as built. Every requirement below is
implemented unless the text says otherwise.

This document is the structured requirements view the examination brief asks for. Where a
table already exists in `01-requirements.md`, this SRS points at it rather than copying it,
so the two cannot drift apart — `01-requirements.md` remains the authoritative register of
functional requirements, acceptance criteria, and traceability.

---

## 1. Introduction

### 1.1 Purpose

This SRS specifies the requirements for LegalConnect Ghana, a web application that reduces
the friction an ordinary person in Ghana faces when trying to reach an appropriate legal
professional. It is written for the examiner assessing the project, and for any engineer
who later maintains or extends the system.

### 1.2 Scope

The system lets a citizen describe a legal concern in everyday language, uses an external
large language model to classify and summarise that concern into structured intake data,
recommends eligible lawyers through deterministic and explainable matching, and coordinates
a consultation request that the lawyer accepts or declines. It also supports paid
consultation booking, lawyer subscription plans, an in-app wallet, and administration of
users, lawyers, and the category taxonomy.

The system is explicitly **not** a legal advice service. AI may categorise, summarise,
orient, and support matching. It must never give definitive legal advice, determine guilt
or liability, predict court outcomes, guarantee a remedy, or produce legal citations
(CON-003). Excluded functionality is listed under "Out of scope" in `01-requirements.md`.

### 1.3 Definitions, acronyms, and abbreviations

| Term | Meaning |
| --- | --- |
| Intake | A submitted legal concern: the citizen's original free text plus any AI-derived category, summary, urgency, keywords, and confidence |
| Triage | Classifying and summarising an intake. In this system triage is AI-assisted; it never decides a legal outcome |
| Matching | Deterministic selection and ranking of eligible lawyers for an intake. Application logic, not AI (NFR-007) |
| Practice area | A legal category a lawyer declares as a specialisation; capped in number by their subscription plan |
| Match reason | The human-readable explanation stored with a recommendation, naming the criteria that produced it |
| `needsHumanReview` | An application-set flag meaning the triage result cannot be trusted unaided. The model may request it but cannot waive it |
| `aiStatus` | Explicit lifecycle of triage on an intake: `PENDING`, `COMPLETED`, or `FAILED_FALLBACK` |
| Fallback path | The behaviour when the AI provider fails or returns invalid output: the original text is preserved and the workflow continues without classification (FR-010) |
| Pesewa | The minor unit of the Ghana Cedi (GH₵ 1 = 100 pesewas). All money is stored as an integer number of pesewas |
| MoMo | Mobile money, the dominant consumer payment method in Ghana (MTN, AT, Telecel) |
| Escrow | Holding a paid consultation fee until both parties confirm the session happened, before crediting the lawyer's wallet (FR-021) |
| JWT | JSON Web Token, the bearer token carrying an authenticated session |
| SPA | Single-page application — the React client, served as static files with client-side routing |
| MoSCoW | Prioritisation scheme: Must, Should, Could, Won't |
| `optionalAuth` | Middleware allowing a route to answer anonymous callers while still tailoring the response when a valid session is present |
| FR / NFR / CON | Functional requirement / non-functional requirement / constraint identifiers |
| ADR | Architecture Decision Record, in `03-architecture.md` |
| TD | Technical debt item, in `05-technical-debt-register.md` |
| UAT / IT / UT / SEC-LG / AI-TC / MT / FT / DEF | Test and defect identifiers, defined in `04-testing.md` |

### 1.4 References

- `docs/01-requirements.md` — requirements register, acceptance criteria, traceability
- `docs/03-architecture.md` — architecture, API surface, data model, ADRs
- `docs/04-testing.md` — test strategy, cases, results, defect log
- `docs/05-technical-debt-register.md` — debt register
- `docs/06-deployment.md` — deployment and configuration
- `docs/12-references.md` — third-party frameworks, libraries, APIs, and services

---

## 2. Overall description

### 2.1 Product perspective

LegalConnect Ghana is a new, self-contained product. It does not replace or integrate with
an existing institutional system, and it holds no authoritative register of practitioners:
lawyers appear because they registered and an administrator approved them, not because they
were imported from a regulator's roll.

It is a three-tier web application — a React single-page client, an Express HTTP API, and a
PostgreSQL database reached through Prisma — with four external dependencies:

| External system | Role | Degraded behaviour if unavailable |
| --- | --- | --- |
| LLM provider via OpenRouter | Intake classification and summary | Intake is preserved and flagged for review; the workflow continues unclassified (FR-010) |
| NaloPay | Mobile money collection, refunds, withdrawals | Outside production the payment is recorded locally; in production a booking cannot be marked paid |
| SMTP provider | Verification, reset, and notification email | Mail is logged rather than sent |
| SMS provider | Optional notifications | Message is logged rather than sent |

Google Meet and Google Calendar are used only through public URL conventions — a Calendar
event-template link and a Meet link the lawyer pastes. There is no Google API integration.

### 2.2 User classes and characteristics

Four classes; the three authenticated roles are enforced server-side as `USER`, `LAWYER`,
and `ADMIN`.

| Class | Characteristics | Expected competence |
| --- | --- | --- |
| Visitor | Unauthenticated. Can browse the directory and an individual approved profile before deciding to register | None assumed |
| Citizen (`USER`) | Has a legal concern, typically no legal vocabulary and no prior idea which speciality applies. The primary user the product exists for | Everyday web and mobile-money literacy only. Must never need legal terminology (NFR-004) |
| Lawyer (`LAWYER`) | A practising professional with a profile an administrator must approve. Maintains practice areas, availability, fee, subscription, and payment account | Comfortable with routine professional web tools |
| Administrator (`ADMIN`) | Maintains the taxonomy, approves lawyers, manages users and plan pricing. Created by the seed script, never through the API | Operator of the platform |

Role definitions and the reasoning for three roles rather than two are in
`01-requirements.md` under "Actors and roles".

### 2.3 Operating environment

| Layer | Requirement |
| --- | --- |
| Client | Current desktop or mobile browser with JavaScript enabled. Tested at desktop widths and at a 1024 px viewport (DEF-009 records a layout defect at that width) |
| Server runtime | Node.js 22 LTS |
| Database | PostgreSQL 16 |
| Local development | Docker Compose — PostgreSQL, API, and client; API on port 4000, client on 5173, database published on host port 5433 |
| Deployed environment | Vercel — the Vite build served as static assets from the CDN, the Express API as a single serverless function under `/api`; PostgreSQL hosted on Supabase |
| Network | HTTPS in the deployed environment. Outbound access required to the LLM gateway, and to the payment, mail, and SMS providers when configured |

The serverless deployment target constrains the design: the API must be stateless between
requests, so sessions are bearer tokens rather than server-side state, and no in-process
scheduler or background worker may be relied upon.

### 2.4 Assumptions and dependencies

1. Lawyers supply accurate professional details; the system does not verify a licence with
   any regulator, and no automated verification is in scope.
2. The examiner has network access to the deployed URL and to the repository.
3. The LLM provider remains reachable on a free tier at demonstration time. The system is
   designed to survive its absence rather than to assume its presence (CON-004).
4. Mobile money is the expected payment method; card payment is not supported.
5. Times are stored in UTC and presented in Africa/Accra.
6. Full estimation assumptions are listed in `02-effort-estimation.md`.

### 2.5 Constraints

CON-001 to CON-005 in `01-requirements.md`: 48 hours and individual work; the application
must be deployed and publicly accessible with source in a repository; the platform must not
practise law or present AI output as legal advice; one external LLM provider on a free or
low tier; third parties must be acknowledged.

---

## 3. Functional requirements

Twenty-one numbered requirements, stated below in full. Each is written as a single "shall"
statement with the acceptance criterion that decides whether it is met — an observable
outcome, usually including the expected HTTP status code, so that a test can either pass or
fail against it rather than a reader forming an opinion. The test cases in `04-testing.md`
are derived from these criteria, and the traceability matrix in section 9 links the two.

`01-requirements.md`, the chapter immediately after this one in the submission PDF, remains
the authoritative register: it carries the same statements with fuller criteria, the
stakeholder analysis, and the scope boundaries. Where the wording differs, that register
governs.

| ID | Requirement | Priority | Acceptance criterion |
| --- | --- | --- | --- |
| FR-001 | The system shall allow a visitor to create a USER account with name, email, and password, rejecting duplicate emails. | Must | Account stored with a bcrypt hash and never plaintext; duplicate email `409`; malformed or weak input `422` with field-level messages. |
| FR-002 | The system shall authenticate registered users by email and password, establish an authorised session, and support logout. | Must | Valid credentials return a token and role; invalid credentials `401` with wording identical for unknown email and wrong password; protected route without a token `401`. |
| FR-003 | The system shall allow an authenticated user to view and update their own profile, including changing their password when they know the current one. | Must | Name and phone update for self only; password change requires the current password, and a wrong one returns `401` leaving the hash unchanged; forgotten password resets through a one-use email link. |
| FR-004 | The system shall maintain lawyer profiles including display name, firm, bio, practice areas, city/region, and availability, editable by the owning lawyer and by an admin. | Must | A lawyer edits only their own profile and cannot set `approvalStatus`; either attempt returns `403`; an admin may edit any profile. |
| FR-005 | The system shall maintain a configurable list of legal practice categories usable for classification, specialisation, and filtering. | Must | Readable without an account; write restricted to admin (`403` otherwise); slug derived from name; duplicate name `409`; delete retires rather than deletes, keeping historical references intact. |
| FR-006 | The system shall allow an authenticated client to submit a free-text description of a legal concern with optional location. | Must | Text within length bounds is persisted with its author **before** any AI call; empty or over-length input returns `422` and makes no AI call. |
| FR-007 | The system shall analyse a submitted concern and return one category from the configured list, an urgency level, and keywords, or flag it for review where confidence is insufficient. | Must | Exactly one configured category, urgency in `NORMAL`/`IMPORTANT`/`URGENT`, keywords stored on the intake; confidence below 0.5 sets `needsHumanReview` while keeping the classification. |
| FR-008 | The system shall generate a concise neutral summary derived only from the submitted concern. | Must | The summary introduces no fact the client did not state, gives no opinion on the merits, and cites no legislation or case; `originalDescription` is never overwritten. |
| FR-009 | The system shall validate every AI response against a schema before storing or using it. | Must | Invalid JSON, missing field, category outside the list, urgency outside the enum, or confidence outside 0–1 all fail validation; a failure is handled under FR-010 rather than partially applied. |
| FR-010 | The system shall preserve the user's original text and provide a recoverable, reviewable workflow whenever the AI service is unavailable or returns invalid output. | Must | On timeout, network error, or invalid response the intake persists with its original text, `aiStatus` is `FAILED_FALLBACK`, `needsHumanReview` is true, the user sees a controlled message rather than an error page, and can still browse and contact lawyers. The review flag is raised and counted but has no admin queue behind it (TD-037). |
| FR-011 | The system shall recommend eligible lawyers ranked by category against practice area, then location, then availability, and display the reason for each. | Must | Only approved, active, unexpired-subscription lawyers with at least one matching practice area are returned; every result carries a reason naming the matched criteria; identical inputs give an identical ranking. |
| FR-012 | The system shall allow users to browse, search, and filter eligible lawyer profiles and view profile detail. | Must | Directory and approved profiles readable without an account; unapproved and suspended lawyers stay hidden; an absent or expired session narrows the view rather than failing the request; every write still needs a session. |
| FR-013 | The system shall allow a client to submit a consultation request to a selected eligible lawyer, linked to their intake. | Must | The intake must belong to the caller and the lawyer must be currently eligible; otherwise `403` or `404`, never a response that confirms the resource exists. |
| FR-014 | The system shall allow a lawyer to view requests addressed to them with the associated structured intake and accept or decline, and allow a client to track their own requests. | Must | A lawyer sees only their own requests, and the intake only once payment has cleared; transitions outside the permitted workflow return `403`; a client sees only their own requests. |
| FR-015 | The system shall allow an administrator to manage users, lawyer profiles including approval status, and legal categories. | Must | Admin-only endpoints reject USER and LAWYER callers with `403`. |
| FR-016 | The system shall allow a visitor to create a LAWYER account with a professional profile that stays hidden until an administrator approves it. | Should | Registration with `accountType=lawyer` creates a `PENDING` profile absent from directory and matching; a self-approving payload is ignored; `role` cannot create an ADMIN. |
| FR-017 | The system shall let each lawyer set a consultation fee and require the client to pay it before the lawyer is notified of, or can act on, the request. | Should | Creating a request snapshots the fee and leaves it `AWAITING_PAYMENT`, invisible to the lawyer until payment confirms; a later fee change does not alter an existing booking. |
| FR-018 | The system shall offer subscription packages, billed monthly or as a yearly equivalent, that cap listed practice areas, and hide lawyers without a live plan. | Should | Plans cap `practiceAreaIds` and exceeding the cap returns `422`; a payment adds days to any remaining time; an admin grant sets the period outright; a lawyer without a future `subscriptionPeriodEnd` is absent from directory, matching, and new bookings even if approved. |
| FR-019 | The system shall let a client propose a date and time, provide an Add to Google Calendar action, and require a Google Meet link when the lawyer accepts. | Should | `scheduledAt` must be in the future; a Calendar template URL is returned for the slot; accept requires a `meet.google.com` link that is not `/new`; a missing slot or link returns `422`. |
| FR-020 | The system shall let a lawyer save a Ghana mobile-money account for their own use, keep it off the public directory, and reuse it for plan payments. | Should | Account name, number, and network save together, and a half-filled account returns `422`; public lawyer responses omit the fields; subscribing without a `phone` uses the saved number. |
| FR-021 | The system shall hold a paid fee until both parties confirm, then credit the lawyer's wallet; refund on cancellation or decline after payment; and allow withdrawal to the saved account. | Should | Both confirmations move the request to `COMPLETED` and insert one wallet CREDIT; one confirmation changes nothing; cancel or decline after payment creates a REFUND to the paying number without crediting the lawyer; over-balance or missing account on withdrawal returns `422`. |

FR-001 to FR-015 are the approved MVP. FR-016 to FR-021 were added during implementation at
the product owner's request and are recorded in the change log in `09-process-playbook.md`.
Their effort was **not** re-estimated when they were accepted, which is a departure from the
project's own change process; the re-estimation was carried out afterwards, on 2026-08-15, and
is reported with that date in `02-effort-estimation.md`.

---

## 4. Non-functional requirements

Eight requirements, each with a priority, an acceptance criterion that can be checked, and the
evidence that was actually produced for it. Two are shown as partially met; those are the
honest positions and are argued below rather than rounded up.

| ID | Area | Priority | Requirement | Acceptance criterion | Evidence |
| --- | --- | --- | --- | --- | --- |
| NFR-001 | Security | Must | Passwords shall be stored only as bcrypt hashes, and every role- or ownership-restricted operation shall be enforced server-side. | No mutating route bypasses authentication; no role decision trusts the client; `passwordHash` holds only digests and is never returned; a USER or LAWYER on an admin route gets `403`. | SEC-LG-003, SEC-LG-005, SEC-LG-009…011; UT-001…010 |
| NFR-002 | Privacy | Must | The system shall collect only what the MVP requires, shall not log full intake text, and shall not expose one user's intake to an unauthorised user. | Logs carry intake length and status, never the body; another user's intake returns `404`, not `403`, so existence is not disclosed; public lawyer payloads omit mobile-money fields. | SEC-LG-001, SEC-LG-002, SEC-LG-008; IT-069…075 |
| NFR-003 | Reliability | Must | Failure of the AI provider shall not lose a submitted concern or return 5xx on the intake workflow. | With the provider unreachable, timing out, or returning invalid JSON, the intake `POST` still returns 2xx and the row persists with its original text and `FAILED_FALLBACK`. The wait for the provider must also end inside the hosting platform's invocation limit, or the host ends the request before the fallback can answer (DEF-014). | AI-TC-005, AI-TC-015, AI-TC-016, UT-020 |
| NFR-004 | Usability | Must | A first-time user shall reach lawyer recommendations without using or understanding legal terminology. | A participant new to the system completes intake to recommendation without asking what a term means or naming a practice area. | **Partially met** — UAT-001, UAT-003…006, developer walkthrough only (TD-034) |
| NFR-005 | Maintainability | Should | All provider-specific AI logic shall sit behind a single adapter. | No provider SDK is installed; provider references exist only in `ai/ai-client.ts` and the default base URL in `config/env.ts`, and none in the client bundle. | Code review; AI-TC-002 |
| NFR-006 | Performance | Should | Non-AI API operations shall respond within 2 s under demonstration load; AI latency shall be measured, not asserted. | Read-path p95 under 2 s at demonstration scale. | **Partially met** — PERF-001…004: live p50 ≈ 0.49 s, local p95 < 30 ms, one cold start at 2.25 s (DEF-013) |
| NFR-007 | Explainability | Must | Every recommendation shall carry a human-readable reason traceable to configured criteria, not to an AI claim. | Each result has a non-empty reason naming the criteria; repeat calls rank identically; no reason credits the AI. | MT-001…008, AI-TC-010 |
| NFR-008 | Availability | Must | The deployed application shall be reachable for grading. | The public URL serves the app, the health endpoint responds, and all three roles sign in against the live database. | Live verification 2026-08-15, `06-deployment.md` |

NFR-004 and NFR-006 are recorded as partially met rather than met. NFR-004 was walked by the
developer, who cannot be a first-time user of a system he built, so the criterion is not
satisfied by the evidence held; independent participants are the missing piece (TD-034).
NFR-006 holds in steady state but was exceeded once on a cold serverless start, and no
sustained-load test was run, so the target is demonstrated at demonstration scale only.

NFR-005 and NFR-006 carry Should rather than Must because neither can fail the product on its
own; everything a citizen's safety or privacy depends on is Must.

---

## 5. External interface requirements

### 5.1 User interfaces

- The client is a React single-page application using Ant Design components, served over
  client-side routes; a deep link to any route returns the application shell rather than a
  404.
- Every screen that displays AI-derived content must also display the disclaimer that the
  output is not legal advice (CON-003).
- Validation failures must be reported against the field at fault rather than as a generic
  failure, using the `details` carried by a `422` response.
- The interface must be usable without legal vocabulary (NFR-004): categories are presented
  in plain language and the citizen never has to choose a speciality unaided.
- Money is entered and displayed in Ghana Cedis while stored in pesewas.

### 5.2 Application programming interfaces

All product endpoints sit under `/api/v1`; the operational probe `/api/health` sits
deliberately outside the version because it is consumed by the platform, not the product.
The full prefix-to-module table is in `03-architecture.md`.

Interface-level requirements:

- Every response error uses one shape, `{ "error": { "code", "message", "details?" } }`,
  produced by a single error handler so no route invents its own format.
- Status codes carry defined meanings: `400` unparseable, `401` no valid credentials, `403`
  authenticated but not permitted, `404` no such route or resource, `409` conflicts with
  existing state, `413` body over the 100 kB limit, `422` parsed but schema-invalid, `500`
  unexpected fault. Only `422` carries field-level `details`.
- Authenticated requests present a bearer JWT. Four read endpoints — directory, individual
  profile, categories, plans — answer anonymous callers through `optionalAuth`, narrowing
  the response rather than failing when a session is absent, expired, or revoked.
- In production a `500` returns a fixed message and the underlying error is logged
  server-side only, so internal detail cannot leak through the error path.

### 5.3 External system interfaces

| Interface | Protocol and shape | Requirements |
| --- | --- | --- |
| LLM provider | HTTPS JSON, OpenAI-compatible `/chat/completions` through OpenRouter | Reached only from `server/src/ai/`; the API key is server-side and must never enter the client bundle. Every response is schema-validated before use (FR-009). A timeout, network error, or invalid response takes the fallback path (FR-010) |
| NaloPay | HTTPS JSON collection and disbursement, plus a signed callback | Requests carry an HMAC transaction hash. The callback endpoint takes no JWT and verifies the raw body signature. Confirmation is by polling collection status rather than trusting the webhook alone |
| SMTP | Nodemailer over TLS | Optional. With no host configured the server logs the message instead of sending, so no workflow depends on mail being available |
| SMS | HTTP API | Optional, with the same log-instead-of-send behaviour |
| Google Calendar / Meet | Public URL conventions only | The API returns a Calendar event-template URL for the booked slot; the lawyer supplies a `meet.google.com` link when accepting. No SDK, key, or OAuth |

---

## 6. Data requirements

The entity list, field list, and enumerations are in `03-architecture.md` under "Data
model". Requirements on that data:

1. **Original text is immutable.** `LegalIntake.originalDescription` is written once and is
   never overwritten by AI output, so a failed or wrong classification can never destroy
   what the citizen actually wrote (FR-010).
2. **Absent classification is a valid state.** `categoryId` on an intake is nullable and
   `aiStatus` is explicit, so the fallback path is representable, queryable, and testable
   rather than inferred from missing fields.
3. **Money is integer pesewas.** All amounts — consultation fees, plan fees, wallet entries,
   payouts — are stored as integers in the minor unit; no monetary value is held as a float.
4. **Explanations are stored, not recomputed.** `matchReason` is persisted on the
   consultation request so the lawyer reads the same reason the client saw (NFR-007).
5. **Payment details are private.** Lawyer payment account fields are excluded from the
   public directory projection and returned only on own-profile and admin detail. Wallet
   ledger and withdrawals are own-profile only (FR-020, FR-021).
6. **Uniqueness.** Email on `User`, name and slug on `LegalCategory` and
   `SubscriptionPackage`, and one profile per lawyer user are unique. A wallet credit is
   unique per consultation, so a consultation cannot be credited twice.
7. **Referential integrity** is enforced by foreign keys, with the practice-area join
   carrying a composite primary key so a lawyer cannot list the same category twice.
8. **Timestamps** are stored in UTC and rendered in Africa/Accra.
9. **Retention and minimisation.** Only data the MVP needs is collected. Full intake text is
   never written to application logs (NFR-002). There is no automated retention or deletion
   policy — recorded as a limitation rather than claimed.
10. **Seed data is fictional.** Demo lawyers and their details do not represent real
    practitioners, and demo seeding is off by default.

---

## 7. Security requirements

Traced to NFR-001 and NFR-002 and verified by the `SEC-LG-*` cases in `04-testing.md`.

| ID | Requirement |
| --- | --- |
| SR-01 | Passwords shall be stored only as bcrypt hashes; no endpoint shall return a hash, and no plaintext password shall be logged |
| SR-02 | Sessions shall be bearer JWTs signed with a secret of at least 32 characters, expiring after a bounded lifetime (2 hours by default) |
| SR-03 | Every role- or ownership-restricted operation shall be enforced server-side. Client-side checks are presentation only and shall never be the sole protection |
| SR-04 | Ownership queries shall be scoped by the caller's identity for non-admin callers, so no user can read another user's intake, consultation, wallet, or payment account |
| SR-05 | A lawyer shall not be able to set their own approval status, and no registration payload shall be able to create an `ADMIN` |
| SR-06 | Authentication failures shall be indistinguishable between an unknown email and a wrong password |
| SR-07 | Email verification and password reset links shall be single-use and time-limited |
| SR-08 | All input shall be validated against a schema at the boundary; request bodies shall be capped (100 kB) |
| SR-09 | Standard security headers shall be applied (Helmet), and cross-origin access shall be restricted to an allowlist containing the configured client origin and the deployment host |
| SR-10 | Secrets shall live only in environment configuration, never in tracked files. The AI provider key shall never reach the client bundle |
| SR-11 | The payment callback shall verify a signature over the raw request body and shall not rely on a session; payment confirmation shall additionally be verified by polling the provider |
| SR-12 | Production error responses shall not disclose internal detail; the underlying fault is logged server-side only |
| SR-13 | Suspended accounts shall be refused access to authenticated operations |
| SR-14 | AI output shall not be trusted to control authorisation or review status: the model may request human review but shall never be able to waive it |

Known security limitations, recorded rather than omitted: there is no token revocation list,
so a stolen token stays valid until it expires (TD-003); the intake text leaves the trust
boundary when sent to the LLM provider (TD-007); the session token is held in `localStorage`,
so an XSS would be a session takeover (TD-035); and the authentication endpoints are not rate
limited, so online password guessing is bounded only by bcrypt's cost (TD-036). TD-007 carries
the highest priority of the four because it affects every user who submits an enquiry, but
TD-036 is the one to do first: it is two points of work against an exposure that needs no
insider and no XSS to exploit.

---

## 8. Requirement priorities

MoSCoW, as recorded per requirement in `01-requirements.md`.

| Priority | Count | Requirements |
| --- | --- | --- |
| Must | 15 | FR-001 … FR-015 — the approved 48-hour MVP |
| Should | 6 | FR-016 … FR-021 — added during the build; re-estimated afterwards, not before acceptance |
| Could | 0 | None built. Candidates are listed under future evolution |
| Won't | — | Listed under "Out of scope" in `01-requirements.md` |

The working rule was that no Should item may be started while a Must item is broken, and no
scope may expand without re-estimation and a change-log entry.

---

## 9. Traceability

Every requirement traces forward to a design element, an implementation path, and named test
cases. The matrix below is the summary; `01-requirements.md` carries the same rows with the
full test-case lists, and `04-testing.md` carries what each case does.

| Requirement | Design element | Implementation | Test evidence | Status |
| --- | --- | --- | --- | --- |
| FR-001, FR-002 | Auth module, JWT sessions | `modules/auth/*`, `lib/jwt.ts` | UT-001…010, SEC-LG-005, SEC-LG-009 | Tested |
| FR-003 | Users module, account page | `modules/users/*`, `AccountPage` | IT-001…007, UT-016…018, SEC-LG-010 | Tested |
| FR-004 | Lawyers module | `modules/lawyers/*` | IT-020…029, SEC-LG-015…020 | Tested |
| FR-005 | Legal categories module | `modules/legal-categories/*` | IT-016…019, SEC-LG-003, SEC-LG-014 | Tested |
| FR-006 | Legal intake module | `modules/legal-intake/*` | IT-011…015, AI-TC-004, AI-TC-014 | Tested |
| FR-007, FR-008 | AI triage service and prompts | `ai/legal-triage.service.ts`, `ai/prompts.ts` | AI-TC-001, 003, 007, 008, 011 | Tested |
| FR-009 | AI response schemas | `ai/schemas.ts` | AI-TC-006, 012, SEC-LG-013 | Tested |
| FR-010 | Fallback path in triage and intake | `ai/legal-triage.service.ts`, `modules/legal-intake/*` | AI-TC-005, 015, 016 | Tested — review queue outstanding (TD-037) |
| FR-011 | Deterministic matching service | `modules/matching/*` | MT-001…008, SEC-LG-021, SEC-LG-022 | Tested |
| FR-012 | Directory with optional auth | `modules/lawyers/*`, `middleware/auth.ts` | IT-046…054, SEC-LG-007, SEC-LG-033…036 | Tested |
| FR-013, FR-014 | Consultations module and state machine | `modules/consultations/*` | IT-030…039, SEC-LG-023…030 | Tested |
| FR-015 | Admin module | `modules/admin/*` | IT-040…045, SEC-LG-031, SEC-LG-032 | Tested |
| FR-016 | Registration with pending approval | `modules/auth/*`, admin `PATCH /lawyers/:id` | `lawyers.test.ts` self-registration cases | Tested |
| FR-017 | Fee snapshot, NaloPay adapter, callback | `modules/consultations/*`, `payments/nalopay.ts` | `consultations.test.ts`, `nalopay.test.ts` | Tested |
| FR-018 | Subscriptions module, plan caps | `modules/subscriptions/*` | `subscriptions.test.ts`, IT-055, IT-063…066, IT-088, IT-089, MT-010 | Tested |
| FR-019 | Calendar template URL, Meet on accept | `modules/consultations/*` | IT-033, IT-067, IT-068, `google-calendar.test.ts` | Tested |
| FR-020 | Lawyer payment account fields | `modules/lawyers/*` | IT-069…075 | Tested |
| FR-021 | Escrow, wallet ledger, withdrawals | `modules/consultations/*`, wallet ledger | IT-076…083 | Tested |
| NFR-001, NFR-002 | Auth middleware, ownership scoping, minimal logging | `middleware/auth.ts`, module services | SEC-LG-001…011 | Tested |
| NFR-003 | AI fallback | `ai/legal-triage.service.ts`, `ai/ai-client.ts` | AI-TC-005, 015, 016, UT-020 | Tested — live retest pending the DEF-014 build |
| NFR-004 | Plain-language intake and results UI | `IntakePage.tsx`, `RecommendationsPage.tsx`, `IntakeDetailPage.tsx` | UAT-001, UAT-003…006 | Partially met (TD-034) |
| NFR-005 | Single AI adapter | `ai/ai-client.ts` | Code review, AI-TC-002 | Tested |
| NFR-006 | Read-path query design | `modules/lawyers/*`, `modules/matching/*` | PERF-001…004 | Partially met (DEF-013) |
| NFR-007 | Reason strings on every match | `modules/matching/matching.service.ts` | MT-001…008, AI-TC-010 | Tested |
| NFR-008 | Vercel deployment, hosted Postgres | `vercel.json`, `api/index.js` | Live verification 2026-08-15 | Tested |

Tracing backwards, no endpoint, table, or screen exists that does not answer a requirement in
this list. The wallet ledger and the payments adapter are the two additions a reader might
expect to be unaccounted for, and both belong to FR-021 and FR-017.

The register defines Done more strictly than Tested: a requirement is Done only when it is
implemented, its acceptance criteria are satisfied, test evidence exists, debt is recorded,
and it works in the deployed environment.
