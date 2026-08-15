# Maintenance and future evolution

## Maintenance strategy

**Corrective** — fix production defects reported by users or detected through logs.

**Adaptive** — adapt to changing operating systems, browsers, external APIs, libraries,
infrastructure, or business environment. The AI provider is the most likely source of
adaptive maintenance, since models, pricing, and interfaces change; the adapter boundary
(NFR-005) exists to contain that cost.

**Perfective** — improve usability, performance, maintainability, and feature quality
based on real usage.

**Preventive** — refactoring, dependency updates, security improvements, and expanded test
coverage before problems surface.

Also plan for security updates, dependency updates, backup and recovery, performance
improvements, scalability, monitoring, user feedback collection, and technology changes.

## Future evolution

Each item must trace back to a deferred requirement, a recorded debt item, user feedback,
or a genuine scalability, security, or integration need. Do not list fashionable
technologies for their own sake, and do not present any of this as implemented.

For each future feature record its motivation, value, dependencies, estimated complexity,
and relationship to a current limitation or debt item.

Candidates, only after the MVP is complete:

- Reviewed legal-information RAG assistant
- Multilingual intake
- Voice-based legal issue intake
- Richer lawyer verification workflows
- Two-way Google Calendar sync and auto-created Meet rooms (TD-027)
- Notifications
- Secure document upload and document summarisation
- Lawyer-side AI case intake organisation
- Feedback-informed matching
- Recurring lawyer plan billing (TD-026)
- Regional and location-aware discovery
- Integration with appropriate professional or legal-service directories
- Stronger privacy and compliance controls
- Analytics and service-access reporting

Prioritise by user research and risk, not novelty.

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
- **Three defects are open at submission** (DEF-007, DEF-008, DEF-009 in `04-testing.md`),
  each with a diagnosed cause and a named fix. They are edge cases in the consultation
  lifecycle and one admin-table layout fault, not broken Must paths.

### Validation

- **No independent user testing.** Usability (NFR-004) rests on developer walkthroughs.
  No participant outside the project has run a session, so the claim that a first-time user
  reaches recommendations without legal terminology is evidenced but not independently
  validated.
- **Performance is unmeasured.** NFR-006 states a 2-second target for non-AI operations; it
  has not been measured under load and is recorded as unmeasured rather than asserted. AI
  latency likewise is not characterised.
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
