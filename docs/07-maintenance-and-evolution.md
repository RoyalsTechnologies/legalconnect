# Maintenance and future evolution

## Maintenance strategy

How the four maintenance types would be handled after the examination. Nothing here is
claimed as running today: there is one maintainer, no on-call rotation, and no scheduled
job beyond the CI workflow that runs on every push.

### Corrective maintenance

Fix production defects reported by users or found in the logs. The route is the one already
used during the build and recorded in `09-process-playbook.md`: reproduce it, write the test
that fails, apply the smallest safe fix, re-run the suite, then record cause, fix, and
retest in the defect log in `04-testing.md`. Severity decides urgency — Critical and High
before any enhancement. The four open defects (DEF-007, DEF-008, DEF-009, DEF-013) are the first
queue this process would pick up.

### Adaptive maintenance

Adapt to changes outside the project's control: the AI provider's models, pricing, and
interface; NaloPay's API; Google's Calendar and Meet behaviour; the SMTP and SMS providers;
Node.js and PostgreSQL versions; browser behaviour; and the hosting platform's build and
function contracts. The AI provider is the most likely source, which is why NFR-005 confines
provider-specific code to `server/src/ai/` — the adapter boundary exists to keep an external
change from becoming an internal rewrite. Payment and calendar integrations are the next
most exposed, and both are already flagged as debt (TD-027, TD-028).

### Perfective maintenance

Improve what works based on real usage rather than on taste: the intake wording that
citizens actually stumble on, directory search quality (TD-019), the first-load cost on a
mobile connection (TD-024), and the matching weights once there are outcomes to learn from
(TD-022). The performance baseline now exists (PERF-001 to PERF-004), so this work can start
from evidence: extend the sample to the write paths and to sustained load, then optimise what
the numbers indict rather than what looks slow.

### Preventive maintenance

Work done before a problem surfaces. Dependency and security updates through `npm audit`,
already a required CI job and part of `npm run verify`; extending the deliberately targeted
test coverage (TD-008); replacing the shortcuts recorded in the register before they are
built on; and keeping the documentation true as the code changes, since a stale document is
a defect that takes longer to find than a broken test.

### Operational concerns that cut across all four

| Concern | Position today | Intended handling |
| --- | --- | --- |
| Security updates | `npm audit` runs in CI and in `npm run verify`; both packages report zero vulnerabilities | Automated dependency alerts, and a fix in the release that follows an advisory |
| Dependency updates | Manual, at the maintainer's discretion | Batched minor and patch updates on a fixed cadence, majors read and tested individually |
| Backup and recovery | Whatever the hosted PostgreSQL plan provides; not configured or tested by this project | Documented point-in-time recovery, with a restore actually rehearsed rather than assumed |
| Performance | Read paths sampled on 2026-08-15 (PERF-001 to PERF-004); cold start over target (DEF-013); AI path uncharacterised (TD-002) | Extend the sample to writes and sustained load, address the cold start, then act on evidence |
| Scalability | Single Express function, no pooler (TD-030), offset paging (TD-018) | Pooler first, then the read paths that the baseline shows to be hot |
| Monitoring | Structured logs with PII redaction; files do not survive a serverless invocation (TD-029) | Ship logs to a hosted sink, then alert on AI failure rate and payment errors (TD-014) |
| User feedback | None collected — no participant outside the project has used the system | A route for citizens and lawyers to report a problem, feeding the corrective queue |
| Technology changes | Node.js 22 LTS, PostgreSQL 16, React 18 | Track LTS end dates and move deliberately, not on release day |

## Future evolution

Each item must trace back to a deferred requirement, a recorded debt item, user feedback,
or a genuine scalability, security, or integration need. Do not list fashionable
technologies for their own sake, and do not present any of this as implemented.

For each future feature record its motivation, value, dependencies, estimated complexity,
and relationship to a current limitation or debt item.

Candidates, only after the MVP is complete. Complexity uses the story-point scale in
`02-effort-estimation.md`; anything at 8 is high-risk and would be decomposed before being
committed to. None of this is implemented.

| Candidate | Motivation | Value | Depends on | Complexity | Traces to |
| --- | --- | --- | --- | --- | --- |
| Two-way Calendar sync with auto-created Meet rooms | The lawyer pastes a Meet link by hand today, and the "calendar" is a template URL | Fewer missed consultations; the slot exists in the lawyer's real calendar | Google OAuth consent, verified scopes | 5 | TD-027, FR-019 |
| Recurring plan billing | A lawyer disappears from the directory because they forgot to pay, not because they stopped practising | Continuous visibility; predictable revenue | Gateway support for stored mandates, unconfirmed for NaloPay | 8 | TD-026, FR-018 |
| Richer lawyer verification | Approval currently means an admin read the profile; nothing checks a practising certificate | Citizens can trust that a listed lawyer is licensed — the platform's core promise | A cooperating register or an accepted manual review process | 8 | TD-005, FR-016 |
| Feedback-informed matching | Weights are chosen constants with no outcome data behind them | Ranking that reflects which matches actually led to a consultation | Enough consultation history; ADR-001's explainability must survive | 5 | TD-004, TD-022, FR-011 |
| Consultation status notifications beyond email | Status changes reach the citizen by email only, and delivery depends on SMTP being configured | The citizen learns of an acceptance without checking the site | Notification preferences; SMS credentials already optional in the codebase | 3 | TD-020 (partly repaid), FR-014 |
| Secure document upload and summarisation | Citizens describe documents they cannot attach — a tenancy agreement, a summons | Better triage and a better-prepared lawyer | Object storage, virus scanning, a stricter privacy position | 8 | TD-007, out-of-scope list in `01-requirements.md` |
| Multilingual intake (Twi, Ga, Ewe, Hausa) | Access friction is linguistic as well as procedural; English-only intake excludes the people the project is for | Reaches citizens who cannot describe a legal issue in English | Provider quality in Ghanaian languages, and native-speaker review | 8 | NFR-004, the aim in `01-requirements.md` |
| Voice intake | Typing a paragraph on a phone is itself a barrier, and literacy is not universal | Removes the writing barrier from the first step | Speech-to-text quality in Ghanaian English and local languages | 8 | NFR-004 |
| Regional and location-aware discovery | Location is a ranking factor but not a browsing dimension | A citizen can look for help near them without describing an issue first | Reliable region and district data on profiles | 3 | FR-012, TD-019 |
| Reviewed legal-information assistant (RAG) | Citizens ask general questions the platform deliberately refuses to answer | Orientation without crossing into advice, if and only if it can be sourced and reviewed | A curated, reviewed corpus of Ghanaian legal information | 8 | The boundary in "Optional AI legal-information assistant" below; TD-001 |
| Lawyer-side intake organisation | A lawyer with many requests has no triage of their own | Faster response to the requests that matter most | Volume that makes it worthwhile | 5 | FR-014 |
| Integration with professional or legal-aid directories | The lawyer list is populated by hand, one profile at a time | Coverage grows without manual onboarding | An authority willing to share data | 5 | TD-005 |
| Stronger privacy and compliance controls | Intake text leaves the boundary and there is no retention policy | Defensible handling of sensitive legal facts | Legal review; possibly in-region hosting | 5 | TD-007 |
| Analytics and access reporting | The project claims to improve access but cannot yet show it | Evidence of whether access friction actually fell — the aim, measured | Event capture that does not undermine the privacy position | 3 | The aim in `01-requirements.md`, TD-014 |

Prioritise by user research and risk, not novelty. Two of these — verification and
multilingual intake — matter more to the stated aim than anything else on the list, and both
are 8s, which is exactly why they are not in the 48-hour scope.

## Optional AI legal-information assistant

Deferred unless the MVP is complete. If it is ever implemented, it must provide general
legal information only, never replace a lawyer, clearly identify uncertainty, and never
fabricate laws, cases, agencies, deadlines, or procedures. The response pattern is general
information → limitations and disclaimer → encouragement to connect with an appropriate
professional through the platform. RAG only with time to build and test it properly.

An unrestricted legal-advice chatbot must never become the core of this project.

## Limitations

The limitations the project actually has, as at 2026-08-15. Each is real and observed, not
a generic caveat, and each names where it is tracked.

### Process and scope

- **48 hours, one person.** Every design decision carries the bias of a single estimator
  with no second opinion and no peer review (CON-001). The estimate itself had no consensus
  technique available; the variance analysis in `02-effort-estimation.md` is a
  self-assessment.
- **Reduced feature scope.** Twenty-one functional requirements were built — fifteen Must and
  six Should. No Could-priority feature exists. Everything deliberately excluded is listed
  under "Out of scope" in `01-requirements.md` and revisited under future evolution above.
- **The interface is deliberately simplified.** Screens are assembled from Ant Design
  components with a small theme override in `client/src/theme.ts`; there is no bespoke design
  system, no visual design pass, and no mobile-first layout work beyond what the component
  library provides. Admin screens are plain tables — DEF-009 is what that costs at a narrow
  viewport. The trade-off bought working Must paths, and it means the product looks like a
  functional prototype rather than a finished consumer service.
- **Four defects are open at submission** (DEF-007, DEF-008, DEF-009, DEF-013 in
  `04-testing.md`), all Low, each with a diagnosed cause and a named fix. They are two edge
  cases in the consultation lifecycle, one admin-table layout fault, and the deployment's cold
  first request — not broken Must paths.

### Validation

- **No independent user testing.** Usability (NFR-004) rests on developer walkthroughs.
  No participant outside the project has run a session, so the claim that a first-time user
  reaches recommendations without legal terminology is evidenced but not independently
  validated.
- **Performance is sampled, not load-tested.** The read paths were measured on 2026-08-15
  (PERF-001 to PERF-004 in `04-testing.md`): comfortably inside the NFR-006 target in steady
  state, with a cold first request on the deployment at 2.25 s, which is DEF-013. Nothing was
  measured under sustained or higher concurrency, no write or payment path was timed, and AI
  latency is deliberately not characterised because it depends on a free-tier provider.
- **AI answer quality is unmeasured.** The tests prove the contract around the model is
  enforced and every failure mode degrades safely; they do not show the categories it
  returns are correct (TD-011). There is no labelled evaluation set.
- **No frontend component tests.** Browser confidence comes from six Playwright flows
  against a mocked API; React components are not tested in isolation (TD-008).

### External dependencies

- **One LLM provider on a free tier** (CON-004), reached through a gateway. Rate limits,
  latency, and model availability are outside the project's control. The system is built to
  survive the provider's absence, which is the mitigation, but a degraded provider still
  degrades the experience.
- **Intake text leaves the trust boundary.** A citizen's description is transmitted to a
  third-party model provider for classification. This is the most significant privacy
  consideration in the system, recorded as TD-007 and requiring disclosure to users.
- **Payments are only partially verifiable.** The NaloPay test merchant refuses amounts at
  or above GH₵ 6, so no end-to-end capture at a real consultation fee or plan price has been
  performed (TD-031), and the live disbursement path is not confirmed against merchant
  documentation (TD-028).
- **Email and SMS are optional by design.** With no provider configured the server logs
  instead of sending. That keeps the workflow usable, but it means notification delivery is
  not proven in the deployed environment.

### Platform and operations

- **Serverless constraints.** The API runs as a single Vercel function, so it must stay
  stateless between requests, cold starts are possible, and no in-process scheduler or
  background worker exists. Anything periodic would need an external trigger.
- **One environment.** There is no staging tier; the deployed environment is also the
  demonstration environment, so a change is verified locally and then in production.
- **No monitoring or alerting.** Errors are logged to the platform's log stream; nothing
  aggregates them, and no alert fires on a failure (TD-014 covers the AI case specifically).
  A fault in the deployed system would be noticed by a user, not by the operator.
- **No rate limiting.** No throttle protects login, registration, or the AI-backed intake
  endpoint against abuse or cost exhaustion.
- **No token revocation.** A JWT stays valid until it expires; sign-out is client-side, so a
  stolen token cannot be invalidated early (TD-003).

### Data and domain

- **No professional verification.** Lawyers appear because they registered and an
  administrator approved them. Nothing checks a licence number against the General Legal
  Council or any regulator, so the directory's trustworthiness rests entirely on manual
  approval.
- **Seed data is fictional, and it is live.** The five practitioners on the deployed site are
  invented and do not represent real lawyers, yet the URL is public and presents them exactly
  as it would present a real profile. This was a deliberate trade-off so the application could
  be assessed end to end, and it is recorded as TD-032 with the steps needed to undo it once
  assessment is over.
- **No retention or deletion policy.** Data minimisation is applied at collection, but there
  is no automated retention window, no user-initiated account deletion, and no export.
- **Accessibility is not audited.** No screen-reader or contrast testing was performed, and
  one layout defect at a 1024 px viewport is already known (DEF-009).
- **Ghana-specific by design.** Regions, mobile money networks, and the Accra timezone are
  assumed throughout; the system is not internationalised and supports English only.
