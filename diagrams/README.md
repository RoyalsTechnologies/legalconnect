# Design diagrams

Source for the four required artefacts in `docs/03-architecture.md`, plus a system context
diagram and the optional consultation lifecycle. They describe the system **as built** (including FR-016…021).

Read them in GitHub or a Mermaid preview. To regenerate the SVG and PNG in `exports/`, which
are what the submission PDF embeds:

```bash
npm run docs:diagrams
```

That renders every `.mmd` here through the Chromium the E2E suite already installs, so no
second browser or global CLI is needed. `exports/` is generated — edit the `.mmd` source,
never the output.

| File | Type | Purpose |
| --- | --- | --- |
| [00-system-context.mmd](00-system-context.mmd) | Context | Actors, system boundary, and external services |
| [01-use-cases.mmd](01-use-cases.mmd) | Use cases | Citizen, lawyer, admin, and visitor goals |
| [02-architecture.mmd](02-architecture.mmd) | Architecture | Client, API, PostgreSQL, LLM, NaloPay |
| [03-er-model.mmd](03-er-model.mmd) | ER | Persisted entities and relationships |
| [04-intake-sequence.mmd](04-intake-sequence.mmd) | Sequence | AI-assisted intake including fallback |
| [05-consultation-lifecycle.mmd](05-consultation-lifecycle.mmd) | Activity | Booking, hold, confirm, refund (optional) |
