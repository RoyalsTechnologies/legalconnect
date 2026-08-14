# Design diagrams

Source for the four required artefacts in `docs/03-architecture.md`, plus the optional
consultation lifecycle. They describe the system **as built** (including FR-016…021).

Render the `.mmd` files in GitHub, VS Code (Mermaid preview), or:

```bash
npx --yes @mermaid-js/mermaid-cli -i diagrams/01-use-cases.mmd -o diagrams/01-use-cases.svg
```

| File | Type | Purpose |
| --- | --- | --- |
| [01-use-cases.mmd](01-use-cases.mmd) | Use cases | Citizen, lawyer, admin, and visitor goals |
| [02-architecture.mmd](02-architecture.mmd) | Architecture | Client, API, PostgreSQL, LLM, NaloPay |
| [03-er-model.mmd](03-er-model.mmd) | ER | Persisted entities and relationships |
| [04-intake-sequence.mmd](04-intake-sequence.mmd) | Sequence | AI-assisted intake including fallback |
| [05-consultation-lifecycle.mmd](05-consultation-lifecycle.mmd) | Activity | Booking, hold, confirm, refund (optional) |
