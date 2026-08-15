# Requirements

Status: **confirmed for MVP** (2026-08-12). This register carries **fifteen Must
requirements**, FR-001 to FR-015.

An earlier version of this line described the input as an "approved 13-item MVP scope", which
matched neither the fifteen below nor its own source: the provisional list it referred to is
the Must column in `docs/archive/original-cursorrules.txt` §64, and that column has fourteen
bullets. The "13" was never grounded in anything countable, so it is retired here rather than
carried forward. Three differences between that column and this register are verifiable and
worth stating rather than glossing:

- It mixes product features with engineering practices — validation and error handling, tests
  for critical flows, and production deployment. Those became NFR-001 and process obligations
  here rather than functional requirements, which is why fourteen bullets do not map to
  fourteen FRs.
- AI fallback behaviour appears there under Should. Confirmation promoted it to Must as
  FR-010, because an intake that is lost when the provider fails is not an acceptable
  degradation.
- Payments and escrow appear there under Won't for the exam version. They were later added at
  the product owner's request as FR-017 and FR-021. The escrow half went through the change
  log as CH-021; the consultation fee itself was never written up as a change entry, which
  `09-process-playbook.md` now records as a gap. Neither was re-estimated before acceptance —
  see `02-effort-estimation.md`.

The count is stated directly above rather than derived after the fact.

Supersedes the earlier provisional baseline — IDs were renumbered during confirmation, so do
not cite pre-confirmation IDs.

## Problem statement

The project does not assume Ghana lacks lawyers or law firms. The software problem is the
fragmented and often difficult process an ordinary person faces when trying to identify
the appropriate type of legal professional, understand where to start, describe their
issue clearly, and connect with a suitable provider.

The system reduces **access friction** between individuals seeking legal assistance and
lawyers or law firms offering relevant services. It is an access, triage, matching, and
coordination platform. It is not a replacement for a lawyer and must not present itself as
providing professional legal advice.

## Aim

To build and deploy a functional web application that lets ordinary Ghanaians describe a
legal problem in everyday language, uses AI to classify and summarise that problem, and
connects them with suitable legal professionals by practice area, location, and
availability.

## Objectives

1. Capture a legal concern in free text without requiring legal vocabulary.
2. Classify and summarise that concern into structured intake data using a validated AI
   service.
3. Recommend eligible legal professionals through explainable, deterministic matching.
4. Support a consultation request workflow between client and lawyer.
5. Demonstrate the full engineering lifecycle within 48 hours.

## Stakeholders

Interest is what the stakeholder wants; influence is how much their position can change the
product. The last column is the point of the table — a stakeholder who shaped nothing did not
need listing.

| Stakeholder | Interest | Influence | What their position changed |
| --- | --- | --- | --- |
| Citizen / client | Wants to reach the right legal professional without knowing legal terminology | High — the access problem is theirs, and abandoning the form is the failure mode that matters | Free-text intake with no required legal vocabulary (FR-006); the directory readable without an account (FR-012, ADR-009); an AI failure never blocks the enquiry (FR-010, NFR-003) |
| Lawyer / law firm | Wants relevant, well-structured enquiries rather than vague ones, and to be paid | High — with no lawyers accepting requests the citizen side has nowhere to go | The structured intake shown alongside the citizen's own words (FR-014); a visible reason on every match (FR-011); fees held until both parties confirm rather than paid on booking (FR-019) |
| Platform administrator | Maintains category taxonomy, approves lawyers, manages users | Medium — controls who appears in the directory | Approval before a profile is public (FR-004, FR-015); soft retirement of categories so history survives (ADR-008); admin-only mutations enforced server-side (NFR-001) |
| Ghana Bar Association / regulators | Indirect: the platform must not practise law or give legal advice | High as a constraint, none as a requester — they were not consulted, and the boundary is drawn conservatively because of that | CON-003: no advice, no liability finding, no outcome prediction, no citations. Enforced in the prompt (AI-TC-007), in copy on every AI-bearing screen (UAT-006), and in the naming of a suggestion as a suggestion |
| Examiner | Assesses engineering discipline across the lifecycle | High over process, none over the product | Traceability from requirement to test; debt recorded as it was taken on rather than reconstructed; evidence-or-"not yet completed" as a documentation rule |

Not consulted, and this is a limitation rather than an omission: no practising Ghanaian lawyer,
no regulator, and no citizen outside the project reviewed the requirements. Every statement of
what a user wants here is inference from the brief, not research, which is why NFR-004 is
recorded as partially met and why TD-034 keeps independent acceptance testing open.

## Actors and roles

Three roles. **Decision (2026-08-12):** the brief proposed User and Admin initially with a
Lawyer role "if required". It is required — MVP items 9–12 depend on lawyers holding
profiles with specialisations and reviewing consultation requests addressed to them. Two
roles cannot express that.

**USER** — registers and logs in, maintains a profile, submits a legal concern, receives
AI-assisted categorisation and a summary, views recommended and browsable lawyers, submits
consultation requests, tracks their status.

**LAWYER** — applies with a professional profile that an admin must approve before it is
public; maintains practice areas, location, and availability; views consultation requests
sent to them with the structured intake; accepts or declines.

**ADMIN** — manages users, lawyer profiles and their approval, and legal categories.

## Functional requirements

| ID | Title | Requirement | Priority |
| --- | --- | --- | --- |
| FR-001 | User registration | The system shall allow a visitor to create a USER account with name, email, and password, rejecting duplicate emails. | Must |
| FR-002 | Authentication | The system shall authenticate registered users by email and password, establish an authorised session, and support logout. | Must |
| FR-003 | User profile | The system shall allow an authenticated user to view and update their own profile, including changing their password when they know the current one. Forgotten passwords are reset by email. | Must |
| FR-004 | Lawyer profile management | The system shall maintain lawyer profiles including display name, firm, bio, practice areas, city/region, and availability, editable by the owning lawyer and by an admin. | Must |
| FR-005 | Legal category management | The system shall maintain a configurable list of legal practice categories usable for classification, lawyer specialisation, and filtering. | Must |
| FR-006 | Legal issue submission | The system shall allow an authenticated client to submit a free-text description of a legal concern with optional location. | Must |
| FR-007 | AI classification | The system shall analyse a submitted concern and return one category from the configured list, an urgency level, and relevant keywords, or flag the issue for review where confidence is insufficient. | Must |
| FR-008 | AI structured summary | The system shall generate a concise neutral summary derived only from the submitted concern. | Must |
| FR-009 | AI output validation | The system shall validate every AI response against a schema — checking JSON validity, required fields, category membership, urgency enum, and confidence range — before storing or using it. | Must |
| FR-010 | AI failure fallback | The system shall preserve the user's original submitted text and provide a recoverable, reviewable workflow whenever the AI service is unavailable or returns invalid output. | Must |
| FR-011 | Lawyer recommendation | The system shall recommend eligible lawyers ranked by legal category against practice area, then location, then availability, and shall display the reason for each recommendation. | Must |
| FR-012 | Lawyer discovery | The system shall allow users to browse, search, and filter eligible lawyer profiles and view profile detail. | Must |
| FR-013 | Consultation request | The system shall allow a client to submit a consultation request to a selected eligible lawyer, linked to their intake. | Must |
| FR-014 | Consultation management | The system shall allow a lawyer to view consultation requests addressed to them with the associated structured intake, and to accept or decline; and shall allow a client to view the status of their own requests. | Must |
| FR-015 | Administration | The system shall allow an administrator to manage users, lawyer profiles including approval status, and legal categories. | Must |
| FR-016 | Lawyer self-registration | The system shall allow a visitor to create a LAWYER account with a professional profile that stays hidden until an administrator approves it. The applicant cannot set their own approval status. | Should |
| FR-017 | Paid consultation booking | The system shall let each lawyer set a consultation fee and shall require the client to pay that fee before the lawyer is notified of, or can act on, the request. | Should |
| FR-018 | Lawyer subscription plans | The system shall offer subscription packages billed monthly or as a yearly equivalent (twelve times the monthly fee), with monthly fees configurable by an administrator, that cap how many legal practice areas a lawyer may list, and shall hide lawyers without a live plan from the directory, matching, and new consultation requests. | Should |
| FR-019 | Calendar and video booking | The system shall let a client propose a consultation date and time when booking, provide an Add to Google Calendar action for that slot, and require the lawyer to attach a Google Meet link when accepting so the client can join the video call. | Should |
| FR-020 | Lawyer payment account | The system shall let a lawyer save a Ghana mobile-money payment account (registered name, number, and network) for their own use, shall not expose those details on the public directory, and shall use the saved account when the lawyer pays a subscription plan without entering a number. | Should |
| FR-021 | Consultation fee escrow and withdrawals | The system shall hold a paid consultation fee until both client and lawyer confirm the consultation happened, then credit the lawyer’s in-app wallet; shall refund the paying number if the booking is cancelled or declined after payment; and shall let the lawyer withdraw available credit to their saved mobile money account. | Should |

All fifteen Must items are the approved MVP. FR-016 through FR-021 were added during
implementation at the product owner's request.

## Non-functional requirements

| ID | Area | Priority | Requirement | Verification |
| --- | --- | --- | --- | --- |
| NFR-001 | Security | Must | Passwords shall be stored only as bcrypt hashes and every role- or ownership-restricted operation shall be enforced server-side. | SEC-LG-003, SEC-LG-005 |
| NFR-002 | Privacy | Must | The system shall collect only data the MVP requires, shall not log full intake text, and shall not expose one user's intake to any unauthorised user. | SEC-LG-001, SEC-LG-002, SEC-LG-008 |
| NFR-003 | Reliability | Must | Failure of the AI provider shall not cause loss of a submitted legal concern, and shall not return a 5xx on the intake workflow. | AI-TC-005, and UT-020 for the condition the fallback needs in order to run at all: on the deployment a provider wait longer than the platform's function ceiling let the host kill the request before the fallback could answer (DEF-014) |
| NFR-004 | Usability | Must | A first-time user shall be able to describe a concern and reach lawyer recommendations without using or understanding legal terminology. | UAT-001, UAT-006 (developer walkthrough 2026-08-13, extended 2026-08-15 through UAT-003/004/005; independent participants not yet completed) |
| NFR-005 | Maintainability | Should | All provider-specific AI logic shall sit behind a single service adapter, with no provider SDK imported outside `server/src/ai/`. | Code review |
| NFR-006 | Performance | Should | Non-AI API operations shall respond within 2 seconds under demonstration load. AI-dependent latency shall be measured and documented separately, not asserted. | PERF-001 to PERF-004 (2026-08-15). Met in steady state — live p50 ~0.49 s, local p95 under 30 ms. The first request after idle reached 2.25 s on the deployment, which is DEF-013. AI latency remains uncharacterised by design |
| NFR-007 | Explainability | Must | Every lawyer recommendation shall carry a human-readable reason traceable to configured matching criteria, not to an AI claim. | AI-TC-010 |
| NFR-008 | Availability | Must | The deployed application shall be reachable for grading, subject to host limitations. | Live verification |

NFR-005 and NFR-006 are Should rather than Must because neither can fail the examination on its
own: a provider adapter that leaked into two files would be poor structure but working software,
and a demonstration-load latency target has no contractual user behind it. Everything a citizen's
safety or privacy depends on is Must.

### Non-functional acceptance criteria

**NFR-001** — No route mutates data without passing an authentication middleware, and no
role-restricted route relies on the client to assert its role. The `passwordHash` column
contains only bcrypt digests, never plaintext, and no endpoint returns it. A USER or LAWYER
calling an admin route receives `403`, and a lawyer editing another lawyer's profile receives
`403`, both verified against a running server rather than by inspection.

**NFR-002** — Application logs contain intake length and status but never the intake body:
`logFailure` receives `description.length`, not `description`. A citizen requesting another
citizen's intake receives `404` rather than `403`, so the response does not confirm that the
record exists. Public lawyer responses omit the mobile-money fields (FR-020).

**NFR-003** — With the provider unreachable, timing out, or returning invalid JSON, `POST`
of an intake still returns `2xx`, the row persists with `originalDescription` intact, and
`aiStatus` is `FAILED_FALLBACK`. No 5xx is observable on the intake path in any of those
three cases.

**NFR-004** — A participant who has not seen the system before completes describe → triage →
recommendation → request without asking what a term means and without needing to name a
practice area. **Partially met:** satisfied in a developer walkthrough, not with independent
participants; see the UAT record in `04-testing.md` and TD-034.

**NFR-005** — No provider SDK is installed at all: `ai-client.ts` calls the OpenAI-compatible
`/chat/completions` endpoint with `fetch`, so the provider can be changed by configuration.
Searching `client/` and `server/src` for provider names returns exactly two places — the
request in `server/src/ai/ai-client.ts` and the default base URL in `server/src/config/env.ts`
— and nothing in the client bundle. Swapping providers means changing `AI_PROVIDER_BASE_URL`,
the key, and the model name.

**NFR-006** — Measured p95 for read paths under demonstration load is under 2 s. **Partially
met:** met in steady state, exceeded once on a cold serverless start (2.25 s, DEF-013), and
not tested under sustained concurrent load.

**NFR-007** — Every recommendation carries a non-empty reason naming the criteria that
produced it, the same inputs produce the same ranking on repeat calls, and no reason
attributes the recommendation to the AI.

**NFR-008** — The deployed URL serves the application, the API health endpoint responds, and
sign-in works for each of the three roles against the live database.

## Constraints

| ID | Constraint |
| --- | --- |
| CON-001 | 48-hour examination duration, individual work. |
| CON-002 | The application must be deployed and publicly accessible, with source in a repository. |
| CON-003 | The platform must not practise law or present AI output as legal advice. |
| CON-004 | One external LLM provider only; cost and rate limits are those of a free or low tier. |
| CON-005 | Third-party libraries, APIs, and datasets must be acknowledged. |

## Assumptions

These are stated because the requirements below depend on them. Each is a judgement made
without evidence the project had time to gather; if one is wrong, the requirement it supports
is affected in the way described.

| ID | Assumption | If it is wrong |
| --- | --- | --- |
| ASM-001 | A citizen with a legal problem can describe it in two or three sentences of everyday English. | FR-006 and FR-007 degrade: triage receives too little to classify, and more intakes land in review. Voice and local-language intake are the mitigation, both out of scope. |
| ASM-002 | Users reach the platform on a phone with an intermittent connection rather than on a desktop. | Drove the mobile-first layout and small payloads. If desktop dominates, the layout is merely conservative, not wrong. |
| ASM-003 | Lawyers will accept mobile money for fees and payouts, which is the dominant consumer payment rail in Ghana. | FR-017 and FR-021 would need card or bank rails, changing the payment adapter but not the workflow. |
| ASM-004 | An administrator vets lawyers manually, by a process outside the system. | FR-016 approval is a human decision with no licence verification behind it; a fraudulent applicant is caught only by that manual check (TD-012). |
| ASM-005 | Category taxonomy stays small enough for one classification call to choose from the whole list in a prompt. | FR-007 would need retrieval or hierarchical classification once the list outgrows a prompt. |
| ASM-006 | One LLM provider on a free tier is fast and reliable enough for demonstration, but not for production traffic. | Already partly true — hence FR-010 fallback and the decision not to assert AI latency in NFR-006. |
| ASM-007 | Examiner and demonstration traffic is a handful of concurrent users, not a public launch. | NFR-006 was measured at that scale only; sustained-load behaviour is unknown and stated as such. |

## In scope

The delivered system is exactly the twenty-one functional requirements above and nothing
else: registration and authentication for three roles, profile management, an
administrator-maintained category taxonomy, free-text intake, AI classification with a
validated schema and a fallback that never loses the intake, deterministic explainable
matching, a public lawyer directory, a paid consultation workflow with escrow and
withdrawals, lawyer subscription plans, and an administration surface for users, lawyers,
categories, and plans. Anything not traceable to an FR in the matrix below was not built,
whether or not it is mentioned as a possibility elsewhere in these documents.

## Out of scope

Explicitly excluded from this version and recorded as future evolution: AI-generated legal
advice, in-app video, a full chat system, advanced document analysis,
multilingual support, voice intake, ML-based recommendation, microservices, Redis, queues,
Kubernetes, and advanced analytics. Card/mobile-money collection for consultation fees
(FR-017) was added during the build. Escrow, dual confirmation, wallet credit, refunds
on cancel/decline, and withdrawals (FR-021) were added; invoices, platform commission,
disputes, and auto-release timers remain out of scope. Lawyer plans (FR-018) collect one
month or a yearly equivalent (12 × the current monthly fee) at a time; automatic recurring
billing, proration, and dunning are deferred (TD-026). Google Calendar and Google Meet for
bookings (FR-019) use a Calendar template URL and a Meet link the lawyer pastes; two-way
calendar sync and auto-created Meet rooms are deferred (TD-027). A lawyer saves a MoMo
payment account (FR-020) for plan payments and withdrawals. Live NaloPay disbursement
URL is not confirmed with merchant docs (TD-028).

Deferred but plausible next (Should/Could, not built now): lawyer response notes, saved or
bookmarked lawyers, post-consultation ratings, dashboard analytics. Lawyer self-registration
with admin approval (FR-016) was added during the build; automated licence verification and
document upload remain out of scope.

## Acceptance criteria

**FR-001** — Given valid registration details, a USER account is created with a bcrypt
hash and never a plaintext password; a duplicate email returns `409`; a weak or malformed
input returns `422` with field-level messages.

**FR-002** — Valid credentials return a session token and the user's role. Invalid
credentials return `401` with an identical message for unknown email and wrong password.
Protected routes without a valid token return `401`.

**FR-003** — An authenticated user can update their own name and phone. Changing
password requires the current password; a wrong current password returns `401` and
leaves the stored hash unchanged. A forgotten password is reset with a one-use email
link (`POST /auth/forgot-password`, `POST /auth/reset-password`).

**FR-004** — A lawyer can edit only their own profile. An admin can edit any. A lawyer
cannot set their own `approvalStatus`. Attempting either returns `403`.

**FR-005** — The category list is readable without an account, because the directory filter
needs it. Only an admin can create, update, or retire a category; a USER or LAWYER attempt
returns `403`. A created category derives its slug from its name, and a duplicate name
returns `409`. Delete retires the category rather than removing the row, so past intakes and
practice areas keep their reference (ADR-008); a retired category stays hidden from ordinary
callers and remains visible to an admin, and `includeInactive=true` is ignored for anyone
else. The AI holding category `Other / Needs Review` is active by necessity but cannot be
selected as a lawyer's practice area (DEF-006).

**FR-016** — Public registration with `accountType=lawyer` creates a `LAWYER` user and a
`PENDING` profile. The profile is absent from the directory and from matching until an
admin sets `APPROVED`. A payload that tries to self-approve is ignored. `role` still
cannot create an `ADMIN`.

**FR-017** — Each lawyer profile has a consultation fee. Creating a request snapshots that
fee and leaves the request `AWAITING_PAYMENT`. The lawyer cannot see it and is not notified
until payment is confirmed. A later fee change does not alter an existing booking.

**FR-018** — Seeded plans (Starter 1 area, Practice 3, Chambers 8) cap `practiceAreaIds`.
Monthly fees are stored in pesewas and are editable by an administrator; a change applies
to the next payment only. A lawyer may pay one month (30 days) or a yearly equivalent
(365 days at 12 × the current monthly fee). The collected amount and duration are stored
on `SubscriptionPayment`. A lawyer without `subscriptionPeriodEnd` in the future is absent
from the public directory, matching, and new bookings, even if approved. A payment adds the
paid days to any time still remaining, so moving to a larger plan mid-period keeps the days
already bought and takes effect once the payment clears; the unused *value* is not prorated
(TD-026). An admin grant sets the period outright, so a grant can also shorten one. Listing
more areas than the live plan allows returns `422`.

**FR-019** — Creating a consultation requires a future `scheduledAt`. The API returns a
Google Calendar template URL for that 30-minute slot. Accepting requires a
`meet.google.com` link (not `/new`); the client then sees Join Google Meet. A missing
slot or Meet link returns `422`.

**FR-020** — A lawyer can save account name, Ghana number, and network together on their
own profile (`GET`/`PATCH /lawyers/me`). A half-filled account returns `422`. Public
`GET /lawyers` and `GET /lawyers/:id` omit those fields. `POST /lawyers/me/subscription`
uses the saved number when the payload omits `phone`. Withdrawals (FR-021) also use this
account.

**FR-021** — After payment the fee is held. `POST /consultations/:id/confirm` from both
client and lawyer (only from `ACCEPTED`) sets `COMPLETED` and inserts one wallet CREDIT.
One confirm leaves the request `ACCEPTED` and the balance unchanged. Cancel or decline
after payment creates a REFUND payout to `payerPhone` and does not credit the lawyer.
Unpaid cancel is unchanged. `POST /lawyers/me/withdrawals` debits available credit and
pays out to the saved payment account; over-balance or a missing account returns `422`.

**FR-006** — A non-empty description within length bounds is persisted with its author
before any AI call occurs. Empty or over-length input returns `422` and no AI call is
made.

**FR-007** — Given a valid concern, the system returns exactly one category drawn from the
configured list, an urgency of `NORMAL`, `IMPORTANT`, or `URGENT`, and keywords, and stores
them against the intake. Confidence below the 0.5 threshold sets `needsHumanReview` while keeping
the classification, so a weak answer is flagged rather than discarded.

**FR-008** — The stored summary is derived only from the submitted text: it introduces no
fact the client did not state, offers no advice or opinion on the merits, and cites no
legislation or case. `originalDescription` is written once and is never overwritten by
generated text, so the client's own words remain available beside the summary for the lawyer
to read (visible in the UAT evidence for UAT-004).

**FR-009** — Every AI response is validated before it is stored or used: invalid JSON, a
missing required field, a category outside the configured list, an urgency outside the enum,
or a confidence outside 0–1 all fail validation. A failed validation is treated as an AI
failure under FR-010 rather than being partially applied, and a category outside the list is
rejected with the intake marked `needsHumanReview`.

**FR-010** — Given an AI timeout, network error, or schema-invalid response, the intake
remains stored with its original text, `aiStatus` is `FAILED_FALLBACK`,
`needsHumanReview` is true, the user sees a controlled message rather than an error page,
and the user can still browse and contact lawyers. **Partially met on the review half:** the
flag is raised and counted on the admin dashboard, but no screen lets an administrator work
the flagged intakes, so the system fails safe without recovering (TD-037).

**FR-011** — Only lawyers who are `APPROVED`, whose account is active, and whose
subscription has not expired are returned. At
least one practice area must match the intake category. Each result carries a reason
string naming the matched criteria. Ranking is deterministic and identical for identical
inputs.

**FR-012** — The directory and an individual approved profile are readable without an
account, so a member of the public can judge whether the platform serves their problem
before registering. An anonymous caller sees exactly what a citizen sees: unapproved and
suspended lawyers stay hidden, and a session that is absent, expired, or revoked narrows
the view to the public one rather than failing the request. Reads are open; every write
still requires a session.

**FR-013** — A client may only create a consultation request against their own intake and
only against a lawyer who is currently eligible under FR-011. A request against another
user's intake, or against a hidden lawyer, returns `403` or `404` and never reveals whether
the resource exists.

**FR-014** — A lawyer sees only requests addressed to them, and sees the associated
structured intake only once payment has cleared: an `AWAITING_PAYMENT` request is outside the
lawyer's query scope entirely, so it returns `404` rather than a redacted record (FR-017). Accept and decline are
available only from the states the workflow allows; any other transition returns `403`. A
client sees only their own requests and their status. Any other combination returns `403` or
`404`, never another user's data.

**FR-015** — Admin-only endpoints reject USER and LAWYER callers with `403`.

## Traceability

Populated as each phase completes. `Status` values: Not started, In progress, Implemented,
Tested, Done.

| Requirement | Design element | Implementation | Test cases | Status |
| --- | --- | --- | --- | --- |
| FR-001 | Auth module | `modules/auth/*` | UT-001…006, SEC-LG-005 | Tested |
| FR-002 | Auth module | `modules/auth/*`, `lib/jwt.ts` | UT-007…010, SEC-LG-009 | Tested |
| FR-003 | Users module | `modules/users/*`; `POST /auth/change-password`; `AccountPage` at `/app/account` | IT-001…007, UT-016…018, SEC-LG-010 | Tested |
| FR-004 | Lawyers module | `modules/lawyers/*` | IT-020…029, SEC-LG-015…020 | Tested |
| FR-005 | Legal categories module | `modules/legal-categories/*` | IT-016…019, SEC-LG-003, SEC-LG-014 | Tested |
| FR-006 | Legal intake module | `modules/legal-intake/*` | IT-011…015, AI-TC-004, AI-TC-014 | Tested |
| FR-007 | AI triage service | `ai/legal-triage.service.ts`, `ai/prompts.ts` | AI-TC-001, 003, 008, 011 | Tested |
| FR-008 | AI triage service | `ai/prompts.ts`, `ai/legal-triage.service.ts` | AI-TC-001, 007 | Tested |
| FR-009 | AI schemas | `ai/schemas.ts` | AI-TC-006, 012, SEC-LG-013 | Tested |
| FR-010 | AI triage service | `ai/legal-triage.service.ts`, `modules/legal-intake/*` | AI-TC-005, 015, 016 | Tested — review queue outstanding (TD-037) |
| FR-011 | Matching service | `modules/matching/*` | MT-001…008, SEC-LG-021, SEC-LG-022 | Tested |
| FR-012 | Lawyers module | `modules/lawyers/*` — filters, search, pagination; `middleware/auth.ts` — `optionalAuth` | IT-028, IT-046…050, IT-052…054, SEC-LG-007, SEC-LG-019, SEC-LG-033…036 | Tested |
| FR-013 | Consultations module | `modules/consultations/*` | IT-030, IT-031, SEC-LG-023…025 | Tested |
| FR-014 | Consultations module | `modules/consultations/*` | IT-032…039, SEC-LG-026…030 | Tested |
| FR-015 | Admin module | `modules/admin/*`, `modules/lawyers/*` | IT-040…045, SEC-LG-031, SEC-LG-032 | Tested |
| FR-016 | Auth + lawyers | `POST /auth/register` `accountType=lawyer`; admin `PATCH /lawyers/:id` | lawyer self-registration tests in `lawyers.test.ts` | Tested |
| FR-017 | Consultations + payments | `consultationFeePesewas`; `POST /consultations/:id/pay`; NaloPay adapter + `POST /payments/callback` | payment tests in `consultations.test.ts`, `nalopay.test.ts` | Tested |
| FR-018 | Subscriptions module | `SubscriptionPackage`; `PATCH /packages/:id` fee; `POST /lawyers/me/subscription` (`interval` month or year); admin grant | `tests/subscriptions.test.ts`, IT-055, IT-063…066, MT-010 | Tested |
| FR-019 | Consultations + Google Calendar/Meet | `scheduledAt`, `meetUrl`; Calendar template URL; Meet required on accept | IT-067, IT-068, IT-033, `google-calendar.test.ts` | Tested |
| FR-020 | Lawyer payment account (Wallet) | `LawyerProfile` payment fields; own-profile only; subscribe falls back to saved MoMo | IT-069…075 | Tested |
| FR-021 | Escrow, wallet ledger, withdrawals | Dual confirm; `WalletLedger`; refund payout; `POST /lawyers/me/withdrawals` | IT-076…083 | Tested |

The non-functional requirements are traced on the same basis. Two are shown as Partially met
rather than Tested, because the evidence behind them is narrower than the requirement states.

| Requirement | Design element | Implementation | Test cases | Status |
| --- | --- | --- | --- | --- |
| NFR-001 | Auth middleware, role guards, bcrypt hashing | `middleware/auth.ts`, `modules/auth/auth.service.ts` | SEC-LG-003, SEC-LG-005, SEC-LG-009…011, UT-001…010 | Tested |
| NFR-002 | Ownership scoping, minimal logging, response shaping | `modules/legal-intake/*`, `ai/legal-triage.service.ts` (`logFailure`), `modules/lawyers/lawyers.service.ts` | SEC-LG-001, SEC-LG-002, SEC-LG-008, IT-069…075 | Tested |
| NFR-003 | AI fallback path | `ai/legal-triage.service.ts`, `modules/legal-intake/legal-intake.service.ts`, `ai/ai-client.ts` | AI-TC-005, AI-TC-015, AI-TC-016, UT-020 | Tested — the deployment needs the DEF-014 build before the fallback is guaranteed room to run |
| NFR-004 | Plain-language intake and results UI | `client/src/pages/IntakePage.tsx`, `RecommendationsPage.tsx`, `IntakeDetailPage.tsx` | UAT-001, UAT-003…006 | Partially met — developer walkthrough only (TD-034) |
| NFR-005 | Single AI adapter | `ai/ai-client.ts` | Code review; AI-TC-002 provider-failure substitution | Tested |
| NFR-006 | Read-path query design, pagination | `modules/lawyers/*`, `modules/matching/*` | PERF-001…004 | Partially met — steady state only; cold start DEF-013 |
| NFR-007 | Deterministic matching with reason strings | `modules/matching/matching.service.ts` | MT-001…008, AI-TC-010 | Tested |
| NFR-008 | Vercel deployment, hosted Postgres | `vercel.json`, `api/index.js` | Live verification 2026-08-15 (`06-deployment.md`) | Tested |

A requirement is Done only when it is implemented, acceptance criteria are satisfied, test
evidence exists, debt is recorded, and it works in the deployed environment.

Every row is therefore held at Tested rather than Done. The first four conditions are met
across the board, and the Must-priority paths were walked against the live deployment on
2026-08-15 (see `06-deployment.md`), but the deployed environment has not been exercised by
anyone outside the project, so the last condition is claimed for no requirement.
