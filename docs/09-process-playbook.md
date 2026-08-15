# Process playbook

Working principles, gates, and workflows for the 48 hours.

## Working principles

Requirements before implementation. Architecture before uncontrolled coding. Acceptance
criteria before marking a feature complete. Tests before claiming correctness. Evidence
before claiming completion. Scope discipline over feature quantity. Simple architecture
over unnecessary complexity. Security by default. Traceability from requirement to
implementation to test.

Explicitly record shortcuts caused by the time constraint; never hide technical debt.
Never over-engineer. Never introduce a technology that does not solve a real project need.
Never rewrite a large working area without a clear requirement or defect. Prefer
incremental reversible changes, and preserve deployability throughout.

## Quality gates

**Gate A — before implementation:** problem statement, stakeholders, requirements,
priorities, MVP scope, effort estimate, chosen stack.

**Gate B — before a feature is complete:** acceptance criteria, working implementation,
validation and error handling, relevant tests.

**Gate C — before deployment:** core Must requirements working, critical tests passing on
GitHub Actions (`.github/workflows/ci.yml`), critical security issues addressed,
production configuration prepared.

**Gate D — before submission:** live app verified, repository verified, documentation
complete, technical debt plan complete, credentials verified, all links verified.

## Definition of done

A requirement is done only when the implementation is complete, the code builds and runs,
acceptance criteria are met, validation exists, failure cases are handled, relevant tests
have been executed, technical debt is documented, documentation is updated, and the
feature works in the deployed environment where deployment affects it.

**"Code generated" is not "done".**

### AI intake — specific definition of done

Original text submitted and stored · backend validation passes · the AI call happens
server-side · provider output is schema-validated · the category is restricted to allowed
values · the summary is stored and displayed · fallback works when the provider fails ·
representative AI test cases have actually been executed · no API key is exposed
client-side · relevant technical debt is recorded · deployment behaviour is verified.

## New feature workflow

For a substantial feature, work through requirement, priority, acceptance criteria, effort
estimate, dependencies, design impact, data and API changes, security considerations,
implementation, tests, technical debt, and documentation impact. Cover these briefly and
in proportion — a small change does not need a twelve-part analysis, it needs doing.

If the feature is too large, propose a smaller version and state what is deferred. Do not
dump large amounts of code without analysing impact first.

## Bug fix workflow

Reproduce or understand the failing condition → identify the related requirement →
identify the root cause → apply the smallest safe fix → add or update a test → rerun
related tests → check for regressions → update the defect log if significant → update the
debt register if the fix is temporary.

Never mask an error simply to make tests pass.

## Refactoring workflow

Refactor only when code blocks further progress, duplication is significant,
maintainability risk is high, correctness or security requires it, and tests give enough
confidence. Preserve behaviour, ensure critical-path tests exist first, rerun tests
afterwards, and do not smuggle in unrelated features.

## Change management

When requirements change: identify the changed requirement, update its record, assess
effort impact, assess architecture and data impact, assess test impact, assess technical
debt, reprioritise scope, and only then implement.

Two things about this log are worth stating rather than leaving to be noticed. It opens at
CH-018: there is no CH-001 to CH-017, and there never was — the git history of this file shows
the first version already starting at CH-018, so the changes made before 2026-08-13 were
absorbed without a change record. The IDs are left as they are because they are cited from
`02-effort-estimation.md` and `10-srs.md`, and renumbering would break those citations to no
benefit. Second, FR-017, the consultation fee itself, has no entry of its own: it arrived with
the same product-owner conversation that produced CH-018 to CH-021 and is estimated as E-17,
but it was never written up here as a change. Both are failures to follow the process above,
and both are recorded rather than tidied away.

| Change ID | Date/time | Reason | Affected requirement | Impact | Decision |
| --- | --- | --- | --- | --- | --- |
| CH-018 | 2026-08-13 | Product owner: lawyers subscribe monthly; each package is a cap on legal areas of interest | FR-018 (Should) | Schema, matching/directory eligibility, lawyer and admin UI | Smallest version: prepaid month + area cap; recurring billing deferred as TD-026 |
| CH-019 | 2026-08-13 | Product owner: lawyer can pay monthly or a yearly equivalent | FR-018 (Should) | Payment interval on `SubscriptionPayment`; lawyer and admin UI | Year = 365 days at 12 × current monthly fee; no separate yearly price field |
| CH-020 | 2026-08-13 | Product owner: lawyer wallet with a saved Ghana MoMo payment account | FR-020 (Should) | LawyerProfile payment fields; `/app/wallet`; subscribe prefill | Saved MoMo identity only — no ledger balance, no NaloPay disbursement (TD-025 stays) |
| CH-021 | 2026-08-13 | Product owner: hold consultation fee until both confirm, then credit wallet; withdrawals and refunds | FR-021 (Should) | Ledger, dual confirm, payout adapter, Wallet UI | Live disbursement path unverified (TD-028); no commission or disputes |
| CH-022 | 2026-08-15 | Product owner: a lawyer can move up to a larger plan mid-period | FR-018 (Should) | `activatePlan` adds the purchased term to time remaining; plan copy and Upgrade badge; IT-088, IT-089 | Unused days carry over rather than being discarded; still no proration or credit of value (TD-026 stays). Admin grants keep setting the period outright so one can be shortened |
| CH-023 | 2026-08-15 | Engineering: integration runs corrupted each other again, costing two runs to diagnose | None (test infrastructure) | `tests/global-setup.ts` migrates a per-run `test_<pid>` schema and drops it on teardown | Closes TD-009. Runs are still serial within a run; a crashed run can leave a schema behind |
| CH-024 | 2026-08-15 | Product owner: the deployed site must be walkable by an examiner | CON-002 | Hosted database seeded with categories, packages, an admin, a demo citizen, and five approved fictional lawyers; all three roles verified by signing in against the live API | Publishes fictional practitioners on a public URL, against the seed script's own warning. Accepted for the examination window only and recorded as TD-032 with the steps to undo it |
| CH-025 | 2026-08-15 | Engineering: a 401 kept failing tests of endpoints that were working | None (test infrastructure) | Fixtures mint sessions with `signToken` via `tests/session.ts` instead of posting to `/auth/login`; the three tests that genuinely exercise sign-in keep doing so | Removes the misleading symptom and the dependency, but not the underlying intermittent sign-in failure, which is now TD-033 |
| CH-026 | 2026-08-15 | Engineering: a documentation audit before submission found the artefacts had drifted from the build and from each other | None (documentation) | Duplicate ADR-006 renumbered to ADR-011; system context diagram added; security design section written; API table completed to all 43 endpoints; module tree, entity list, and the stale ADR-010 trade-off corrected; SRS sections 3, 4, and 9 given their own content; NFR priorities, acceptance criteria, and traceability added; assumptions and in-scope stated; four gaps the audit exposed recorded as TD-034 to TD-037 | Three findings were substantive rather than cosmetic and are now open debt rather than silent omissions: no independent UAT participants, no rate limiting on authentication, and no queue behind the human-review flag. The re-estimation claim in the SRS was corrected — the Should items were re-estimated after acceptance, not before, which is a departure from this playbook's own change rule |
| CH-027 | 2026-08-15 | Engineering: the pre-submission verify failed in `seedIntake`, a fixture that fetched over HTTP an id the token already carried | None (test infrastructure) | Fixtures in `consultations`, `matching`, `nalopay-http`, and `subscriptions` read the owner from the token with `verifyToken`; tests genuinely about `/users/me` keep calling it. The two runs after that failed differently again — an assertion that read a body without checking its status, then a fixture that took `res.body.token` on trust — so those assertions check the status first and the six registration fixtures go through `tokenFrom`, which throws naming the response that failed | The same class of fault as CH-025, found in three more places that change did not reach: setup that trusts a response it did not check. The full gate ran green afterwards — 164 unit, 220 integration, both typechecks, lint, audit. That is one clean gate, not proof of stability. TD-033 stays open: two occurrences are still unexplained, and the third is now only diagnosable rather than fixed |
| CH-028 | 2026-08-15 | Engineering: the corrections made under CH-026 were themselves checked against the code rather than accepted, on the principle that an audit is only worth what its own verification is worth | None (documentation) | Every endpoint, access rule, enum, entity field, file path, test-case ID, and inter-document link cited in the four corrected chapters was resolved against the source. Six were wrong: `POST /admin/lawyers/:id/subscription` was documented as `PATCH`; NFR-004 traced to a `MatchesPage.tsx` that does not exist; two intake endpoints were shown as owner-only when an admin may also read them; the SRS pointed at `11-references.md`, since renumbered; the deployment checklist still said 32 debt items; and TD-008 still quoted the 2026-08-13 coverage run | The audit's own output contained an invented file path, which is the failure mode the project's rules exist to prevent, and it is recorded here rather than quietly fixed. Two further gaps surfaced that predate the audit and are now stated in place: this change log has never had a CH-001 to CH-017, and FR-017 was accepted without a change entry at all |

## Scope safety rule

When uncertain, choose the smallest system that demonstrates meaningful requirements
engineering, a real use case, persistent data, business logic, validation, authentication
and authorization, testing, deployment, debt awareness, and maintenance planning.

## Status report format

```
## Current Phase
Planning / Design / Implementation / Testing / Deployment / Documentation

## Completed
## In Progress
## Blockers
## Remaining Must Requirements
## Test Status
## Technical Debt
## Deployment Status
## Time/Scope Risk        Low / Medium / High
## Next Highest-Priority Action
```

## Feature status format

```
Feature:
Requirement ID:
Priority:
Estimate:
Status:
Acceptance Criteria:
Implementation:
Tests:
Known Defects:
Technical Debt:
Documentation:
Deployment Verified:  Yes / No
```

## Repository practice

Commit continuously using `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:` with a
scope — `feat(auth): add admin login`, `test(auth): cover invalid password case`,
`fix(users): reject duplicate email`, `docs(srs): add requirement traceability`.

Never generate fake commit history and never rewrite history to make work appear older or
more extensive.

The root `README.md` should carry the project title, problem summary, features, technology
stack, setup, environment configuration, run commands, test commands, deployment link,
demo credentials if safe and intended, and repository structure.

## Success criteria

The project succeeds when it demonstrates disciplined software engineering under a
realistic time constraint — not by feature count. It needs credible evidence of
requirements engineering, estimation, analysis, design, implementation, quality assurance,
debt management, deployment, documentation, maintenance thinking, and evolution planning.
