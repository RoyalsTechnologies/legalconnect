# Software effort estimation

Status: baseline estimated 2026-08-12, before implementation. Scope added during the build
(CH-018…CH-021, FR-016…FR-021) re-estimated 2026-08-15. Actuals recorded 2026-08-15 from
commit and document evidence — hands-on hours were **not** stopwatch-tracked, and the
Actuals section says so rather than presenting invented figures.

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

## Constraints on the estimate

The full project constraints are CON-001…CON-005 in `docs/01-requirements.md`. The ones that
bind this estimate:

- **CON-001, 48 hours and individual work.** One person, so no parallelism: person-hours and
  elapsed working duration are the same number. There is no option to trade cost for time.
- **CON-002, the application must be deployed and publicly reachable.** Deployment is a
  budgeted slice (E-14), not an afterthought, and it cannot be dropped to recover time.
- **CON-004, one external LLM provider on a free or low tier.** Rate limits and latency are
  outside the estimator's control, which is why E-08 carries the highest complexity band.
- **Single estimator.** No consensus technique is available, so the estimate carries the
  bias of one person's judgement with no second opinion to correct it.
- **Marks, not features, are the objective.** Implementation is 10 of 48 marks, so effort
  had to be reserved for estimation, testing, debt, deployment, and documentation even where
  more features were technically achievable.

## Estimate

Columns carry the fields the estimation technique requires: identifier, slice, the
requirements it satisfies (traceability), complexity band from the scale above, points,
mapped person-hours, MoSCoW priority, and dependency. Per-slice notes are not duplicated
here — they live in the Actuals and Variance sections so there is one place to maintain.

| ID | Phase / slice | Requirements | Complexity | Points | Person-hours | Priority | Depends on |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-00 | Planning, requirements, design, estimation | — | — | — | 4.0 | Must | — |
| E-01 | Project setup, Docker Postgres, Prisma schema, config, env validation | CON-002 | Moderate | 3 | 2.5 | Must | — |
| E-02 | Authentication and authorization | FR-001, FR-002, NFR-001 | Complex | 5 | 4.0 | Must | E-01 |
| E-03 | User profile | FR-003 | Small | 2 | 1.5 | Must | E-02 |
| E-04 | Legal categories | FR-005 | Small | 2 | 1.5 | Must | E-01 |
| E-05 | Lawyer profiles and practice areas | FR-004 | Moderate | 3 | 3.0 | Must | E-02, E-04 |
| E-06 | Legal issue submission, no AI | FR-006 | Moderate | 3 | 2.5 | Must | E-02 |
| E-07 | AI provider adapter and prompts | FR-007, NFR-005 | Complex | 5 | 3.0 | Must | E-06 |
| E-08 | AI classification, summary, schema validation, fallback | FR-007–FR-010, NFR-003 | High risk | 8 | 4.0 | Must | E-07 |
| E-09 | Deterministic lawyer matching | FR-011, NFR-007 | Moderate | 3 | 2.5 | Must | E-05, E-08 |
| E-10 | Lawyer discovery and profile views | FR-012 | Moderate | 3 | 2.5 | Must | E-05 |
| E-11 | Consultation requests | FR-013, FR-014 | Complex | 5 | 3.5 | Must | E-09 |
| E-12 | Admin functionality | FR-015 | Moderate | 3 | 3.0 | Must | E-05 |
| E-13 | Test pass: auth, authorization, AI, matching | All | Complex | 5 | 4.5 | Must | E-11, E-12 |
| E-14 | Deployment and live verification | CON-002, NFR-008 | Complex | 5 | 3.5 | Must | E-13 |
| E-15 | Documentation consolidation and submission package | — | Moderate | 3 | 3.0 | Must | E-14 |
| | **Total** | | | **58** | **48.5** | | |

**Correction, 2026-08-15.** This total previously read 44.5 hours. The rows sum to 48.5;
the earlier figure was the sum of E-01…E-15 with E-00's four hours of planning omitted even
though E-00 is listed as a row. The consequence is not cosmetic — see the capacity check
below, which is corrected with it.

## Capacity check (baseline)

| | Hours |
| --- | --- |
| Available (CON-001) | 48.0 |
| Estimated | 48.5 |
| Contingency | −0.5 (none) |

Corrected 2026-08-15. The original read "Estimated 44.5, contingency 3.5 (7%)" and called
7% "thin for a project with an external service dependency". The arithmetic was worse than
that: with planning counted, the baseline plan was already half an hour over the 48-hour
budget with no contingency at all, before a single change request arrived. The recorded
judgement — that this was a schedule risk rather than a comfortable plan — was right, but it
understated the risk it was describing.

## Estimated duration

One estimator with no parallel work means effort and elapsed working duration are the same
quantity: 48.5 person-hours of estimated effort is 48.5 hours of working duration, against a
48-hour window. The baseline did not schedule each slice to a clock time; it sequenced them
by dependency and assigned them to the examination phases, whose hour targets come from
`docs/00-exam-brief.md`. The mapping below sums the rows above — it introduces no new
estimate — and sets the planned duration beside the window in which the work is evidenced to
have happened.

| Examination phase | Brief hour target | Slices | Planned hours | Evidenced window |
| --- | --- | --- | --- | --- |
| 1–2 Planning, requirements, analysis, design | 1–12 | E-00, E-01 | 6.5 | 2026-08-12 (predates the repository) |
| 3 Implementation | 13–32 | E-02…E-12 | 31.0 | 2026-08-13 08:17 → 15:05, plus added scope E-16…E-22 |
| 4 Testing and refinement | 33–38 | E-13 | 4.5 | 2026-08-13 14:59 (CI), 2026-08-14 16:03 (E2E), 2026-08-15 07:22 (UAT run 2) |
| 5 Deployment | 39–42 | E-14 | 3.5 | 2026-08-14 16:20 → 2026-08-15 07:20 |
| 6 Documentation and submission | 43–48 | E-15 | 3.0 | Continuous; package generated, identity and live credentials outstanding |
| | | | **48.5** | |

Two things are visible here that the hour totals alone do not show. Phase 5 overran its
four-hour slot into roughly 15 hours of calendar time and ran concurrently with phase 6
rather than before it. And phase 4 did not happen once: testing work is spread across all
three days, with UAT only completed on the final morning.

## Re-estimation of scope added after the baseline

Assumption 6 above says requirement changes trigger re-estimation. Four accepted change
requests (CH-018…CH-021 in `docs/09-process-playbook.md`) and requirements FR-016…FR-021
arrived after the baseline, together with engineering work no baseline line covered. That
re-estimation was not done at the time; it is recorded here, dated 2026-08-15, using the
same scale. These are estimates of the added scope, not measurements of it.

| ID | Slice | Requirements | Complexity | Points | Mapped hours | Priority | Depends on / origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-16 | Lawyer self-registration with admin-gated visibility | FR-016 | Moderate | 3 | 3.0 | Should | E-05; reverses the baseline cut recorded below |
| E-17 | NaloPay collection adapter, pay endpoint, signed callback, status verify | FR-017 | High risk | 8 | 6.0 | Should | E-11; product owner |
| E-18 | Subscription plans, area caps, directory eligibility | FR-018 | Complex | 5 | 4.5 | Should | E-17; CH-018, CH-019 |
| E-19 | Booking slot, Calendar template URL, Meet link on accept | FR-019 | Moderate | 3 | 3.0 | Should | E-11; product owner |
| E-20 | Lawyer mobile-money payment account | FR-020 | Small | 2 | 1.75 | Should | E-05; CH-020 |
| E-21 | Fee escrow, dual confirmation, wallet ledger, refunds, withdrawals | FR-021 | High risk | 8 | 6.0 | Should | E-17, E-20; CH-021 |
| E-22 | Email verification, password reset, consultation notifications, optional SMS | TD-010, TD-020 | Moderate | 3 | 3.0 | Should | E-02, E-11; debt repayment |
| E-23 | Operational logging and session expiry | NFR-001, NFR-002 | Moderate | 3 | 3.0 | Should | E-02; quality pass |
| E-24 | Coverage measurement, enforced thresholds, GitHub Actions CI | NFR-001 | Moderate | 3 | 3.0 | Should | E-13; quality pass |
| E-25 | Playwright frontend E2E with a mocked API | — | Moderate | 3 | 3.0 | Could | E-13; quality pass |
| E-26 | Vercel deployment hardening beyond the E-14 line | CON-002, NFR-008 | Complex | 5 | 4.5 | Must | E-14; deployment reality |
| E-27 | UAT run 2 and evidence capture | NFR-004 | Small | 2 | 1.75 | Should | E-17, E-12; UAT-003…005 unresolved |
| | **Added total** | | | **48** | **42.5** | | |

Revised against the budget:

| | Points | Hours |
| --- | --- | --- |
| Baseline (E-00…E-15) | 58 | 48.5 |
| Added (E-16…E-27) | 48 | 42.5 |
| **Total scale-mapped effort** | **106** | **91.0** |
| Budget (CON-001) | | 48.0 |

Scale-mapped effort is 91 hours against a 48-hour budget — the delivered system is close to
twice the size of the one that was planned to fit, and the plan it grew out of had no
contingency to absorb any of it. That is the single most important number in this document.

## How estimation changed scope

Estimation was not decorative — it removed work:

1. **E-08 came out at 8 points**, the "decompose or reconsider" threshold. It was split
   into E-07 (adapter and prompts) and E-08 (validation and fallback) so that a working
   non-AI intake path exists before AI is attached, protecting the deliverable if the
   provider proves difficult.
2. **Lawyer response notes, notifications, bookmarks, and ratings were dropped** to
   Should/Could. Adding them was estimated at roughly 6 hours, which would have consumed
   the contingency and part of the testing budget for features worth no marks. Notifications
   were later reinstated as E-22 when TD-010 and TD-020 were repaid; bookmarks, ratings, and
   response notes stayed out.
3. **Test coverage was scoped down** to auth, authorization, AI validation and fallback,
   and matching, rather than broad coverage. E-13 at 4.5 hours buys depth on high-risk
   logic; broad coverage was estimated near 12 hours and rejected.
4. **A separate lawyer registration flow was cut.** Lawyer accounts are created by an
   admin, which removes a whole self-service verification slice worth about 3 hours.
   This cut was later reversed: FR-016 reinstated self-registration as E-16, so the saving
   was returned. It is the clearest case of estimation shaping scope and then scope
   overruling estimation.

## Risk

| Risk | Likelihood | Impact | Response |
| --- | --- | --- | --- |
| AI provider latency, rate limits, or outage | Medium | High | Build intake without AI first (E-06 before E-07); mandatory fallback path in E-08 |
| Deployment problems late in the schedule | Medium | High | Deploy a skeleton early rather than only at E-14 |
| Contingency at only 7% | High | Medium | Could-features already cut; drop E-12 admin UI to API-only if time is lost |
| Model returns unusable or out-of-list categories | Medium | Medium | Whitelist enforcement plus human-review path, tested by AI-TC-008 |

Outcomes, recorded 2026-08-15:

| Risk | Materialised? | What happened |
| --- | --- | --- |
| AI provider latency or outage | Yes | UAT-001 run 1 returned after about 124 seconds on the fallback path with `aiStatus FAILED_FALLBACK`; run 2 classified in about 7 seconds. The planned response worked — no intake was lost and no 5xx was returned |
| Deployment problems late in the schedule | Yes, and the mitigation was not followed | "Deploy a skeleton early" was the agreed response; the first Vercel configuration landed on 2026-08-14 at 16:20, in the last third of the schedule, and cost eleven fix commits |
| Contingency at only 7% | Yes, and there was none | The 7% did not exist: counting E-00 the baseline was already 0.5 hours over budget, and added scope then re-estimated at 42.5 hours on top |
| Out-of-list categories | No | Whitelist enforcement held. The related defect (DEF-005) was in matching, not classification |

## Actuals

**What was measured, and what was not.** Per-slice hands-on hours were not tracked while
the work happened, and they cannot be reconstructed afterwards: the implementation reached
version control as one squashed commit (`369cc71`, 149 files, 28,271 insertions) covering
E-01 through E-13 at once. No timesheet was kept. Rather than back-fill plausible numbers,
this section records the two things that are genuinely evidenced — **when** work landed,
from commit timestamps, and **what** landed, from the commits and the dated records in the
other documents. Elapsed windows are an upper bound on effort, not a measure of it: the
history contains a 25-hour gap with no commits at all (2026-08-13 15:05 → 2026-08-14 16:03).

### Evidenced delivery windows

| Window | Evidence | Slices | What landed |
| --- | --- | --- | --- |
| 2026-08-12 | Dated design records in `01-requirements.md`, this document, `03-architecture.md`, `05-technical-debt-register.md`; Phase 1 manual checks in `04-testing.md` executed 2026-08-12; predates the repository | E-00, E-01 | Requirements, estimate, architecture, ADRs, schema, environment |
| 2026-08-13 08:17 → 15:05 | 12 commits, first `369cc71` | E-02…E-13, E-16…E-22 | The MVP as one commit, then client polish, dashboards and booking slots, wallet escrow (`617aba0`, 42 files), CI and coverage (`ec68ab1`, 50 files) |
| 2026-08-14 16:03 → 18:47 | 15 commits | E-23…E-25, E-14/E-26 | Operational logging, session expiry, Playwright E2E (`bef99c5`), then the first Vercel configuration and eight deployment fixes |
| 2026-08-15 03:54 → 07:20 | 6 commits, last `af00cc9` | E-14/E-26, E-15 | Remaining deployment fixes, live URL recorded and verified |
| 2026-08-15 07:22 → 07:46 | UAT run 2 records and screenshots in `04-testing.md`, `docs/uat-evidence/` | E-27 | UAT-003 re-run, UAT-004 and UAT-005 completed |

First commit to live-URL commit is 47 hours of elapsed calendar time, on top of the
2026-08-12 design day. The 48-hour budget was therefore consumed in calendar terms even
though the hands-on total inside it is unknown.

### Per-slice outcome

Hands-on hours are unmeasured for every row, for the reason given above.

| ID | Estimated hours | Status | Evidence |
| --- | --- | --- | --- |
| E-00 | 4.0 | Delivered | Requirements, estimation, and design confirmed 2026-08-12 |
| E-01 | 2.5 | Delivered | Migration applied, seed run, health `200`. Overran on environment trouble: the Docker daemon was down, and DEF-001 required a fix and re-seed |
| E-02 | 4.0 | Delivered | Registration, login, JWT sessions, role guard, own-profile CRUD; auth suites in `server/tests` |
| E-03 | 1.5 | Delivered | Folded into E-02 as planned (FR-003 own-profile read/update) |
| E-04 | 1.5 | Delivered | `modules/legal-categories`; admin category management (FR-005) |
| E-05 | 3.0 | Delivered | `modules/lawyers`, practice areas, approval status (FR-004) |
| E-06 | 2.5 | Delivered | `modules/legal-intake` stores original text without AI (FR-006) |
| E-07 | 3.0 | Delivered | `ai/ai-client.ts`, `ai/prompts.ts` behind one adapter (NFR-005) |
| E-08 | 4.0 | Delivered | Schema-validated triage with fallback; UAT-001 passed on the fallback path, and live classification observed in UAT run 2 |
| E-09 | 2.5 | Delivered | `modules/matching` with visible reasons; DEF-005 found and fixed here (MT-009) |
| E-10 | 2.5 | Delivered | Public directory and profile views; UAT-002 Pass |
| E-11 | 3.5 | Delivered | `modules/consultations`; UAT-004 Pass in run 2 |
| E-12 | 3.0 | Delivered | `modules/admin`; UAT-005 Pass in run 2 |
| E-13 | 4.5 | Delivered, exceeded | Grew past the targeted pass into a coverage gate and CI — see E-24 |
| E-14 | 3.5 | Delivered, badly exceeded | Eleven `deploy` commits over 2026-08-14 16:20 → 2026-08-15 05:27 — see the variance note |
| E-15 | 3.0 | Partially delivered | Documentation is current and the package builds with `npm run docs:submission` — a 95-page combined PDF plus `Deployment_and_Source_Links.txt`. Student name and ID are still placeholders, and the live test credentials depend on the hosted database being seeded |
| E-16…E-27 | 42.5 (re-estimated) | Delivered except as noted | Added scope, evidenced by the commits in the windows table; E-17 remains unverified for live capture at real fees (TD-031) |

## Variance analysis

What the estimate got right:

1. **The complexity ranking held.** E-08 (AI triage) was scored 8 — the decompose-or-
   reconsider threshold — and it is where the defects and debt actually clustered: DEF-005,
   TD-001, TD-011, TD-012, TD-013, TD-014. Splitting it into E-07 and E-08 so a working
   non-AI intake existed first is the decision that protected the deliverable.
2. **Vertical slices were the right unit.** No slice needed a separate integration phase.

What it got wrong:

1. **Deployment was the worst miss.** E-14 was 5 points and 3.5 hours for "deployment and
   live verification". Delivery took eleven `feat(deploy)`/`fix(deploy)` commits spread over
   roughly 13 hours of calendar time (2026-08-14 16:20 → 2026-08-15 05:27) and covered a
   Docker build failure, the Prisma schema location under
   `npm --prefix`, enforcing a hosted `DATABASE_URL`, Vercel's Express entrypoint
   detection, CJS/ESM interop for helmet, cors, bcrypt, jsonwebtoken and nodemailer,
   compiling the API before bundling, `includeFiles` globs, and finally serving the SPA
   from `client/dist`. None of that was visible from the estimate, because the estimate
   treated deployment as one task rather than as an integration with an opinionated host.
2. **Scope roughly doubled and was not re-estimated when it changed.** Assumption 6 said
   changes trigger re-estimation; CH-018…CH-021 were logged in the change register but no
   estimate was revised until 2026-08-15. The re-estimation section above closes that gap
   after the fact, which is later than the process requires.
3. **An estimation-driven cut was overturned.** Lawyer self-registration was cut to save
   about 3 hours and then reinstated as FR-016.
4. **The baseline total understated itself by four hours.** The rows summed to 48.5 hours
   while the total row read 44.5, because planning was listed but not counted. That single
   omission produced the 3.5-hour "contingency" the plan then relied on, so the plan looked
   feasible when the arithmetic said it was already over budget. Corrected above on
   2026-08-15, and worth stating plainly: the error flattered the plan rather than harming
   it, which is the direction estimation errors are least likely to be noticed in.
5. **Quality work outgrew its line.** E-13 planned a targeted 4.5-hour test pass; delivery
   added coverage measurement with enforced thresholds (95% statements, lines and
   functions, 88% branches), a CI workflow, and Playwright E2E (`ec68ab1`, 3,588
   insertions; `bef99c5`, 1,536 insertions).
6. **The person-hour mapping did not survive the delivery mode.** Points, as a measure of
   complexity and risk, stayed useful. The hours column was calibrated for hand-written
   code, and implementation was AI-assisted: 28,271 insertions across 149 files landed
   inside the first window. Any comparison of mapped hours against this delivery is
   therefore a comparison of two different things, which is why no per-slice actual is
   claimed here.

The honest summary: the technique ranked risk well and shaped scope twice, the hour mapping
was not a valid instrument for how the work was actually done, deployment was
under-estimated by a wide margin, and the estimate stopped being maintained once the
product owner started adding requirements.
