# Software effort estimation

Status: estimated 2026-08-12, before implementation. Actuals to be recorded per phase as
work completes.

## Technique selected

**Story points with a person-hour mapping, calibrated by structured expert estimation.**

Chosen over the alternatives for defensible reasons:

- **Function Point Analysis** and **Use Case Points** require counting and weighting
  transactions and data functions. The counting overhead is disproportionate for a
  15-requirement application, and the effort spent counting is effort not spent building.
- **COCOMO / COCOMO II** calibrates on lines of code or scale factors drawn from
  multi-month industrial projects. Its coefficients are not meaningful at a 48-hour,
  one-person scale and would produce a confidently wrong number.
- **Story points with expert calibration** is transparent, quick, and directly defensible
  in a viva: each estimate can be traced to a named comparable task.

The single estimator is the student, so this is expert estimation with a documented scale
rather than consensus estimation such as Planning Poker, which needs multiple estimators.

## Scale

| Points | Meaning | Approximate person-hours |
| --- | --- | --- |
| 1 | Trivial — configuration or a single simple endpoint | 0.5–1 |
| 2 | Small — a simple CRUD slice with validation | 1.5–2 |
| 3 | Moderate — a full vertical slice including UI and tests | 2.5–3.5 |
| 5 | Complex — multiple modules, or external dependency | 4–5 |
| 8 | High risk — nondeterministic or unfamiliar; decompose if possible | 6+ |

Points express complexity and risk, not time. The person-hour column is an approximate
mapping for capacity planning only and should not be read as a precise conversion.

## Assumptions

1. The estimator is familiar with React, Express, TypeScript, and Prisma; unfamiliarity
   would invalidate these numbers.
2. Estimates are for **vertical slices** — each includes backend, frontend, validation,
   error handling, and its own tests unless a separate testing line says otherwise.
3. PostgreSQL runs locally in Docker, so no database installation time is budgeted.
4. One LLM provider with a working API key, reachable from the development machine.
5. Documentation is written continuously, not reconstructed at the end.
6. No requirement changes after confirmation. Changes trigger re-estimation via
   `docs/09-process-playbook.md`.

## Estimate

| ID | Phase / slice | Requirements | Points | Person-hours | Priority | Depends on |
| --- | --- | --- | --- | --- | --- | --- |
| E-00 | Planning, requirements, design, estimation | — | — | 4.0 | Must | — |
| E-01 | Project setup, Docker Postgres, Prisma schema, config, env validation | CON-002 | 3 | 2.5 | Must | — |
| E-02 | Authentication and authorization | FR-001, FR-002, NFR-001 | 5 | 4.0 | Must | E-01 |
| E-03 | User profile | FR-003 | 2 | 1.5 | Must | E-02 |
| E-04 | Legal categories | FR-005 | 2 | 1.5 | Must | E-01 |
| E-05 | Lawyer profiles and practice areas | FR-004 | 3 | 3.0 | Must | E-02, E-04 |
| E-06 | Legal issue submission, no AI | FR-006 | 3 | 2.5 | Must | E-02 |
| E-07 | AI provider adapter and prompts | FR-007, NFR-005 | 5 | 3.0 | Must | E-06 |
| E-08 | AI classification, summary, schema validation, fallback | FR-007–FR-010, NFR-003 | 8 | 4.0 | Must | E-07 |
| E-09 | Deterministic lawyer matching | FR-011, NFR-007 | 3 | 2.5 | Must | E-05, E-08 |
| E-10 | Lawyer discovery and profile views | FR-012 | 3 | 2.5 | Must | E-05 |
| E-11 | Consultation requests | FR-013, FR-014 | 5 | 3.5 | Must | E-09 |
| E-12 | Admin functionality | FR-015 | 3 | 3.0 | Must | E-05 |
| E-13 | Test pass: auth, authorization, AI, matching | All | 5 | 4.5 | Must | E-11, E-12 |
| E-14 | Deployment and live verification | CON-002, NFR-008 | 5 | 3.5 | Must | E-13 |
| E-15 | Documentation consolidation and submission package | — | 3 | 3.0 | Must | E-14 |
| | **Total** | | **58** | **44.5** | | |

## Capacity check

| | Hours |
| --- | --- |
| Available | 48.0 |
| Estimated | 44.5 |
| Contingency | 3.5 (7%) |

7% contingency is thin for a project with an external service dependency. This is a
recognised schedule risk rather than a comfortable plan.

## How estimation changed scope

Estimation was not decorative — it removed work:

1. **E-08 came out at 8 points**, the "decompose or reconsider" threshold. It was split
   into E-07 (adapter and prompts) and E-08 (validation and fallback) so that a working
   non-AI intake path exists before AI is attached, protecting the deliverable if the
   provider proves difficult.
2. **Lawyer response notes, notifications, bookmarks, and ratings were dropped** to
   Should/Could. Adding them was estimated at roughly 6 hours, which would have consumed
   the contingency and part of the testing budget for features worth no marks.
3. **Test coverage was scoped down** to auth, authorization, AI validation and fallback,
   and matching, rather than broad coverage. E-13 at 4.5 hours buys depth on high-risk
   logic; broad coverage was estimated near 12 hours and rejected.
4. **A separate lawyer registration flow was cut.** Lawyer accounts are created by an
   admin, which removes a whole self-service verification slice worth about 3 hours.

## Risk

| Risk | Likelihood | Impact | Response |
| --- | --- | --- | --- |
| AI provider latency, rate limits, or outage | Medium | High | Build intake without AI first (E-06 before E-07); mandatory fallback path in E-08 |
| Deployment problems late in the schedule | Medium | High | Deploy a skeleton early rather than only at E-14 |
| Contingency at only 7% | High | Medium | Could-features already cut; drop E-12 admin UI to API-only if time is lost |
| Model returns unusable or out-of-list categories | Medium | Medium | Whitelist enforcement plus human-review path, tested by AI-TC-008 |

## Actuals

Recorded as each phase completes. Do not fill in ahead of the work.

| ID | Estimated hours | Actual hours | Variance | Note |
| --- | --- | --- | --- | --- |
| E-00 | 4.0 | | | Requirements, estimation, and design confirmed 2026-08-12 |
| E-01 | 2.5 | | | Complete and verified — migration applied, seed run, health `200`. Overran on environment trouble: the Docker daemon was down, and DEF-001 required a fix and re-seed |
| E-02 | 4.0 | | | Complete — registration, login, JWT sessions, role guard, own-profile CRUD, 25 passing tests |
| E-03 | 1.5 | | | Complete — folded into E-02 as planned (FR-003 own-profile read/update) |
