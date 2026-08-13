# Examination brief

CSCD602 Advanced Software Engineering — 48-hour individual project examination.

The purpose is to demonstrate disciplined software engineering practice across a complete
lifecycle, not merely rapid feature generation. A polished five-feature system beats an
unfinished twenty-feature system.

## Hard constraints

- 48 hours, individual work.
- The application must be functional — not a proposal, requirements document, mock-up,
  static site, or non-functional prototype.
- Major prioritised requirements must be implemented.
- The application must be deployed and accessible online.
- Source code must be maintained in a repository.
- External libraries, frameworks, APIs, datasets, and third-party components must be
  acknowledged.
- The student must be able to explain requirements, effort estimation, architecture,
  implementation decisions, testing strategy, and technical debt.

## Lifecycle to demonstrate

Requirements → Effort Estimation → Analysis → Design → Implementation → Testing →
Technical Debt Management → Deployment → Documentation → Maintenance → Future Evolution.

Optimise for correctness, traceability, limited scope, testability, deployability,
maintainability, demonstrable engineering discipline, and viva readiness — in that spirit,
never for "working code" alone.

## Phases

Hour targets are guidance. If the project needs adaptation, preserve the sequence and keep
every lifecycle area covered.

**Phase 1 — Planning and requirements (hours 1–6).** Title, problem statement, users,
stakeholders, aim, objectives, functional and non-functional requirements, priorities,
acceptance criteria, effort estimate, assumptions, constraints, in-scope and out-of-scope
features, 48-hour MVP definition. Do not begin major implementation until these are
sufficiently defined.

**Phase 2 — Analysis and design (hours 7–12).** System context, use cases, architecture,
data model, API design, selected diagrams, technology stack with justification, security
considerations, initial debt register, implementation plan.

**Phase 3 — Implementation (hours 13–32).** Core prioritised features, database, backend,
frontend, auth, validation, error handling, integrations, continuous tests, notes.

**Phase 4 — Testing and refinement (hours 33–38).** Executed test cases, defects,
corrections, unit/integration/system tests, UAT evidence, usability and security review,
updated debt, targeted refactoring.

**Phase 5 — Deployment (hours 39–42).** Deployed application, live URL, admin URL, test
credentials, working production database and API connections, repository URL, verification.

**Phase 6 — Documentation and submission (hours 43–48).** Complete documentation, SRS,
testing report, technical debt plan, user manual, deployment and source links, maintenance
strategy, future evolution plan, limitations, references, verified package.

## Mark weighting

Use this to avoid spending all available time on implementation.

| Area | Marks |
| --- | --- |
| Requirements Engineering & SRS | 7 |
| Software Effort Estimation | 5 |
| System Analysis & Design | 6 |
| Implementation & Functionality | 10 |
| Testing & Quality Assurance | 5 |
| Technical Debt Identification & Management | 6 |
| Deployment & Accessibility | 3 |
| Documentation & User Manual | 3 |
| Maintenance & Future Evolution | 3 |

Implementation is 10 of 48 marks. Estimation, testing, technical debt, deployment, and
lifecycle documentation together are worth far more — never sacrifice them to add another
optional feature.

## SRS structure

1. Introduction — purpose, scope, definitions, references
2. Overall description — product perspective, user classes, operating environment,
   assumptions, constraints
3. Functional requirements with acceptance criteria
4. Non-functional requirements
5. External interface requirements — UI, APIs, external systems
6. Data requirements
7. Security requirements
8. Requirement priorities
9. Traceability

SRS requirements must match implemented functionality.

## Consolidated documentation contents

Project title · problem statement · aim and objectives · stakeholders · requirements
analysis · SRS · effort estimation · system analysis · system design · implementation ·
testing · technical debt · deployment · user manual · maintenance strategy · future
evolution · limitations · conclusion · references.

## Testing report structure

Test strategy · test environment · test types · test cases · test results · defects
identified · corrective actions · retesting · remaining known issues · testing limitations
· conclusion. Include expected versus actual results.

## Submission package

```
StudentID_ProjectName/
├── Project_Documentation.pdf
├── SRS.pdf
├── Testing_Report.pdf
├── Technical_Debt_Plan.pdf
├── User_Manual.pdf
├── Deployment_and_Source_Links.txt
└── Supporting_Files/
```

These may be combined into one comprehensive PDF if all required sections are clearly
identified.

## Final submission check

- [ ] Realistic problem defined
- [ ] Stakeholders and users identified
- [ ] Requirements analysis completed
- [ ] SRS completed
- [ ] Effort estimated, technique justified
- [ ] System designed
- [ ] Major prioritised requirements implemented
- [ ] Functional application works
- [ ] Tests executed and results documented
- [ ] Technical debt identified with resolution strategies
- [ ] Application deployed and live deployment tested
- [ ] User manual prepared
- [ ] Maintenance strategy prepared
- [ ] Future evolution plan prepared
- [ ] Repository accessible
- [ ] URLs and credentials verified
- [ ] Name, student ID, project title included
- [ ] Third-party resources acknowledged
- [ ] Submission package complete

## Forbidden

Skipping requirements and coding blindly · shipping only static pages or a mock-up ·
presenting non-functional placeholders as implemented · fabricating tests, UAT,
deployment, debt, or references · exposing secrets · ignoring broken Must requirements ·
unjustified complexity · expanding scope without updating estimates · client-side
authorization as the only protection · claiming production readiness without live
verification · hiding major known defects · claiming generated code is understood without
reviewing it.

## References and acknowledgements

Record frameworks, libraries, APIs, datasets, tutorials materially used, documentation
sources, and third-party services, in a consistent citation style. Never invent a
reference. Never copy external source code without attribution where attribution is
required.
