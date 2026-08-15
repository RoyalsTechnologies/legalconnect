# Conclusion

## What was set out to do

The starting position was a deliberate rejection of the obvious framing. Ghana does not lack
lawyers, so building a directory of them solves nothing on its own. The problem worth
solving is **access friction**: an ordinary person with a legal concern usually cannot name
the speciality they need, cannot phrase the issue in terms a professional can act on, and
does not know where to start. That framing set the aim — let someone describe a problem in
everyday language, use AI to make that description structured and legible, and connect them
to a suitable professional with a reason they can see.

## What was delivered

A functional, deployed web application covering the full flow: registration and
authentication with three server-enforced roles, plain-language intake, AI classification
and summary with schema validation, deterministic and explainable matching, a consultation
request lifecycle the lawyer acts on, paid booking with mobile money, lawyer subscription
plans, an escrow wallet with withdrawals, and administration of users, lawyers, and the
category taxonomy.

Twenty-one functional requirements were implemented — the fifteen Must items of the approved
MVP, plus six Should items added during the build, each re-estimated and recorded in the
change log before being accepted rather than absorbed silently. Every requirement traces
through the matrix in `01-requirements.md` to a design element, an implementation path, and
named test cases.

## What the engineering discipline produced

The measurable output beyond the application: 164 unit tests and 220 integration tests all
passing, six Playwright browser flows, 96.3% statement coverage of the server with
thresholds enforced in CI, eleven architecture decision records, a debt register of 31 items
with causes and repayment plans, twelve logged defects with fixes and retests, and a change
log of every scope change with its consequence.

Three habits mattered more than the rest. **Building the workflow before the AI** meant the
intake and consultation paths were working and tested before a provider was introduced, so
the AI became an enhancement to something functional rather than a dependency the project
could not survive — which is exactly why the fallback path is genuine rather than
theoretical. **Recording debt as it was taken on**, in the same commit as the trade-off,
produced a register that reflects real decisions instead of a document assembled at the end.
**Writing acceptance criteria as observable outcomes**, including expected status codes, made
the test cases fall out of the requirements rather than being invented to match whatever the
code happened to do.

## What the AI boundary decision cost and bought

Holding to "AI reduces access friction, it does not practise law" ruled out the features
that would have looked most impressive: outcome prediction, advice, document analysis. It
also produced the two design decisions the project is most confident defending. Matching is
deterministic application logic, so every recommendation carries a reason traceable to
configured criteria rather than to a model's assertion (NFR-007). And the model can request
human review but can never waive it, so AI output cannot decide its own trustworthiness.

## What is not finished

Stated plainly, because the alternative is worse. Four defects remain open, all Low: three
edge cases rather than broken Must paths, plus a cold-start latency finding that the
performance sample produced (DEF-013). No independent participant has run a usability
session, so NFR-004 rests on developer walkthroughs. Performance is sampled on the read paths
but not load-tested, and AI latency is deliberately uncharacterised.
Classification accuracy is unmeasured — the tests prove the contract, not the answers. No
end-to-end mobile money capture at a real consultation fee has been possible, because the
test merchant refuses amounts at that scale. There is no monitoring, no rate limiting, and
no token revocation. The full list is in the limitations section of
`07-maintenance-and-evolution.md`, and nothing in this repository claims otherwise.

## What would be done differently

Two things. The shared-schema test isolation problem (TD-009) cost two separate debugging
sessions because the symptoms — authorisation and validation failures — pointed convincingly
at the wrong layer; a per-run schema took twenty minutes to implement and should have been
the design from the first test. And deployment was treated as a late phase, which meant
environment-specific faults such as the localhost confirmation links (DEF-010) surfaced at
the point where time was scarcest; deploying a skeleton on day one would have found the
whole class of configuration problems earlier and cheaply.

## Closing

The project demonstrates a complete software engineering lifecycle rather than rapid feature
generation: requirements traced to tests, an estimate revisited when scope changed, an
architecture whose decisions are recorded with their alternatives, debt made visible instead
of hidden, and a deployed system whose limitations are documented as carefully as its
capabilities. The application works, and the record of how it was built is accurate — which
was the point.
