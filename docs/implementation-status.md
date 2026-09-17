# Implementation and verification status

This register separates code delivery, observed browser behavior, public research, and production-readiness requirements. A source file is not a passed test. A passing interface test is not evidence that the financial engine is correct.

## Delivery scope

| Area | Delivered scope | Verification boundary |
| --- | --- | --- |
| Frontend | Next.js workspace with overview, borrower review, saved-plan comparisons and ledgers, unevaluated scenario preparation, evidence, and local decision drafts | Browser and frontend-only checks |
| Visual documentation | Desktop and mobile screenshots of the implemented prototype | Captured from the real UI |
| Calculation source | Preserved v1 engine; new v2 checked BigInt ledger, baseline schedules, required and diagnostic replay, and payable-essential treatment | Deliberately not executed, compiled, or tested |
| Backend source | Strict schemas, bearer-session tenant authorization, v1 and v2 routes, PostgreSQL persistence, outbox/worker, and optional CP-SAT source | Deliberately not executed, compiled, or tested |
| Public-data research | Reproducible aggregate extraction, monthly diary analysis, and research experiments | Recorded separately in the research report |
| Production deployment | Architecture and acceptance criteria | Not established |
| Real borrower outcomes | None claimed | No active pilot or treatment evidence |

See [frontend experiments](frontend-experiments.md) for browser coverage and [research experiments](research-experiments.md) for exact analysis results. The original [implementation guide](../output/DOMINO-Implementation-Guide.md) is the specification behind this delivery; its acceptance gates are not automatically complete when related source is present.

## Verification record

| Check | Recorded result |
| --- | --- |
| Strict frontend TypeScript | Passed using the frontend-only configuration |
| Isolated static prototype build | Passed; server routes and backend modules excluded |
| Chromium browser experiments | 48 passed, 0 failed, 0 skipped against the static prototype |
| Firefox browser experiments | 48 passed, 0 failed, 0 skipped against the final static prototype |
| WebKit browser experiments | 48 passed, 0 failed, 0 skipped against the final static prototype |
| Complete frontend matrix | 144 passed, 0 failed, 0 skipped, 0 retries; all 144 API and browser-error audits passed |
| Real UI screenshots | Eight captured screens: overview, borrowers, borrower detail, comparison, scenarios, decisions, evidence, and mobile |
| Dependency audit | 0 reported vulnerabilities at the recorded audit time |
| Public research, complete local inputs | 9 passed, 0 skipped |
| Public research, published-only mode | 1 passed, 8 explicitly skipped source-dependent experiments |
| Backend execution, compilation, tests, and benchmarks | Not run, as requested |

The browser suite blocks API requests and separately requires zero attempts, uncaught errors, and console errors. The [frontend experiment report](frontend-experiments.md) records browser-specific completion and the machine summary location. Passing browser checks establish the tested demonstration behavior only. They do not establish backend correctness or production security.

## Guide-to-delivery map

| Guide area | Delivery treatment | Remaining acceptance gate |
| --- | --- | --- |
| Polished loan-officer workspace | Implemented browser prototype using fixtures | Connect a separately validated authorized backend |
| Explainable four-plan comparison | Visible demonstration comparison and review flow | Verify arithmetic, API parity, and scenario eligibility |
| Engine extraction | Domain source organized separately from the interface | Run accounting and regression checks in a later authorized task |
| Source registry | Public evidence and fixture provenance exposed in the UI and documentation | Add consented borrower sources with operational lineage |
| Immutable evaluations | Represented in backend design and implementation | Verify snapshots, persistence, hashes, and replay |
| Asynchronous jobs | Backend implementation handoff where present | Verify transaction/outbox boundaries, retry recovery, and resource limits |
| Data normalization | Source-specific public research scripts | Operational imports need deduplication, reconciliation, and consent |
| Essential arrears | Explicit accounting requirement and source implementation where present | Verify payable bills versus non-recoverable unmet consumption |
| Robust optimization | Detailed formulation and optional bounded CP-SAT source | Independent replay, integer bounds, enumeration checks, and honest solver status |
| Approval workflow | Local decision draft and export in the frontend | Role checks, consent, stale-version rejection, and atomic servicing integration |
| Monitoring | Documented operational design | Deploy and verify metrics, recovery, backups, and alerts |
| Impact evidence | No impact claimed | Permissioned pilot with defined outcomes, denominator, follow-up, and comparison design |

## Experiment boundary

The request to run experiments is fulfilled within the frontend and public-data scope. Backend-related experiments are explicitly excluded by the same request. That includes financial-engine regression execution, API calls, worker tests, database tests, solver tests, and throughput benchmarks.

The research report distinguishes analyses executed against local original files from analyses a public checkout can reproduce using published aggregate artifacts. Missing original inputs must produce a clear skip or missing-input report. A historical committed result is not a newly executed experiment.

## Acceptance gates before a live lender deployment

### Accounting

- Confirm every cash, principal, interest, and payable-essential identity with hand-calculated fixtures.
- Preserve opening arrears exactly once and disclose every unpaid terminal balance.
- Verify same-day ordering, maturity accrual, integer bounds, rounding, and actual contract conventions.

### Evidence

- Reconcile observed cash and transaction histories.
- Keep missing values, imputations, forecasts, and source records distinguishable.
- Prevent public aggregates and monthly research data from entering weekly borrower-observation fields silently.

### Decisions

- Separate feasibility, recommendation, solver status, and data-quality status.
- Validate all required scenarios independently.
- Recheck authorization, consent, and the loan version before approval and activation.

### Reliability

- Verify tenant isolation with the actual runtime database role.
- Verify idempotency conflicts, repeat submissions, worker crashes, and duplicate delivery.
- Establish backups, restore behavior, retention/deletion, and production observability.

### Outcomes

- Agree the pilot's primary metric, population, time period, and comparison method.
- Track interest cost and adverse outcomes alongside review efficiency.
- Keep modeled improvements distinct from observed borrower benefits.
