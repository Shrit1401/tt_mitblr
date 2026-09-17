# Backend implementation notes

**Delivery status:** source implementation only. At the user's request, this backend was not started, compiled, typechecked, tested, benchmarked, migrated, or connected to a database. No engine, worker, solver, or backend experiments ran. The frontend uses its own clearly marked presentation fixtures and does not call these routes.

The code below is an implementation to review and validate in a later authorized phase. Its presence does not establish working deployment, repayment safety, throughput, security certification, or production readiness.

## Components

| Location | Implemented source |
| --- | --- |
| `packages/engine/src/model.ts` | The original four-plan v1 calculation model, preserved with its original arithmetic |
| `packages/engine/src/data.ts` | Three synthetic, repeatable weekly borrower fixtures |
| `packages/engine/tests/model.test.ts` | Preserved original regression tests, deliberately unexecuted |
| `packages/engine/src/money.ts` | Bounded `bigint` money and positive half-up weekly interest rounding |
| `packages/engine/src/v2.ts` | Baseline schedule allocation, strict weekly history alignment, required/diagnostic scenarios, independent debt/cash replay, constraint checks, ranking |
| `packages/contracts/src/index.ts` | Strict Zod input contracts, decimal-string money, date validation, policy and immutable snapshot shapes |
| `packages/data/src/index.ts` | Canonical hashing, transaction normalization, duplicate reporting, cash reconciliation, explicit public research types |
| `packages/db/migrations/001_initial.sql` | Tenant records, membership/session tables, immutable snapshots, evaluation/result tables, outbox, imports, selections, approval evidence, audit history, RLS policies and runtime role |
| `packages/db/src/index.ts` | Lazy PostgreSQL pool and transaction-local tenant context |
| `apps/web/lib/server` | Bearer authorization, bounded body parsing, stable errors, quota/idempotency checks, snapshot submission, review and approval |
| `apps/web/app/api` | Authenticated Next.js Route Handlers for v1 compatibility and asynchronous v2 |
| `apps/worker/src` | Separate evaluation/import workers, transactional outbox publisher, retry limits, lease fencing, queue-intent recovery, bounded optimizer subprocess |
| `services/optimizer/solver.py` | Optional integer CP-SAT schedule search with two objective stages and a hard subprocess timeout |
| `infra/docker-compose.yml` | Optional local PostgreSQL and persistent Redis definitions |

## Contract versions and routes

Every endpoint requires `Authorization: Bearer <opaque-session-token>`. Tokens must be 43 to 200 URL-safe characters. Cookie authentication is intentionally unsupported. The browser demo is independent of this API.

Legacy v1 preserves numeric paise and the saved fixture contracts:

| Method | Route | Permission | Behavior |
| --- | --- | --- | --- |
| GET | `/api/borrowers` | read | Three synthetic fixture summaries |
| GET | `/api/borrowers/:id` | read | One synthetic fixture and weekly history |
| POST | `/api/borrowers/:id/evaluate` | evaluate | Synchronous original four-plan engine; validated scenario body |

V2 uses decimal integer strings for money and persistent tenant records:

| Method | Route | Permission | Behavior |
| --- | --- | --- | --- |
| GET | `/api/v2/borrowers?limit=25&cursor=...` | read | Keyset pagination by update time and ID |
| GET | `/api/v2/borrowers/:id?limit=25&offset=0` | read | Current loan snapshot plus paginated weekly history |
| POST | `/api/v2/borrowers/:id/evaluate` | evaluate | Atomic snapshot, evaluation and outbox creation; HTTP 202 |
| GET | `/api/v2/evaluations/:id` | read | State, progress stage, provenance and candidate summaries; no full ledgers |
| GET | `/api/v2/evaluations/:id/plans/:planId/ledger?scenarioId=baseline&limit=25&offset=0` | read | A paginated candidate/scenario ledger |
| POST | `/api/v2/evaluations/:id/selections` | select | Reviewed selection of a completed feasible candidate |
| POST | `/api/v2/selections/:id/approve` | approve | Separate-actor approval, consent, daily verification, version append and audit |
| POST | `/api/v2/imports` | import | Bounded JSON transaction import, not a file upload; HTTP 202 |
| GET | `/api/v2/imports/:id` | read | Import state and row report |
| GET | `/api/v2/sources/:id` | read | Provenance with private object keys and private URLs omitted |

`viewer` has read access. `reviewer` adds evaluate/import/select. `approver` and `admin` add approve. A reviewer cannot approve their own selection. All sensitive queries include tenant predicates and run with transaction-local `app.tenant_id`. SQL RLS supplies a second boundary.

Evaluation and import submissions require a unique `Idempotency-Key` containing 16 to 128 URL-safe characters. A repeat of the same canonical request returns the saved response. Reusing the key for a different request returns HTTP 409. Tenant advisory locks serialize those checks and enforce the persisted submission quota: 30 evaluations and 10 imports per minute. These are implementation defaults, not load-tested limits.

An evaluation example:

```json
{
  "loanVersion": 1,
  "policyVersionId": "policy_demo_1",
  "scenarioSetId": "required_v1",
  "requestedCandidates": ["fixed", "income_aligned", "seasonal", "reduced", "robust_optimized"],
  "assumptions": {
    "minimumBufferPaise": "150000",
    "incomeDelayWeeks": 2,
    "incomeReductionBps": 1500,
    "expenseIncreaseBps": 1000
  }
}
```

The saved policy cannot be weakened by requesting a lower buffer. `required_v1` always includes a baseline and a stress path with at least two weeks of delay, a 15% income reduction and a 10% essential-expense increase. A request can strengthen these settings. Total income loss is a separate diagnostic path. These three deterministic paths do not constitute calibrated risk probabilities.

Supported money amounts range from zero to 1,000,000,000,000 paise. Arithmetic that exceeds the supported domain fails instead of silently losing integer precision. Dates are calendar-validated ISO dates. The horizon is capped at 104 weeks, request candidates at five, imported records at 1,000, and history at 520 weeks. Unknown JSON fields are rejected. Request limits are 64 KiB normally and 1 MiB for imports.

Errors include `INVALID_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `BORROWER_NOT_FOUND`, `STALE_LOAN_VERSION`, `IDEMPOTENCY_CONFLICT`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `INSUFFICIENT_DATA`, `RATE_LIMITED`, `DAILY_REPLAY_REQUIRED`, and `TEMPORARILY_UNAVAILABLE`. Responses expose a request ID and safe messages, never stack traces or raw transaction payloads.

## Accounting and evidence

V1 is preserved for compatibility and keeps its known aggregate-essentials limitation. V2 uses separate versions and decimal-string money so clients cannot accidentally mix representations.

V2 principal allocation starts from outstanding principal. Opening principal arrears are a subset of that amount, are initialized once, and are excluded from future scheduled principal. Due interest is a subset of unpaid interest. New accrual uses exact integer half-up rounding on opening principal at `APR / 52`; interest is not compounded. At maturity all residual interest becomes due. Payments satisfy due interest before principal and preserve the cash buffer. The collection cap is enforced on actual payments.

The essential treatment is an explicit policy choice. Payable bills accumulate as essential arrears. Nonrecoverable consumption records cumulative deprivation separately, while any pre-existing payable arrears remain payable. Cash, principal, interest, payment allocation and payable-essential identities are checked inside each replay. Those checks are source code only and have not been exercised in this delivery.

Observed history must consist of dated, adjacent seven-day periods ending one week before the projected start. Missing or unobserved periods cause `INSUFFICIENT_DATA`. Histories with at least 104 observed weeks use corresponding prior-year weeks. Shorter eligible histories use a rolling 13-week median with a limited-evidence label. No trained default model or forecasting accuracy claim is made. The v2 forecast is a separate implementation, so v1 arithmetic parity applies only to the copied legacy engine.

All candidates are simulated across the same required and diagnostic paths. Feasibility requires the buffer, essentials, arrears and maturity constraints to pass in every required scenario. Eligible plans are ranked by baseline-scenario interest, then their largest actual installment, then stable candidate order. The optimized plan does not automatically win. A lack of feasible candidates does not by itself prove mathematical infeasibility.

The import path persists observed transaction evidence and a row report. Stable source keys deduplicate repeats and distinguish conflicting content. Transfers and disbursements retain their original type. Refunds and reversals must name their source event, but cross-import relationship reconciliation remains a later integration task. Import does not automatically convert events into a weekly loan snapshot. Public aggregates and monthly research records have separate types and cannot satisfy an operational weekly snapshot. No monthly-to-weekly interpolation is implemented.

## Durable execution

The evaluation and corresponding outbox event are inserted in the same database transaction. Queue payloads contain tenant and aggregate IDs only. The publisher uses row locks and stable BullMQ job IDs. Five retries use exponential backoff and jitter. Import and evaluation queues are separate. Worker concurrency is two evaluations and one import per process; a database tenant limit restricts active evaluations to two.

Evaluation claims receive a 60-second database lease and an attempt token. The result, candidate summaries and scenario ledgers are committed atomically. A stale token cannot commit. A completed evaluation is skipped on duplicate delivery. The recovery loop republishes old durable intents when a queued evaluation or expired lease has lost its queue delivery. Redis uses AOF persistence in the optional local infrastructure. These mechanisms have not been crash-tested.

Ledgers are stored in PostgreSQL JSONB and paginated at the API boundary. Private object-storage compression and ledger archival are not implemented. The monitor module recovers queue intent; it does not perform actual-versus-forecast borrower outcome monitoring.

## Optional optimizer

The optimizer is disabled by default. Enabling it invokes an explicit Python subprocess with a five-second solver budget, seven-second process timeout, and 64 KiB output cap. Only clean opening debt is supported by this initial solver: nonzero opening principal arrears, interest or essential arrears return an unavailable status and leave the baseline candidates eligible.

CP-SAT chooses one common schedule for the required paths. Principal allocation, allowed collection dates, maximum installments, the cash buffer, essential spending, maturity, rounded interest and the interest ceiling are integer constraints. Stage one searches for the least interest. Stage two uses the returned feasible interest plus the permitted budget while minimizing the largest installment. Each stage records status, bounds, gaps and time limits. `proven_minimum` is reserved for an optimal first-stage solve. A timed feasible value is `best_found`.

Stage-three tie breakers for fewer dates, changes from an accepted schedule and stable schedule order are not implemented. Consequently the top-level `optimalityProved` stays false even when both implemented stages return optimal. The worker independently replays any returned schedule and rejects mismatches. Exhaustive enumeration, cross-language rounding checks, timing benchmarks and solver integration tests have not been run. The user-facing recommendation remains conservative when search does not provide a validated schedule.

## Approval boundary

Selection creates a reviewed decision. Approval requires all of the following in one transaction:

1. An approver or administrator who differs from the selecting reviewer.
2. A completed feasible candidate belonging to the same tenant and evaluation.
3. An unchanged expected loan version.
4. A borrower consent reference.
5. A passing `daily_replay_checks` record matching the exact snapshot hash, evaluation and plan.

No HTTP endpoint can create that verification record, and the application runtime role has read-only permission on its table. A trusted daily-event replay integration must supply it. That integration is not implemented, so ordinary demo requests cannot approve or activate a schedule. This deliberately preserves the guide's daily-event acceptance gate. Successful approval source code appends a schedule and loan version, records the approver, supersedes stale pending reviews and appends an audit event. It does not send a schedule to a lender's servicing system.

## Configuration for a later authorized validation phase

No command in this section was executed for this delivery.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime login belonging to `domino_runtime`, never the migration owner |
| `REDIS_URL` | Private authenticated Redis connection |
| `WORKER_TENANT_IDS` | Explicit comma-separated tenant allowlist for the worker |
| `DOMINO_OPTIMIZER_ENABLED` | `true` enables the optional subprocess; unset keeps it disabled |
| `DOMINO_PYTHON` | Python executable with the pinned OR-Tools dependency |
| `DOMINO_OPTIMIZER_SCRIPT` | Absolute solver path; recommended outside workspace execution |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD` | Required local infrastructure secrets |

The migration requires a separate trusted migration administrator. Its `SECURITY DEFINER` session lookup has a fixed search path and only accepts a hashed high-entropy session token. The provided local PostgreSQL owner is an administrator; it must not become `DATABASE_URL` for the app. `domino_runtime` is created as a non-login, non-superuser, non-RLS-bypass role. Provision a separate login and grant that role out of band. Session issuance, login-provider integration, expiry policy, membership administration and secure secret storage also require deployment setup. No development bypass or default session token is provided.

Future operator commands, provided as instructions only:

```sh
# Infrastructure only, after exporting explicit local secrets.
docker compose -f infra/docker-compose.yml up -d

# Apply with an administrative migration connection, not the app login.
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/migrations/001_initial.sql

# Optional solver environment.
python3 -m venv .venv
.venv/bin/pip install -r services/optimizer/requirements.txt

# Worker, after installing workspace dependencies and provisioning records.
npm run start --workspace @domino/worker
```

An operator must provision tenants, memberships, hashed sessions, source records, immutable policy versions, borrowers and loan snapshots before API use. No database seed was executed or bundled with credentials. The canonical Zod snapshot and policy schemas describe the required input. Secrets belong in an ignored local environment file and in a deployment secret store; none belong in browser environment variables.

## Work still required before operational use

- Authorized backend typechecking, builds, all preserved and new acceptance tests, database integration tests and tenant-isolation verification.
- Hand-calculated accounting fixtures, original API parity checks and bounded optimizer enumeration and timeout validation.
- A verified daily-event replay implementation and trusted attestation writer for the approval gate.
- A login provider and session lifecycle, private object storage, retention/deletion policy implementation and source-access administration.
- CSV file parsing/upload, virus/format limits for raw file uploads, event reconciliation and a reviewed cash-flow snapshot assembly pipeline.
- Forecast backtests, calibrated scenario research, wider scenario sets, production quotas and resource/capacity benchmarks.
- Production traces and metrics, deployment-specific TLS/RLS checks, restore procedures, migration evolution and operational alerting.
- Lender servicing activation, actual repayment outcome collection and a permissioned pilot with an appropriate comparison design.

The implementation guide's acceptance gates remain unverified until that later phase. Frontend experiment results do not establish any of these backend properties.
