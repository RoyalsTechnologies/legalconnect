# Viva and demonstration preparation

Keep the implementation understandable, avoid unexplained copied code, record key
decisions as they are made, and prefer solutions that can be defended. Claiming that
generated code is understood without having reviewed it is explicitly forbidden.

## General lifecycle questions

- Why this problem?
- Who are the stakeholders?
- Why is this requirement a Must?
- Why this estimation technique, and how did estimation affect scope?
- Why this architecture and this technology stack?
- How does authentication work? How is authorization enforced?
- What tests were executed, and what failed?
- What technical debt exists, and which item is most critical?
- What would you improve next?
- How is the system deployed? How would it scale?
- What maintenance will be needed?

## Project-specific questions

- Why is this an access problem rather than simply a shortage-of-lawyers problem?
- Why use AI for triage rather than letting users pick a category themselves?
- Why should AI not provide definitive legal advice?
- What happens if the AI classifies an issue incorrectly?
- How do you validate model output?
- Why is lawyer matching implemented deterministically rather than by the model?
- How is user privacy protected, and what data is sent to the AI provider?
- What happens when the AI provider is down?
- How did AI uncertainty affect your architecture?
- How did effort estimation change the project scope?
- What AI-related technical debt remains?
- How would you evaluate classification quality with more time?
- How would the system evolve into a production legal-services platform?

## Evidence to have ready

Commit history · test output · screenshots of the real application · deployed URL ·
database schema · diagrams · API examples · defect records · technical debt register ·
requirements traceability matrix.

Do not manufacture any of it.
