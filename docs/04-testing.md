# Testing

Status: automated suite in place; coverage measured 2026-08-13.

**Do not record a test as executed or passing unless it actually ran.** Paste real output.

## Strategy

Provide evidence for functional, system, and user acceptance testing at minimum. Add unit
and integration testing where applicable, and consider security, usability, and
performance testing.

Write automated tests for logic with high defect risk: authentication, authorization,
business rules, calculations, validation, service methods, critical APIs, and important
persistence logic. Avoid spending examination time testing trivial framework behaviour.

## Test environment

Runner: Vitest (unit), Supertest (API integration). Postman may be used for manual
integration evidence. The AI provider is mocked in automated tests — never call the live
provider from a test suite.

Local: Node.js 22 and PostgreSQL 16 (`docker compose up -d postgres`). `npm test` in
`server/` applies committed migrations to a dedicated `test` schema
(`tests/global-setup.ts`) so development data is not truncated.

CI: GitHub Actions workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
runs three jobs on every push and pull request:

- **lint, types, audit, build** — `npm run check`, both typechecks, `npm run audit`, production builds
- **unit tests** — `npm run test:unit` (no database)
- **integration tests** — `npm run test:integration` against a Postgres 16 service
- **coverage** — `npm run test:coverage` against Postgres; fails the job if server `src/` drops below the Vitest thresholds (95% statements/lines/functions, 88% branches)

First Actions run: not yet completed.

## ID scheme

`UT-` unit · `IT-` integration · `FT-` functional · `ST-` system · `UAT-` acceptance ·
`SEC-` security · `PERF-` performance · `AI-TC-` AI behaviour · `MT-` matching

## Test case format

| Field | |
| --- | --- |
| Test Case ID | |
| Requirement ID | |
| Test Type | |
| Objective | |
| Preconditions | |
| Test Data | |
| Steps | |
| Expected Result | |
| Actual Result | |
| Status | PASS / FAIL |
| Defect ID if failed | |
| Corrective Action | |
| Retest Result | |

## Authentication tests

Valid login · invalid login · unauthorized access · protected resource access ·
logout and session invalidation · role restriction.

## AI test cases

| ID | Scenario | Expected |
| --- | --- | --- |
| AI-TC-001 | Clear employment issue | Employment category or configured equivalent |
| AI-TC-002 | Clear tenancy/property issue | Property/Tenancy category or equivalent |
| AI-TC-003 | Ambiguous issue | Low confidence or human-review path |
| AI-TC-004 | Empty input | Validation error before the AI is called |
| AI-TC-005 | AI provider failure | Controlled fallback, no lost submission |
| AI-TC-006 | Malformed provider output | Schema validation rejects it, fallback executes |
| AI-TC-007 | Fabricated-fact guard | Summary adds no unsupported names, dates, or events |
| AI-TC-008 | Category whitelist | Unsupported model category rejected or mapped to review |
| AI-TC-009 | Matching eligibility | Inactive or unapproved lawyer is not recommended |
| AI-TC-010 | Matching explanation | Recommendation reason traces to configured criteria |
| AI-TC-011 | Model wraps JSON in a markdown fence | Fence stripped, output accepted |
| AI-TC-012 | Required field missing or out of range | Schema rejects it, fallback executes |
| AI-TC-013 | Failure logging | Log records the reason, never the enquiry text |
| AI-TC-014 | Over-length input | Validation error before the AI is called |
| AI-TC-015 | Fallback persistence | `originalDescription` survives the fallback unchanged |
| AI-TC-016 | Low confidence | Classification kept but flagged for review |

Record a small evaluation dataset of representative inputs with their actual outputs. Do
not claim model accuracy percentages unless a real labelled evaluation was executed.

## Security test cases

| ID | Check |
| --- | --- |
| SEC-LG-001 | A citizen cannot read another citizen's legal intake |
| SEC-LG-002 | A lawyer cannot read a consultation or intake not sent to them |
| SEC-LG-003 | A citizen cannot call admin management endpoints |
| SEC-LG-004 | AI API credentials are absent from frontend bundles and API responses |
| SEC-LG-005 | Stored passwords are hashed, not plaintext |
| SEC-LG-006 | Malformed intake text does not bypass validation or crash the service |
| SEC-LG-007 | Inactive or unapproved lawyers are excluded from results |
| SEC-LG-008 | Direct object IDs do not bypass ownership authorization |
| SEC-LG-009 | Login does not reveal whether an email has an account |
| SEC-LG-010 | Privilege-bearing fields cannot be set through the profile endpoint |
| SEC-LG-011 | Registration cannot be used to self-assign a privileged role |
| SEC-LG-012 | A token missing or misdeclaring its claims is rejected |
| SEC-LG-013 | AI output cannot switch off the application's own review flag |
| SEC-LG-014 | A non-admin cannot reveal retired categories by passing the admin flag |
| SEC-LG-015 | A user cannot create a lawyer account |
| SEC-LG-016 | A lawyer cannot create another lawyer account |
| SEC-LG-017 | A lawyer cannot set their own approval status |
| SEC-LG-018 | A lawyer cannot edit another lawyer's profile |
| SEC-LG-019 | A suspended lawyer disappears from the directory |
| SEC-LG-020 | An unapproved profile is indistinguishable from a missing one |
| SEC-LG-021 | A citizen cannot read recommendations for an intake they do not own |
| SEC-LG-022 | Recommendations require authentication |
| SEC-LG-023 | A citizen cannot raise a consultation against another person's intake |
| SEC-LG-024 | A consultation cannot be sent to an unapproved lawyer |
| SEC-LG-025 | A lawyer cannot send consultation requests |
| SEC-LG-026 | A citizen cannot accept a request on the lawyer's behalf |
| SEC-LG-027 | A lawyer cannot cancel a request sent to them |
| SEC-LG-028 | An unrelated lawyer can neither see nor act on a request |
| SEC-LG-029 | An unrelated citizen cannot read a request or its intake |
| SEC-LG-030 | A suspended account cannot act on an existing request |
| SEC-LG-031 | An admin cannot suspend their own account |
| SEC-LG-032 | A citizen cannot reach any admin endpoint |
| SEC-LG-033 | An anonymous visitor sees no more than a citizen does |
| SEC-LG-034 | `includeInactive` is ignored for an anonymous caller |
| SEC-LG-035 | Opening reads to the public does not open writes |
| SEC-LG-036 | A junk or revoked token degrades to the public view, never a wider one |

Broader review areas: input validation, authentication, authorization, password storage,
secret management, SQL injection, XSS, CSRF where applicable, insecure direct object
references, unsafe file uploads, sensitive-data exposure, dependency risks, and
error-message leakage.

Never introduce a known serious weakness to save time. If a security shortcut is
unavoidable, document it as debt with its risk, severity, and mitigation, and decide
whether deployment remains acceptable. Fix critical security debt before final deployment
wherever feasible.

## User acceptance testing

Tie UAT to real user goals and demonstrate that implemented Must requirements solve the
intended problem. Independent external participants have **not yet completed** a session.
The cases below were executed by the developer against the local Docker stack
(`http://localhost:5173`, `http://localhost:4000`) using the gated demo accounts in
`README.md`. That is a walkthrough, not a claim of third-party UAT.

Two runs are recorded. Run 1 on **2026-08-13** covered UAT-001, UAT-002, and UAT-006 and
left UAT-003 failing and UAT-004/UAT-005 unreached. Run 2 on **2026-08-15** re-executed
UAT-003, UAT-004, and UAT-005. Two conditions of run 2 matter when reading the evidence:

- The admin password was supplied locally through `SEED_ADMIN_PASSWORD`, which is what run
  1 lacked. The seed leaves an existing admin's password unchanged, so the generated one
  from the first seed was unrecoverable. The value is not recorded in this repository.
- The payment step was executed twice: once against the live NaloPay **test** gateway, and
  once against a second API process started from the same source with
  `NALOPAY_MERCHANT_ID` unset on port 4001, which is the documented credentials-unset
  path that logs and captures locally. Both are labelled below. Neither is a claim that
  live mobile money moved.

Screenshots from run 2 are in `docs/uat-evidence/`.

```
UAT-001
Actor: Citizen (demo Ama Mensah)
Scenario: Describe an unpaid-salary dismissal in Accra in everyday language and reach lawyers.
Acceptance criterion: Original words are stored; the user is not blocked when AI fails; lawyers remain reachable (NFR-004, FR-006, FR-010, FR-012).
Expected outcome: An organised result or a controlled fallback, then recommendations or the directory.
Actual outcome: POST /api/v1/intakes returned 201 after ~124s with aiStatus FAILED_FALLBACK, needsHumanReview true, category Other / Needs Review. originalDescription (152 characters) was unchanged. GET .../recommendations returned note "This enquiry has not been categorised yet, so no recommendation can be made. You can still browse the lawyer directory and contact someone directly." GET /lawyers listed the five seeded lawyers.
Status: Pass on the fallback path. Live AI classification was not observed in this run. It was observed in run 2 (2026-08-15): three intakes returned aiStatus COMPLETED within about 7 seconds each, category Property & Tenancy, needsHumanReview false, with originalDescription stored unchanged.
```

```
UAT-002
Actor: Visitor (not signed in)
Scenario: Open the lawyer directory before creating an account (ADR-009, FR-012).
Acceptance criterion: Approved lawyers are visible; payment-account fields are not; writes still require a session.
Expected outcome: A filterable list with names, fees, and View profile.
Actual outcome: Browser at http://localhost:5173/lawyers showed heading "Find a legal professional", search "e.g. unpaid salary", and five cards: Abena Sarpong, Akua Owusu, Efua Danso, Kwame Asante, Yaw Boakye, with GH₵ fees and regions. Sign in / Get started remained available. JSON for a directory lawyer had no paymentPhone or wallet keys.
Status: Pass
```

```
UAT-003
Actor: Citizen
Scenario: Book a consultation with a lawyer reached from the directory (run 1) or from a recommendation (run 2), including the fee (FR-013, FR-017, FR-019).
Acceptance criterion: A future slot is stored; unpaid bookings stay AWAITING_PAYMENT and hidden from the lawyer until pay succeeds.
Expected outcome: 201 booking; pay prompt or local capture; lawyer then sees the request.
Actual outcome (run 1, 2026-08-13): POST /consultations returned 201, status AWAITING_PAYMENT, feePesewas 25000, matchReason "Chosen by the client from the lawyer directory rather than from a recommendation.", googleCalendarUrl present. POST .../pay with 0244123456 / MTN returned 503; lawyer GET /consultations was empty (correct while unpaid).
Actual outcome (run 2, 2026-08-15): Booking from a recommendation — POST /consultations returned 201, AWAITING_PAYMENT, feePesewas 30000, matchReason "Recommended because Kwame Asante lists Property & Tenancy as a practice area.", googleCalendarUrl present.
  Live test gateway at the real fee: POST .../pay with 0244123456 / MTN returned 422 "Invalid value for amount". The payment log recorded gateway code PAY-INVAL-0058 for amount '300.00', so the gateway was reachable this time and rejected the amount, not the credentials or the hash.
  Gateway probe (run from inside the server container, test merchant): amounts '0.10', '1.00', '1.50', '2.00', and '5.00' were accepted with 201 PAY-CRTD-0055 and an order_id; '10.00', '100.00', and '300.00' were rejected with 400 PAY-INVAL-0058. The test merchant therefore caps a collection somewhere between GH₵ 5 and GH₵ 10 (TD-031); the request payload and trans_hash are accepted as built.
  Live test gateway within that cap: the lawyer set his fee to GH₵ 5 through PATCH /lawyers/me, the citizen re-booked, and POST .../pay returned 200 with reference LCPfbfaa750c04666d84ea5 and the hint "Approve the mobile money prompt on 0244123456. If asked, use *920*1*820#." The consultation correctly stayed AWAITING_PAYMENT. POST /consultations/verify-payment returned 400 "Payment has not been confirmed yet. Approve the prompt on your phone, then try again.", and the gateway's collection-status reported PENDING — nobody can approve a prompt on the fictional demo MSISDN. Lawyer GET /consultations did not include the booking while it was unpaid.
  Credentials-unset path (port 4001), fee restored to GH₵ 300: POST /consultations returned 201 AWAITING_PAYMENT feePesewas 30000, and POST .../pay returned 200 moving it to PENDING with reference LCPdfdd84be064438b49519, which is what made UAT-004 reachable.
Status: Pass for booking, for payment initiation against the live test gateway, and for capture on the credentials-unset path. A live mobile-money capture at a real consultation fee is **not yet completed**: the test merchant rejects amounts above about GH₵ 5, no real subscriber can approve the prompt on the demo number, and NaloPay cannot POST its callback to localhost (TD-025, TD-031).
```

```
UAT-004
Actor: Lawyer (demo Kwame Asante — the lawyer the run-2 enquiry was matched to)
Scenario: Read the structured intake and accept or decline (FR-014).
Acceptance criterion: The lawyer sees the citizen's own words and can accept with a Google Meet URL.
Expected outcome: Inbox shows the paid request; accept stores meetUrl.
Actual outcome (run 1, 2026-08-13): Not reached — the booking from UAT-003 never left AWAITING_PAYMENT.
Actual outcome (run 2, 2026-08-15): The paid request appeared in the lawyer's inbox at http://localhost:5173/app/requests under "Incoming consultation requests" (uat-004-lawyer-inbox.png). The detail screen showed the summary, a section headed "IN THEIR OWN WORDS" carrying the citizen's unchanged sentence, Urgent and Property & Tenancy tags, the client's name and phone, "GH₵ 300.00 — held until both of you confirm the consultation happened", Add to Google Calendar, Join Google Meet, and Confirm consultation happened (uat-004-accepted-request.png, uat-004-structured-intake.png). Over the API, GET /consultations/:id as the lawyer returned intake.originalDescription unchanged alongside aiSummary; PATCH /consultations/:id with status ACCEPTED and meetUrl https://meet.google.com/abc-defg-hij returned 200 with the meetUrl stored; the citizen then saw ACCEPTED with the same link; a second lawyer (Akua Owusu) requesting the same id received 404.
Status: Pass
```

```
UAT-005
Actor: Administrator
Scenario: Open the admin overview and lawyer approval queue (FR-015).
Acceptance criterion: Admin-only screens load; USER/LAWYER callers cannot use them.
Expected outcome: Overview with pending lawyers and platform counts.
Actual outcome (run 1, 2026-08-13): not yet completed (admin password is generated at first seed and is not recorded in the repository).
Actual outcome (run 2, 2026-08-15, admin password supplied locally through SEED_ADMIN_PASSWORD): Approval queue exercised end to end first — registering Nana Adjei as a lawyer created the profile PENDING, admin stats moved to pending 1, the profile was visible to the admin and absent from the public directory, and PATCH /lawyers/:id with approvalStatus APPROVED as admin returned 200 APPROVED. The screens were then opened in the browser, so they show the queue already cleared: http://localhost:5173/app/admin loaded with "Needs a decision" — 0 lawyers awaiting approval, 3 enquiries needing review, 3 AI fallbacks, 1 awaiting a lawyer — over platform counts of 12 users, 7 approved lawyers, and 5 live plans (uat-005-admin-overview.png). The Lawyers screen loaded with Pending / Approved / Rejected / All filters, the empty state "pending is empty when the queue is clear" on Pending, and on All a row per practitioner with review and plan badges, a Reject control, and Grant plan disabled until a plan is chosen (uat-005-admin-lawyers.png). Guards: PATCH /lawyers/:id returned 403 for a citizen and 403 for another lawyer; GET /admin/stats returned 403 for citizen and lawyer and 401 anonymously. PATCH /admin/users/:id/status returned 200 for SUSPENDED and 200 again restoring ACTIVE.
Status: Pass
```

```
UAT-006
Actor: Visitor
Scenario: Read the public home page and judge whether the product claims to give legal advice (CON-003, NFR-004).
Acceptance criterion: Copy tells people they can describe a concern in their own words and that a lawyer remains responsible for advice.
Expected outcome: Plain-language steps; no verdict or prediction.
Actual outcome: http://localhost:5173/ heading "We help you reach the right lawyer — they remain responsible for professional advice." Steps: "Tell us what happened", "We organise your request", "Connect with a lawyer."
Status: Pass for the public home page. Signed-in intake screen disclaimer was not opened in the browser in this run.
```

| ID | Actor | Goal | Result |
| --- | --- | --- | --- |
| UAT-001 | Citizen | Describe a concern and still reach lawyers if AI fails | Pass (fallback path) |
| UAT-002 | Visitor | Browse the directory without an account | Pass |
| UAT-003 | Citizen | Book and pay | Pass for booking, live initiation, and credentials-unset capture; live capture at a real fee not yet completed (TD-031) |
| UAT-004 | Lawyer | Accept a paid request | Pass (2026-08-15) |
| UAT-005 | Admin | Use the admin overview | Pass (2026-08-15) |
| UAT-006 | Visitor | See that the product is not legal advice | Pass (home page) |

## Defect log

| Defect ID | Description | Severity | Requirement | Detected during | Root cause | Fix | Status | Retest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-001 | Seed created the admin account with an **empty password** | Critical | NFR-001 | Phase 1 seed execution | `.env` supplies `SEED_ADMIN_PASSWORD=""`; the `??` operator only falls back on `null`/`undefined`, so `""` was accepted as a supplied password | Treat a blank value as absent: `process.env.SEED_ADMIN_PASSWORD?.trim() \|\| undefined`. Applied the same fix in `config/env.ts`, which filters `""` from the environment before parsing so a blank `AI_PROVIDER_API_KEY` cannot read as configured | Fixed | Pass — re-seed produced a real generated password; affected row deleted |

| DEF-002 | Malformed JSON and oversized bodies returned `500` | Medium | NFR-001 | Phase 2 correctness review | `express.json()` raises errors carrying `type`/`status` rather than `AppError` instances, so they fell past every branch of the error handler into the generic 500 case | Map the known body-parser failure types to `400`, `413`, and `415` before the generic branch | Fixed | Pass — IT-008 and IT-009 |
| DEF-003 | A token missing its `role` claim reported "Invalid token" | Low | NFR-001 | Phase 2 correctness review | The shape check threw from inside the `try` that also caught signature failures, so its own `catch` swallowed it and the "Malformed token" message was unreachable | Verify the signature inside the `try` and validate claim shape after it | Fixed | Pass — SEC-LG-012 |
| DEF-004 | Test ID `SEC-LG-003` was assigned to two different tests | Low | — | Phase 2 correctness review | The registration privilege-escalation test reused the ID belonging to the admin-endpoint guard case, so the traceability matrix under-reported coverage | Reassign the registration case to `SEC-LG-011` and add the missing IDs to the security catalogue | Fixed | Pass — IDs verified unique across the suite |
| DEF-005 | An AI-fallback enquiry was told "no approved lawyer lists this practice area" | Medium | FR-010 | Live check against the running stack, phase 6 | Matching guarded on `categoryId` being null, but the AI-failure path assigns the real `Other / Needs Review` holding category instead of leaving it null. The guard never fired for the case it was written for, so matching ran against a category no lawyer practises and the empty result was reported as an absence of coverage rather than as work still to do | Treat the holding category by name as uncategorised, returning the same explanatory note and directory link as a null category | Fixed | Pass — MT-009 |
| DEF-006 | `Other / Needs Review` was offered as a selectable practice area | Low | FR-004 | Browser walkthrough of the lawyer profile editor | Category pickers listed every active category, and the holding category is active by necessity — intakes have to be able to point at it. A lawyer could therefore tick a practice area that matching deliberately skips, producing a setting that silently does nothing | Refuse it server-side in practice-area validation, and filter it out of the three client pickers through one shared `selectable()` helper so the UI cannot drift from the rule | Fixed | Pass — IT-051 |
| DEF-007 | Cancelling an unpaid booking permanently blocks sending that enquiry to the same lawyer again | Low | FR-013 | UAT run 2, 2026-08-15 | `@@unique([intakeId, lawyerProfileId])` on `ConsultationRequest` counts every row whatever its status, so a CANCELLED row keeps the pair occupied and the create returns P2002 → 409 "You have already sent this enquiry to that lawyer" | Not yet implemented. Needs uniqueness scoped to live statuses (or the pairing released on cancel) plus a migration; the citizen's workaround today is to start a new enquiry or choose another lawyer | Open | not yet completed |
| DEF-008 | A booking cancelled while unpaid becomes visible to the lawyer | Low | FR-019 | UAT run 2, 2026-08-15 | The lawyer's scope excludes only `AWAITING_PAYMENT`, so cancelling an unpaid booking moves the row into a status the lawyer can list even though the fee was never paid and it was never a request | Not yet implemented. Exclude cancelled rows that never carried a `paymentReference` from the lawyer scope, with an integration test alongside the existing unpaid-visibility case | Open | not yet completed |
| DEF-009 | Practitioner names wrap one character per line in the admin Lawyers table at a 1024 px viewport | Low | NFR-004 | UAT run 2, 2026-08-15 (uat-005-admin-lawyers.png) | Not yet diagnosed — the table's column widths leave the practitioner column too narrow at that width | Not yet implemented | Open | not yet completed |
| DEF-010 | Confirmation links in email pointed at `http://localhost:5173` from the deployed site | High | FR-001 | Reported link would not confirm, 2026-08-15 | `CLIENT_ORIGIN` on Vercel carries the local development origin, so `appUrl()` built every verification and reset link against localhost. A CORS probe of the live API showed it: `Origin: http://localhost:5173` was allowed and its own host was refused. The variable is stored as sensitive, so its value cannot be read back through the CLI to confirm the exact string | Partly code, partly configuration. In code, resolve the origin from `VERCEL_PROJECT_PRODUCTION_URL` (then `VERCEL_URL`) when `CLIENT_ORIGIN` is absent on Vercel, and add the production host to the CORS list. That closes the unset case; a wrong value still wins, so the Production variable also has to be corrected and the project redeployed | Fixed | Partial — the Production variable was corrected and redeployed on 2026-08-15, and the CORS probe now returns the live host and refuses localhost. A registration on the live URL with a real inbox, confirming the emailed link resolves and works, is **not yet completed** |
| DEF-011 | A valid confirmation link reported "invalid or has expired" in local development | Medium | FR-001 | Tracing the DEF-010 report, 2026-08-15 | The verify page posted the token from an effect, and React's StrictMode double-mount in development ran it twice. The first call consumed the single-use token and the second was rejected, so the page rendered the retry's 400 | Hold the in-flight request in a ref keyed by token so the second mount re-reads the same promise instead of posting again | Fixed | Pass — FT-006, which fails against the previous code |
| DEF-012 | A paid subscription did not appear as active until the lawyer reloaded the profile page | Medium | FR-018 | E2E re-run while checking DEF-011, 2026-08-15 (FT-003 had regressed to a failure) | The effect that seeds the local profile snapshot depended on the `useAsync` return value, which is a new object literal on every render. It therefore re-ran after every render and overwrote the snapshot — including one just replaced by the confirmed subscription — with the response from the first load | Depend on the fetched record instead of the hook's wrapper, so the effect only re-runs when a load actually resolves | Fixed | Pass — FT-003 |

Severity: **Critical** blocks core use, deployment, or security · **High** major
requirement broken · **Medium** workaround exists · **Low** cosmetic. Fix Critical and High
defects before any optional enhancement.

When fixing a defect: reproduce it, add or update a test, apply the smallest safe fix,
rerun related tests, check for regressions, and record it here if it matters to the
report. Never mask an error to make a test pass.

## Results summary

The checks below are **manual verification of Phase 1 setup**, actually executed on
2026-08-12, recorded here as evidence rather than as test cases. The automated suite
arrived in Phase 2 and is recorded in the section after this one.

| Check | Command | Result |
| --- | --- | --- |
| Prisma schema valid | `npx prisma validate` | Pass — schema valid |
| Prisma client generates | `npx prisma generate` | Pass — client v6.19.3 generated |
| Server typechecks | `npm run typecheck` | Pass — no errors |
| Server production build | `npm run build` | Pass |
| Client production build | `npm run build` | Pass — 145 kB JS, 6.6 kB CSS |
| Server boots | `node dist/server.js` | Pass — listening on port 4000 |
| Config fails fast on bad env | unset `JWT_SECRET`, import config | Pass — refused to start, named both missing variables |
| Unknown route returns consistent JSON | `GET /api/nope` | Pass — `404` with `{"error":{"code":"NOT_FOUND",…}}` |
| Health degrades when DB unreachable | `GET /api/health` | Pass — `503` `{"status":"degraded","database":"unavailable"}` |
| Dependency audit — server | `npm audit` | Pass — 0 vulnerabilities after upgrading Vitest to v4 |
| Dependency audit — client | `npm audit` | Pass — 0 vulnerabilities |
| Database container healthy | `docker compose up -d postgres` | Pass — healthy after ~8s |
| Initial migration applies | `prisma migrate dev --name init` | Pass — `20260812160801_init`, 7 tables created |
| Seed populates categories | `npm run prisma:seed` | Pass — 9 categories, 1 admin user |
| Health with live database | `GET /api/health` | Pass — `200 {"status":"ok","database":"connected"}` |

All Phase 1 verification is complete.

## Phase 2 — automated test run (2026-08-12)

`npm test` — **3 files, 29 tests, all passing**. Tests run against a dedicated
`test` schema in the same PostgreSQL database, created by `prisma migrate deploy` in
global setup and truncated before every test. Verified afterwards that the `public` schema
still held its 9 seeded categories and 1 admin, so tests cannot corrupt development data.

Some coverage was pulled forward from Phase 9 because writing it alongside the auth code
was cheaper than reconstructing the cases later.

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| UT-001 | FR-001 | Creates a USER account and returns a token | Pass |
| UT-002 | FR-001 | Response never contains the password hash or plaintext | Pass |
| UT-003 | FR-001 | Duplicate email returns `409` | Pass |
| UT-004 | FR-001 | Email case is normalised so duplicates cannot slip through | Pass |
| UT-005 | FR-001 | Short password returns `422` with field-level detail | Pass |
| UT-006 | FR-001 | Malformed email returns `422` | Pass |
| UT-007 | FR-002 | Valid credentials return a token | Pass |
| UT-008 | FR-002 | Wrong password returns `401` | Pass |
| UT-009 | FR-002 | Suspended account cannot log in | Pass |
| UT-010 | FR-002 | Logout returns `204` | Pass |
| UT-011 | NFR-001 | Role guard admits the required role | Pass |
| UT-012 | NFR-001 | Role guard admits any one of several accepted roles | Pass |
| UT-013 | NFR-001 | Unauthenticated caller gets `401`, not `403` | Pass |
| IT-001 | FR-003 | Valid token returns own profile without the hash | Pass |
| IT-002 | FR-003 | Missing token returns `401` | Pass |
| IT-003 | FR-003 | Malformed token returns `401` | Pass |
| IT-004 | FR-003 | Token for a deleted user returns `401` | Pass |
| IT-005 | FR-003 | Valid token stops working once the account is suspended | Pass |
| IT-006 | FR-003 | Own profile updates successfully | Pass |
| IT-007 | FR-003 | Empty update payload returns `422` | Pass |
| IT-008 | NFR-001 | Malformed JSON returns `400`, not `500` | Pass |
| IT-009 | NFR-001 | Oversized body returns `413`, not `500` | Pass |
| IT-010 | NFR-001 | Unknown route returns the standard error shape | Pass |
| SEC-LG-003 | NFR-001 | USER rejected with `403` by an admin-only guard | Pass |
| SEC-LG-005 | NFR-001 | Stored password is a bcrypt hash, not plaintext | Pass |
| SEC-LG-009 | NFR-001 | Unknown email and wrong password are indistinguishable | Pass |
| SEC-LG-010 | NFR-001 | `role` and `status` cannot be changed via the profile endpoint | Pass |
| SEC-LG-011 | NFR-001 | `role` in the registration payload is ignored | Pass |
| SEC-LG-012 | NFR-001 | Token missing its `role` claim is rejected as malformed | Pass |

Two new security cases were added beyond the original plan. **SEC-LG-009** covers account
enumeration: if a wrong password and an unknown email gave different responses, the login
endpoint would reveal which emails have accounts. **SEC-LG-010** covers mass assignment on
the profile endpoint. Both are asserted against the database, not just the response body.

## Phase 5 — AI legal intake test run (2026-08-12)

`npm test` — **5 files, 66 tests, all passing** (37 added this phase). The AI provider is
replaced by a stub: `tests/ai-triage.test.ts` injects one directly into the triage service,
and `tests/legal-intake.test.ts` mocks the adapter module so the route, service,
persistence, and triage logic all run for real while only the model's answer is controlled.
No test contacts a live provider.

Stubbing is not a shortcut here — a real provider cannot be made to time out, return broken
JSON, or invent a category on demand, and those are precisely the paths that matter.

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| AI-TC-001 | FR-007, FR-008 | Valid model output is accepted and stored | Pass |
| AI-TC-003 | FR-007 | Below-threshold confidence is kept but flagged | Pass |
| AI-TC-004 | FR-006 | Empty description returns `422`, no AI call, no row written | Pass |
| AI-TC-005 | FR-010, NFR-003 | Provider failure returns `201` with the enquiry intact | Pass |
| AI-TC-006 | FR-009 | Non-JSON and wrong-shape responses take the fallback | Pass |
| AI-TC-007 | CON-003 | Prompt forbids advice, blame, prediction, and fabrication | Pass |
| AI-TC-008 | FR-007 | Invented category is replaced, rest of the output kept | Pass |
| AI-TC-011 | FR-009 | Markdown-fenced JSON is unwrapped and accepted | Pass |
| AI-TC-012 | FR-009 | Missing `summary`/`urgency`, bad enum, out-of-range confidence rejected | Pass |
| AI-TC-013 | NFR-002 | Failure log contains the reason and a length, never the text | Pass |
| AI-TC-014 | FR-006 | Over-length description returns `422` before any AI call | Pass |
| AI-TC-015 | FR-010 | `originalDescription` is unchanged after a fallback | Pass |
| AI-TC-016 | FR-007 | Low-confidence result is stored and flagged, not discarded | Pass |
| IT-011 | FR-006 | Submission returns the triaged intake | Pass |
| IT-012 | FR-006 | Intake is attributed to the authenticated caller | Pass |
| IT-013 | FR-006 | Unauthenticated submission returns `401` | Pass |
| IT-014 | NFR-002 | Author can read their own intake | Pass |
| IT-015 | NFR-002 | List endpoint returns only the caller's own intakes | Pass |
| SEC-LG-001 | NFR-002 | Another user's intake returns `404`, identical to a missing one | Pass |
| SEC-LG-013 | FR-009 | `needsHumanReview: false` from the model cannot override the threshold | Pass |

Two of these deserve their reasoning recorded. **SEC-LG-001** asserts that another user's
intake and a non-existent id return an identical `404` — a `403` would confirm the id
exists, which is the leak the case is meant to prevent. **SEC-LG-013** exists because the
model is asked for `needsHumanReview` but must not be trusted with it; the application ORs
its own conditions in, so a confidently wrong answer cannot switch off review.

An honest limitation: these tests verify that the *pipeline* handles every AI outcome
correctly. They say nothing about whether the model classifies Ghanaian legal enquiries
*accurately*, which needs a labelled evaluation set that does not exist (TD-011). No
accuracy claim should be made from this run.

Still outstanding for Phase 9: matching, consultation, and admin coverage.

## Phase 3 — categories and lawyer profiles test run (2026-08-12)

`npm test` — **6 files, 89 tests, all passing** (23 added this phase, all in
`tests/lawyers.test.ts`). Admin accounts are created directly in the database because the
seed script is the only thing that creates them in production; everything else goes
through HTTP.

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| IT-016 | FR-005 | Admin creates a category, slug derived from the name | Pass |
| IT-017 | FR-005 | Duplicate category name returns `409` | Pass |
| IT-018 | FR-005 | Delete retires the category instead of removing the row | Pass |
| IT-019 | FR-005 | Retired categories hidden from users, visible to admins | Pass |
| IT-020 | FR-004 | Admin creates a lawyer account with profile and practice areas | Pass |
| IT-021 | FR-004 | The new lawyer can log in with the admin-set credentials | Pass |
| IT-022 | FR-004 | Approval defaults to `PENDING` | Pass |
| IT-023 | FR-004 | Invalid practice area returns `400`, no account left behind | Pass |
| IT-024 | FR-004 | Duplicate lawyer email returns `409` | Pass |
| IT-025 | FR-004 | A lawyer edits their own profile | Pass |
| IT-026 | FR-004 | Replacing practice areas removes the omitted ones | Pass |
| IT-027 | FR-015 | An admin approves a lawyer | Pass |
| IT-028 | FR-012 | An approved lawyer appears in the directory | Pass |
| IT-055 | FR-018 | An approved lawyer without a live subscription is hidden | Pass |
| IT-029 | NFR-001 | The directory never exposes the password hash | Pass |
| SEC-LG-003 | NFR-001 | A user cannot create or retire categories | Pass |
| SEC-LG-007 | FR-011 | A pending lawyer is hidden from users, visible to admins | Pass |
| SEC-LG-014 | NFR-001 | `includeInactive=true` is ignored for non-admins | Pass |
| SEC-LG-015 | FR-015 | A user cannot create a lawyer account | Pass |
| SEC-LG-016 | FR-015 | A lawyer cannot create another lawyer account | Pass |
| SEC-LG-017 | FR-004 | A lawyer cannot approve themselves — `403` | Pass |
| SEC-LG-018 | FR-004 | A lawyer cannot edit another lawyer — `403` | Pass |
| SEC-LG-019 | FR-011 | A suspended lawyer drops out of the directory | Pass |
| SEC-LG-020 | NFR-002 | A pending profile returns `404`, identical to a missing one | Pass |

Three of these encode decisions worth defending. **IT-023** asserts that a failed profile
leaves no orphan account, which is what the transaction is for — a `LAWYER` login with no
profile would be a broken state reachable only through a partial write. **SEC-LG-017**
expects `403` rather than a silent field strip, because unlike `role` on `/users/me`,
`approvalStatus` is a legitimate field that simply belongs to someone else. **SEC-LG-020**
asserts a pending profile and a nonexistent id are indistinguishable, so the endpoint
cannot be used to discover who has applied to the platform.

## Phases 6–8 — matching, consultations, administration test run (2026-08-12)

`npm run verify` at the repository root: Biome clean, both typechecks clean, **132 tests
passed across 9 files**, `npm audit --audit-level=high` reporting 0 vulnerabilities on
both workspaces. The 46 cases below are the new ones.

Two of them exist because of defects the automated suite did not catch. MT-009 follows
DEF-005, found by exercising the running stack: the suite had tested the null-category
path faithfully, but null is not how the AI failure path actually represents "could not
categorise". IT-051 follows DEF-006, found by walking the lawyer profile editor in a
browser. Both were reachable only by using the system rather than by testing the units
it is made of, which is the argument for doing both.

### Matching — FR-011 (`tests/matching.test.ts`)

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| MT-001 | FR-011 | Only lawyers practising the intake category are returned | Pass |
| MT-002 | FR-011 | Unapproved and suspended lawyers are excluded | Pass |
| MT-003 | FR-011 | A location match ranks above a non-match | Pass |
| MT-004 | FR-011 | An available lawyer ranks above an unavailable one, both retained | Pass |
| MT-005 | FR-011 | Identical input produces an identical order on repeat calls | Pass |
| MT-006 | NFR-007 | Every recommendation names the criteria that matched | Pass |
| MT-007 | CON-003 | No reason claims an outcome or ranks a lawyer as "best" | Pass |
| MT-008 | FR-010 | An uncategorised intake returns no matches plus an explanation | Pass |
| MT-009 | FR-010 | An intake on the AI fallback category is treated as uncategorised | Pass |
| MT-010 | FR-018 | A lawyer without a live subscription is not recommended | Pass |
| SEC-LG-021 | NFR-002 | Another user's intake yields `404` | Pass |
| SEC-LG-022 | NFR-001 | Recommendations require authentication | Pass |

**MT-005** is the test that makes ADR-001 verifiable rather than merely asserted: four
lawyers with identical scores and identical experience must still come back in the same
order twice, which only holds because the comparator ends in a tiebreak on a unique
column. **MT-007** checks the reason string against a list of outcome-claiming phrases —
the matching path produces user-facing prose, so it needs the same CON-003 guard the AI
prompt has. **MT-004** asserts that an unavailable lawyer is ranked lower but still
returned, which is the behaviour FR-011 asks for and the opposite of the more obvious
choice of filtering them out.

### Consultations — FR-013, FR-014 (`tests/consultations.test.ts`)

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| IT-030 | FR-013 | A citizen sends a request against their own intake | Pass |
| IT-031 | FR-013 | The same enquiry cannot go to the same lawyer twice — `409` | Pass |
| IT-032 | FR-014 | A lawyer sees requests addressed to them, with the structured intake | Pass |
| IT-033 | FR-014 | A lawyer accepts a pending request | Pass |
| IT-034 | FR-014 | A lawyer declines a pending request | Pass |
| IT-035 | FR-014, FR-021 | A lawyer cannot mark an accepted request completed alone — `403` | Pass |
| IT-036 | FR-014 | A citizen cancels their own pending request | Pass |
| IT-037 | FR-014 | A declined request cannot be revived — `400` | Pass |
| IT-038 | FR-014 | Requests can be filtered by status | Pass |
| IT-039 | FR-015 | An admin sees every request for oversight | Pass |
| SEC-LG-023 | NFR-002 | Another person's intake cannot be used — `404` | Pass |
| SEC-LG-024 | FR-011 | An unapproved lawyer cannot be contacted — `404` | Pass |
| SEC-LG-025 | FR-013 | A lawyer cannot send consultation requests — `403` | Pass |
| SEC-LG-026 | FR-014 | A citizen cannot accept on the lawyer's behalf — `403` | Pass |
| SEC-LG-027 | FR-014 | A lawyer cannot cancel a request sent to them — `403` | Pass |
| SEC-LG-028 | NFR-002 | An unrelated lawyer sees nothing and gets `404` | Pass |
| SEC-LG-029 | NFR-002 | An unrelated citizen gets `404` | Pass |
| SEC-LG-030 | NFR-001 | A suspended account cannot act — `403` | Pass |

**IT-037** and **SEC-LG-026** together cover the two distinct ways a status change can be
refused, and the API distinguishes them: a role that may never make a transition gets
`403`, while a role that may make it but not from the current status gets `400`. Collapsing
both into one code would tell a stale browser tab it lacked permission when it merely held
an out-of-date view.

### Administration — FR-015 (`tests/admin.test.ts`)

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| IT-040 | FR-015 | An admin lists platform users | Pass |
| IT-041 | FR-015 | The user list filters by role | Pass |
| IT-042 | FR-015 | Suspension revokes access on the next request | Pass |
| IT-043 | FR-015 | An admin reactivates a suspended account | Pass |
| IT-044 | NFR-001 | Admin endpoints never expose password hashes | Pass |
| IT-045 | FR-015 | Statistics report the review queue and AI fallback count | Pass |
| SEC-LG-031 | FR-015 | An admin cannot suspend their own account — `400` | Pass |
| SEC-LG-032 | NFR-001 | A citizen cannot reach any admin endpoint — `403` | Pass |

**IT-042** is the test that justifies re-reading the account on every request rather than
trusting the token: it suspends a user holding a valid, unexpired token and asserts the
very next call fails. **SEC-LG-031** exists because a single administrator who suspended
themselves would have no way back in through the API.

### Discovery — FR-012 (`tests/lawyers.test.ts`)

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| IT-046 | FR-012 | The directory filters by practice area | Pass |
| IT-047 | FR-012 | The directory filters by region, case-insensitively | Pass |
| IT-048 | FR-012 | Free-text search matches the bio, not only the name | Pass |
| IT-049 | FR-012 | Results paginate and `total` reflects the full match set | Pass |
| IT-050 | NFR-006 | An out-of-range `limit` is rejected with `422`, not clamped | Pass |
| IT-051 | FR-004 | The AI holding category cannot be selected as a practice area | Pass |

**IT-048** encodes the assumption that someone searching the directory describes a problem
("eviction") rather than naming a firm, so the bio has to be searchable. **IT-050** prefers
rejection over silent clamping: a caller asking for 5000 records should learn the limit
exists rather than quietly receive 50 and assume that was everything.

## Public access without an account (2026-08-12)

Seven cases added when the directory, profile detail, and category list were opened to
anonymous callers (ADR-009). `npm test` in `server/`: **139 tests passed across 9 files**.

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| IT-052 | FR-012 | An anonymous visitor can browse the directory | Pass |
| IT-053 | FR-012 | An anonymous visitor can open an approved profile, with no hash exposed | Pass |
| IT-054 | FR-012 | An anonymous visitor can read the categories the filter needs | Pass |
| SEC-LG-033 | NFR-001 | An anonymous visitor sees no more than a citizen — pending hidden in both the list and a direct fetch | Pass |
| SEC-LG-034 | NFR-001 | `includeInactive=true` is ignored for an anonymous caller | Pass |
| SEC-LG-035 | NFR-001 | Opening reads does not open writes — `POST /lawyers` and `POST /categories` return `401` and create nothing | Pass |
| SEC-LG-036 | NFR-001 | A junk or revoked token falls back to the public view, never a wider one | Pass |

The security half of this set matters more than the access half. Making an endpoint
public is one line; the risk is that the *scope* silently widens with it. SEC-LG-033
through SEC-LG-035 pin the boundary from three directions — listing, direct fetch by id,
and the admin-only query parameter — so a later change that leaks pending profiles fails
a test rather than shipping.

**SEC-LG-036** covers the deliberate asymmetry in `optionalAuth`: a bad or revoked token
degrades to anonymous rather than being rejected, because the resource is public either
way. The test proves degrading can only narrow, using a suspended admin's still-valid
token and asserting they get the stranger's view rather than the admin's.

## Container verification (2026-08-12)

`docker compose build` then `docker compose up -d`, actually executed. Images:
`legalconnect-server` 663 MB, `legalconnect-client` 295 MB. All three services reached
`running`, the server applied both migrations and reported no pending ones.

| Check | Request | Result |
| --- | --- | --- |
| Health, unversioned | `GET :4000/api/health` | Pass — `200 {"status":"ok","database":"connected"}` |
| Versioned route mounted | `GET :4000/api/v1/users/me` | Pass — `401 UNAUTHORIZED` (reached the guard) |
| Unversioned route gone | `GET :4000/api/users/me` | Pass — `404 NOT_FOUND` |
| Validation failure | `POST :4000/api/v1/auth/register`, bad fields | Pass — `422` with three field-level messages |
| Parse failure | `POST :4000/api/v1/auth/login`, broken JSON | Pass — `400 MALFORMED_JSON` |
| Client dev server | `GET :5173/` | Pass — `200` |
| Client proxy to API | `GET :5173/api/health` | Pass — `200`, proxied to the server container |

The AI fallback was also exercised against the running stack with no provider key
configured, which is the deployed default until one is supplied:

```
aiStatus:         FAILED_FALLBACK
category:         Other / Needs Review
needsHumanReview: true
aiError:          AI provider is not configured
original text:    preserved verbatim
```

The corresponding server log line was
`[ai-triage] falling back { reason: 'AI provider is not configured', descriptionChars: 81 }`
— reason and length only, no enquiry text. This confirms **AI-TC-013 / NFR-002** in a real
runtime rather than only under a mocked provider. The account and intake created for this
check were deleted afterwards; the development database is back to 9 categories and the
single admin user.

## Lawyer subscription plans (2026-08-13)

FR-018. `npm test` in `server/` after yearly billing landed: **179 tests passed across 12 files**
(83.56s). Server `tsc --noEmit` and client `tsc -b --noEmit` both clean.

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| IT-056 | FR-018 | Active packages list in order of area cap | Pass |
| IT-057 | FR-018 | A lawyer can pay for a plan that fits their listed areas | Pass |
| IT-058 | FR-018 | A plan that allows fewer areas than currently listed returns `422` | Pass |
| IT-059 | FR-018 | An active plan blocks adding more areas than it allows | Pass |
| IT-060 | FR-018 | An admin can grant a plan without payment; the lawyer then appears | Pass |
| SEC-LG-037 | NFR-001 | A citizen cannot grant a subscription — `403` | Pass |
| IT-061 | FR-018 | An expired plan drops the lawyer out of the directory | Pass |
| IT-062 | FR-018 | A citizen cannot book a lawyer who is not subscribed — `404` | Pass |
| IT-063 | FR-018 | An admin can change a plan fee; the listed amount updates | Pass |
| IT-064 | FR-018 | A fee change does not rewrite a month already paid | Pass |
| SEC-LG-038 | NFR-001 | A lawyer cannot change a plan fee — `403` | Pass |
| IT-065 | FR-018 | A yearly payment charges 12 × the monthly fee and lasts 365 days | Pass |
| IT-066 | FR-018 | An interval other than month or year returns `422` | Pass |
| IT-055 | FR-018 | Approved but unsubscribed is hidden from the directory | Pass |
| IT-088 | FR-018 | Upgrading mid-period keeps the days already paid for | Pass |
| IT-089 | FR-018 | An admin grant sets the period outright, so it can still be shortened | Pass |
| MT-010 | FR-018 | Unsubscribed lawyers are not recommended | Pass |

Eligibility for directory, matching, and new bookings is one helper (`publicLawyerWhere`)
so the three surfaces cannot drift. Recurring collection is not tested because it is not
implemented (TD-026). Yearly billing is a prepaid equivalent, not a discount. `npm test -- tests/subscriptions.test.ts`
on 2026-08-13: **13 passed**.

## Password change (2026-08-13)

`npx vitest run tests/auth.test.ts` — **30 passed**. Forgot/reset by email was already
covered (UT-013, UT-014). Signed-in change is new.

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| UT-016 | FR-003 | A signed-in USER can change their password; the old password then fails login | Pass |
| UT-017 | FR-003 | Wrong current password returns `401` and leaves the hash unchanged | Pass |
| UT-018 | FR-003 | Unauthenticated `POST /auth/change-password` returns `401` | Pass |

## Google Calendar and Meet booking (2026-08-13)

`npx vitest run tests/google-calendar.test.ts tests/consultations.test.ts tests/subscriptions.test.ts`
— **3 files, 40 passed**. Meet rooms are not created by the API (TD-027).

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| IT-067 | FR-019 | Booking without `scheduledAt` returns `422` | Pass |
| IT-068 | FR-019 | Accept without a Google Meet URL returns `422` | Pass |
| IT-033 | FR-014, FR-019 | Accept stores the Meet URL and a Calendar template link | Pass |

## Lawyer payment account / Wallet (2026-08-13)

`npx vitest run tests/lawyers.test.ts tests/subscriptions.test.ts` — **2 files, 62 passed**.
That run covered the saved MoMo identity only (FR-020). Ledger, credit, and withdrawals are IT-076…083 below (FR-021).

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| IT-069 | FR-020 | A lawyer can save and read back their payment account on `/lawyers/me` | Pass |
| IT-070 | FR-020, FR-021 | Public directory list and detail omit `paymentPhone`, the number itself, and `wallet` | Pass |
| IT-071 | FR-020 | A half-filled payment account returns `422` | Pass |
| IT-072 | FR-020 | Subscribing without `phone` uses the saved payment account | Pass |
| IT-073 | FR-020 | Paying with a new number persists it onto the payment account | Pass |
| IT-074 | FR-020 | Sending `null` on all three payment fields clears the account | Pass |
| IT-075 | FR-020 | A pay-from number without network is stored with the inferred network | Pass |

## Frontend E2E (2026-08-14, re-run 2026-08-15)

Playwright drives the Vite client at `http://127.0.0.1:5173`. `/api/v1` is mocked in
`client/e2e/mock-api.ts` so the suite does not need Postgres, seed data, or NaloPay.
`npm run test:e2e` — **6 passed (7.3s)** on 2026-08-15. FT-003 failed on that re-run before
DEF-012 was fixed; FT-006 was added with DEF-011.

```
Running 6 tests using 6 workers
  ✓  FT-006: a confirmation link is spent once and reports success (FR-001, DEF-011) (2.5s)
  ✓  FT-001: a visitor can open the landing page and browse the directory (FR-012) (3.1s)
  ✓  FT-004: a rejected collection shows the gateway message on the plan form (FR-018) (3.6s)
  ✓  FT-005: an expired session signs the citizen out and returns them to sign-in (FR-002) (3.7s)
  ✓  FT-002: a citizen signs in, describes an issue, and sees the organised request (FR-001, FR-006) (3.7s)
  ✓  FT-003: a lawyer pays for a plan and the UI shows the MoMo prompt then the active plan (FR-018) (5.4s)
  6 passed (7.3s)
```

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| FT-001 | FR-012 | Visitor opens landing, browses directory, sees a lawyer card | Pass |
| FT-002 | FR-001, FR-006 | Citizen signs in, submits an intake, sees the organised request and original words | Pass |
| FT-003 | FR-018 | Lawyer signs in, pays for Starter, UI reaches an active plan | Pass |
| FT-004 | FR-018 | Mocked `PAY-INVAL` / Invalid reference appears on the plan form | Pass |
| FT-005 | FR-002 | Expired JWT (`401 Session expired`) clears the session and returns to sign-in | Pass |
| FT-006 | FR-001 | A confirmation link posts its token once and reports success, not "expired" | Pass |

First time locally: `npx --prefix client playwright install chromium`. Not part of
GitHub Actions CI (browsers are large); run `npm run test:e2e` on a developer machine.

## NaloPay collection contract (2026-08-14)

Live gateway calls are mocked (`fetch` in unit tests; `startPayment` / `verifyPayment` on
the HTTP paths). The suite never calls `nalopaytest.nalosolutions.com`.

`npm run test:unit -- --run tests/nalopay.test.ts tests/nalopay-live.test.ts` — **2 files, 40 passed**.
`npm --prefix server run test:integration -- tests/nalopay-http.test.ts` — **1 file, 4 passed**.

```
 Test Files  2 passed (2)
      Tests  40 passed (40)
 Duration  381ms
```

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
 Duration  6.54s
```

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| UT-019 | FR-017 | Collection body uses local MSISDN, `trans_hash`, HTTPS `callback`, no `extra_data`, ASCII description | Pass |
| UT-020 | FR-017 | `PAY-INVAL` with `cause: amount` reports the refused cedi figure, not the gateway's "Invalid value for amount" | Pass |
| IT-084 | FR-018 | Subscribe stays pending when the mocked gateway does not capture; reference is `LCP` + 20 hex | Pass |
| IT-085 | FR-018 | Adapter `PAY-INVAL` / `Invalid reference` is `422` on `POST /lawyers/me/subscription` | Pass |
| IT-086 | FR-018 | Confirm calls `verifyPayment` with the stored order id and activates the plan | Pass |
| IT-087 | FR-017 | Booking pay stays `AWAITING_PAYMENT` until mocked `verify-payment` succeeds | Pass |

A local Docker subscribe against the real test merchant (2026-08-14) returned
`PAY-INVAL-0060` `{ cause: "reference", description: "Invalid reference" }` for
`lc_<cuid>_<hex>` (45 characters, underscores). References are now `LCP`/`LCW`/`LCR` plus
20 hex characters.

A subscribe at a real plan price (2026-08-15) returns `PAY-INVAL-0058`
`{ cause: "amount", description: "Invalid value for amount" }`. The same amount was retried
as `"150.00"`, as `"150"`, and as the JSON number `150` and refused identically, so the test
merchant is rejecting the value rather than the format; a descending ladder on the same
endpoint accepted GH₵ 5.00 (`201 PAY-CRTD-0055`) and refused GH₵ 6.00 and above (TD-031).
The adapter now names the refused cedi figure instead of repeating the gateway's wording,
which describes a field the payer does not control.

## Consultation escrow, wallet credit, and withdrawals (2026-08-13)

`npx vitest run tests/consultations.test.ts tests/lawyers.test.ts tests/nalopay.test.ts` — **3 files, 87 passed**.
Live NaloPay disbursement URL is not confirmed (TD-028); tests capture immediately.

| ID | Requirement | Case | Result |
| --- | --- | --- | --- |
| IT-076 | FR-021 | Both parties confirming credits the lawyer wallet (`20000`) and sets `COMPLETED` | Pass |
| IT-077 | FR-021 | One confirmation leaves the request `ACCEPTED` and the wallet at `0` | Pass |
| IT-078 | FR-021 | Cancel after payment records a REFUND payout and does not credit the lawyer | Pass |
| IT-079 | FR-021 | Decline after payment records a REFUND payout | Pass |
| IT-080 | FR-021 | Confirming twice does not insert a second CREDIT | Pass |
| IT-081 | FR-021 | Withdrawal within balance debits the ledger (`50` GHS leaves `15000`) | Pass |
| IT-082 | FR-021 | Withdrawal over the available balance returns `422` | Pass |
| IT-083 | FR-021 | Withdrawal without a saved payment account returns `422` | Pass |

## Live deployment verification (2026-08-15)

Run against <https://legalconnect-beryl.vercel.app> after seeding the hosted database, because
a green local suite says nothing about the deployed environment. Expected against actual:

| Check | Expected | Actual | Result |
| --- | --- | --- | --- |
| `prisma migrate status` on the hosted database | All migrations applied | 11 of 11 applied, schema up to date | Pass |
| `GET /api/health` | `{"status":"ok","database":"connected"}` | As expected | Pass |
| `GET /api/v1/categories` | 9 seeded categories | `200`, 9 returned | Pass |
| `GET /api/v1/packages` | 3 plans | `200`, 3 returned | Pass |
| `GET /api/v1/lawyers` | 5 approved lawyers across 4 cities | `200`, `total=5` — Accra ×2, Kumasi, Takoradi, Tamale | Pass |
| `POST /api/v1/auth/login` as admin | `200` with `role=ADMIN` | As expected | Pass |
| `GET /api/v1/admin/stats` with that token | Admin-only route answers | `200` — 5 approved, 5 subscribed, 9 active categories | Pass |
| `POST /api/v1/auth/login` as demo citizen | `200` with `role=USER` | As expected | Pass |
| `POST /api/v1/auth/login` as demo lawyer | `200` with `role=LAWYER` | As expected | Pass |
| CORS preflight from the live origin | Origin echoed back | `access-control-allow-origin` returns the live host | Pass |
| CORS preflight from `http://localhost:5173` | No allow-origin header | No header returned | Pass |
| SPA deep link `/lawyers` | Application shell, not a JSON 404 | `200` HTML identical to `/` | Pass |

`/admin/stats` reported 8 users where the seed creates 7, so one account on the hosted
database predates the seed — consistent with a registration made while investigating DEF-010.

Not covered by this run: a paid consultation end to end, because the test merchant refuses
amounts at real fee levels (TD-031), and a live registration confirming an emailed link
resolves (DEF-010, still partial).

## Known issues and testing limitations

Classification quality is unmeasured — see TD-011. The suite proves the AI contract is
enforced and every failure mode degrades safely, not that the categories it returns are
right. Frontend component tests do not exist yet (TD-008). Playwright E2E covers four
browser flows against a mocked API (FT-001…005).

**Overlapping runs used to destroy each other**, because every run shared one `test`
schema and truncated it before each test. Observed on 2026-08-12: a `verify` run that
overlapped another test run reported 2 failures, and a deliberate reproduction — a second
run started three seconds after the first — produced 52 and 53 failures against 0 for
either run alone. It recurred on 2026-08-15 (108 then 112 failures) while server files were
being edited during a run. The symptoms are misleading, surfacing as authorization and
validation failures rather than as the data race they are; the ownership queries were
re-read afterwards and are unconditionally scoped by `clientId` for non-admin callers.

Each run now migrates its own `test_<pid>` schema and drops it on teardown (TD-009,
resolved). Verified on 2026-08-15 by starting two suites in the same second —
`subscriptions.test.ts` (23) and `lawyers.test.ts` (53) — both green. Runs are still serial
*within* a run, so the suite's duration is unchanged.

## Server coverage (2026-08-13)

`npm run test:coverage` in `server/` — **31 files, 358 tests, all passing**, then v8
report for `server/src` (excludes `src/server.ts`, the process entrypoint). Coverage
runs unit files that mock `env.js` in a separate Vitest project from the integration
suite so `isTest` cannot leak.

```
 Test Files  31 passed (31)
      Tests  358 passed (358)
 Duration  129.50s

Statements   : 96.3% ( 1224/1271 )
Branches     : 89.42% ( 837/936 )
Functions    : 99.61% ( 256/257 )
Lines        : 97.48% ( 1123/1152 )
```

Thresholds enforced in `server/vitest.coverage.config.ts` and the CI **coverage** job:
95% statements, lines, and functions; 88% branches. Branches sit below 95% because
several remaining paths are environment-gated (email send outside `NODE_ENV=test`,
`env.ts` parse failure at process start) or defensive catches (non-P2002 rethrows,
concurrent update races). Frontend component tests still do not exist (TD-008).

## Conclusion

Testing gives good confidence in the server and limited confidence in the browser layer.

As at 2026-08-15 the automated suites stand at **164 unit tests and 220 integration tests,
all passing**, plus six Playwright flows exercising the browser against a mocked API. The
coverage run of 2026-08-13 measured 96.3% of statements and 89.42% of branches in
`server/src`, with thresholds enforced in CI rather than merely reported, so a regression in
coverage fails the build instead of being noticed later.

Twelve defects were found and logged. Nine are fixed and retested against a named case;
three remain open (DEF-007 and DEF-008, both consultation-state edge cases, and DEF-009, a
layout defect in the admin table at a 1024 px viewport), and one is partial: DEF-010's code
and configuration are both corrected and verified by probe, but a registration on the live
URL with a real inbox has not been performed. Every open item is recorded with its cause and
the fix it needs, not left implicit.

Three defects are worth noting as evidence that the strategy worked rather than as
embarrassments. DEF-011 and DEF-012 were both found by running the browser suite rather than
the server suite, which is precisely the gap the E2E layer exists to cover: neither could
have been caught by an API test, because both were client-side lifecycle faults. DEF-010 was
found by probing the deployed environment rather than any local run, which is why deployment
verification is treated as a test activity here and not as an afterthought.

What testing does **not** establish is equally important. It does not show that the AI
returns the *right* category — only that the contract around it is enforced and every
failure mode degrades safely (TD-011). It does not cover React components in isolation
(TD-008). Usability rests on developer walkthroughs; no independent participant has run a
session, so NFR-004 is evidenced but not independently validated. NFR-006 performance has
not been measured. A live mobile money capture at a real consultation fee has not been
performed, because the test merchant refuses amounts at that scale (TD-031).

On balance the Must-priority paths — authentication, authorisation and ownership, intake
with its AI fallback, matching, and the consultation lifecycle — are covered by automated
tests at both the unit and integration level, and the security cases are written as
adversarial attempts rather than happy paths. That is the part of the system where a defect
would be most costly, and it is the part with the strongest evidence.
