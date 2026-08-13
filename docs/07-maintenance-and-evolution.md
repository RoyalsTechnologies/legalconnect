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

Document limitations honestly rather than disguising them. Expected sources for this
project:

- 48-hour development duration
- Limited test-data availability
- External AI service limits and nondeterminism
- Hosting infrastructure constraints
- Simplified UX
- Reduced feature scope
- Limited performance testing
- Security hardening not completed

Where AI requests leave the application boundary, document that data-processing
consideration in the security and limitations discussion.

*Actual limitations to be recorded as they arise.*
