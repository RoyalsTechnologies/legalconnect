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
- `docs/11-references.md` — third-party frameworks, libraries, APIs, and services

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

Twenty-one numbered requirements. The full statement of each, with its acceptance criteria,
is in `01-requirements.md`, which is the chapter immediately after this one in the submission
PDF — the criteria are written as observable outcomes including
expected HTTP status codes, and are the basis of the test cases in `04-testing.md`.

| ID | Title | Priority |
| --- | --- | --- |
| FR-001 | User registration | Must |
| FR-002 | Authentication | Must |
| FR-003 | User profile | Must |
| FR-004 | Lawyer profile management | Must |
| FR-005 | Legal category management | Must |
| FR-006 | Legal issue submission | Must |
| FR-007 | AI classification | Must |
| FR-008 | AI structured summary | Must |
| FR-009 | AI output validation | Must |
| FR-010 | AI failure fallback | Must |
| FR-011 | Lawyer recommendation | Must |
| FR-012 | Lawyer discovery | Must |
| FR-013 | Consultation request | Must |
| FR-014 | Consultation management | Must |
| FR-015 | Administration | Must |
| FR-016 | Lawyer self-registration | Should |
| FR-017 | Paid consultation booking | Should |
| FR-018 | Lawyer subscription plans | Should |
| FR-019 | Calendar and video booking | Should |
| FR-020 | Lawyer payment account | Should |
| FR-021 | Consultation fee escrow and withdrawals | Should |

FR-001 to FR-015 are the approved MVP. FR-016 to FR-021 were added during implementation at
the product owner's request, each re-estimated and recorded in the change log in
`09-process-playbook.md`.

---

## 4. Non-functional requirements

NFR-001 to NFR-008 in `01-requirements.md`, each with its verification method: security
(bcrypt hashing, server-side authorisation), privacy (data minimisation, no full intake text
in logs), reliability (AI failure never loses an intake and never returns 5xx on the intake
workflow), usability (a first-time user reaches recommendations without legal terminology),
maintainability (all provider-specific AI logic behind one adapter), performance (non-AI
operations within 2 seconds under demonstration load), explainability (every recommendation
carries a traceable reason), and availability of the deployed application.

Two are not fully evidenced and are recorded as such rather than asserted: NFR-004 has been
verified by developer walkthrough but **not** by independent participants, and NFR-006 is
measured on the read paths only (PERF-001 to PERF-004) — within target in steady state, with a
cold first request on the deployment above it (DEF-013), and no sustained-load test.

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

Known security limitations, recorded honestly rather than omitted: there is no token
revocation list, so a stolen token stays valid until it expires (TD-003), and the intake
text leaves the trust boundary when sent to the LLM provider (TD-007).

---

## 8. Requirement priorities

MoSCoW, as recorded per requirement in `01-requirements.md`.

| Priority | Count | Requirements |
| --- | --- | --- |
| Must | 15 | FR-001 … FR-015 — the approved 48-hour MVP |
| Should | 6 | FR-016 … FR-021 — added during the build, each re-estimated before acceptance |
| Could | 0 | None built. Candidates are listed under future evolution |
| Won't | — | Listed under "Out of scope" in `01-requirements.md` |

The working rule was that no Should item may be started while a Must item is broken, and no
scope may expand without re-estimation and a change-log entry.

---

## 9. Traceability

The full matrix — requirement to design element to implementation to test cases to status —
is in `01-requirements.md` under "Traceability", the chapter immediately after this one in the
submission PDF. Every one of the 21 functional
requirements has a design element, an implementation path, and named test cases, and is
marked Tested.

The register defines Done more strictly than Tested: a requirement is Done only when it is
implemented, its acceptance criteria are satisfied, test evidence exists, debt is recorded,
and it works in the deployed environment.
