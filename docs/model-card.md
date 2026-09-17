# Model card

## Summary

DOMINO is a repayment-schedule research prototype. Its calculation foundation is a deterministic rules and accounting model. It is not a trained credit-risk model, a calibrated default predictor, or an autonomous lending system.

The browser experience uses synthetic fixtures and curated demonstration results. Backend source is included but has not been executed or verified in this delivery. Public-data experiments are a separate research track. None of these establishes real borrower outcomes.

| Item | Description |
| --- | --- |
| Intended user | A loan officer or reviewer studying repayment timing and tradeoffs |
| Intended output | Reviewable comparisons with explicit assumptions, cash constraints, and source notes |
| Currency | INR; integer paise at the calculation boundary |
| Demonstration frequency | Weekly |
| Demonstration history | Generated case histories; not consented borrower records |
| Typical demonstration horizon | 26 weeks |
| Core approach | Heuristic income-pattern assessment, baseline schedules, cash and debt replay |
| Current verification | Frontend interactions and public research only; see the status register |

## Intended and excluded uses

Use the prototype to review product design, explore example repayment patterns, inspect provenance, and prepare a demonstration decision note. The code can also serve as a starting point for an independently validated engine and operational service.

Do not use a fixture recommendation to approve credit, alter a live loan, determine eligibility, estimate a borrower's default probability, or claim a measured reduction in financial stress. It has no verified deployment or treatment-outcome evidence.

## Inputs and evidence types

The legacy calculation model accepts a borrower identifier, generated weekly income and essential-expense history, opening cash, loan principal, APR in basis points, a start date, and a loan term. A scenario changes receipt delay, receipt reduction, expense increase, and a protected cash buffer.

For production, these need additional evidence: consent, a reconciled opening balance, a current loan snapshot including arrears, categorized payable essentials, a contractual accrual convention, a payment calendar, and a policy version.

| Evidence type | Permitted interpretation |
| --- | --- |
| Synthetic fixture | Repeatable demonstration case |
| Published aggregate | Context for a defined population and historical period |
| Historical monthly microdata | Offline research at its actual monthly frequency |
| Consented borrower observation | A potential operational input after validation and reconciliation |
| Projected scenario | A constructed future path under explicit assumptions |

The public India Financial Diaries sample does not include the verified loan terms, opening cash, essential-expense classifications, or subsequent repayment outcomes required for a borrower-level feasibility claim.

## Calculation foundation

Two calculation versions are present. The interface reads previously saved v1 demonstration responses; it does not call either engine version. Both source versions remain unexecuted in this delivery.

| Version | Source and money representation | Role |
| --- | --- | --- |
| Legacy v1 | `packages/engine/src/model.ts`; numeric integer paise | Preserved calculation foundation and existing regression source |
| New v2 | `packages/engine/src/v2.ts`; checked `bigint` internally, decimal integer strings in JSON | Unverified implementation of stronger accounting and scenario boundaries |

### Preserved v1 behavior

The inherited model classifies weekly histories with deterministic thresholds. It compares recent receipts with the same period in the previous year and measures annual pattern correlation and variability. These flags describe patterns in the supplied history. They do not explain why income changed.

The forecast uses corresponding historical weeks and a reduction factor when the rule detects sustained decline. This is a baseline assumption, not a trained forecast with established accuracy. No annual-seasonality conclusion follows from a five-month research sample.

The four baseline schedule families are:

| Candidate | Construction | Important limitation |
| --- | --- | --- |
| Fixed weekly | Principal distributed across the horizon | Ignores variation in receipt timing |
| Every four weeks | Principal due on four-week boundaries and at maturity | Periodic dates are not inferred actual receipt dates |
| Seasonal surplus | Larger principal allocations where forecast surplus is larger | Depends on the baseline forecast and expense assumptions |
| Six-week reduced start | Lower weights for the first six weeks, higher later weights | Defers principal and may increase interest |

Schedules are constructed from the baseline path. Stress replay changes income and expenses while retaining the candidate schedule. The model must not revise dates after observing which scenario occurs.

The inherited interest convention is simple weekly interest on opening principal, APR divided by 52, rounded to paise, with no compounding. Income arrives before essentials and collection in each weekly period. Due interest is paid before principal. Loan collection preserves the configured buffer where cash allows it.

This convention does not represent every lending contract. Daily accrual, intraweek receipt ordering, fees, penalty interest, extensions, or compounding require separately versioned policies and verification.

### New v2 implementation

The new source adds checked integer arithmetic, explicit opening principal and interest arrears, payable essential arrears versus non-recoverable unmet consumption, configured payment dates, collection and interest caps, and maturity debt disclosure. The engine version is intentionally marked `0.2.0-unverified`.

Its input forecast requires contiguous observed weekly history with non-missing income and essentials. With at least 104 weeks, it averages corresponding weeks from the prior two years. Shorter accepted histories use the recent 13-week median and retain a limited-evidence label. This v2 forecast does not apply the legacy sustained-decline scaling rule.

The implementation constructs a required baseline, a required stress scenario with at least two weeks of receipt delay, a 15% income reduction, and a 10% essential-expense increase, and a diagnostic zero-income scenario. Requests can strengthen the required stress settings. These deterministic transformations have no probability interpretation. Candidates must pass every required replay before ranking by baseline-scenario interest and maximum payment. These source rules have not been exercised or backtested in this delivery.

Approval is deliberately gated on a persisted verified daily replay. The weekly engine cannot supply that evidence itself. A future lender integration must provide dated events and validate ordering before operational approval is enabled.

## Accounting requirements

For every replayed period:

```text
closing cash = opening cash + income - essentials paid - loan paid
closing principal = opening principal - principal paid
closing interest = opening interest + accrued interest - interest paid
loan paid = interest paid + principal paid
```

Principal arrears are a subset of outstanding principal. They must not be added as new principal. A new schedule allocates only the opening outstanding principal and counts overdue amounts once.

Payable essential bills need carried arrears; non-recoverable unmet consumption needs a distinct shortfall measure. The original model reported aggregate unmet essentials without carrying an essential liability. The implementation guide requires a deliberate treatment and explicit disclosure. An implementation change is not considered validated until its accounting checks run.

At maturity, all residual principal and unpaid interest remain visible. Rounding must not remove debt. Integer-safe checks must cover intermediate arithmetic as well as incoming values.

## Recommendation interpretation

The baseline selector evaluates feasible candidates before comparing interest. Low interest cannot compensate for unpaid essentials, arrears, an unprotected buffer, or remaining debt. A recommendation is conditional on the precise scenario set and policy that were checked.

Required scenarios define the acceptance boundary. Diagnostic scenarios show failure limits and only invalidate a plan when policy explicitly requires them. Passing a fraction of constructed scenarios is a coverage measure, not a calibrated probability.

An optimizer is an additional candidate generator. Its proposed schedule must pass independent replay under the same policy. `FEASIBLE` means a candidate was found; `OPTIMAL` means the stated objective was proved optimal within the formulated problem. A timeout cannot establish infeasibility. A baseline may legitimately outperform the optimizer's best-found candidate.

## Public-data findings

The attributed historical research sample contains 86 households and 365 household-month rows for Varanasi and outskirts, February to June 2013. It has 356 paired income and expense observations, with 156 paired months showing income below reported expense outflow. These are historical monthly gaps, not unpaid essentials or defaults.

The complete-case comparison uses 56 households and 280 paired months. Missing values and 26 negative reported income observations remain explicit. The [research experiment report](research-experiments.md) records reproduction and sensitivity analyses. [Provenance](../data/public/provenance.md) records sign conventions, denominators, source limitations, and access terms.

NABARD and SIDBI figures supply dated population context. They do not establish the user's income, DOMINO's customer count, or attainable market share.

## Known limitations

- Synthetic profiles cannot establish fairness, representativeness, predictive performance, or impact.
- Weekly aggregation can hide a cash shortage before a receipt arrives within the week.
- Heuristic pattern thresholds have not been calibrated to a representative operational population.
- Borrower history may omit informal borrowing, transfers, obligations, emergencies, or reporting error.
- The public diary sample is local, historical, monthly, incomplete, and not nationally representative.
- A source being publicly accessible does not establish unrestricted redistribution rights.
- Backend, queue, persistence, and solver behavior remain unverified in this delivery.
- The prototype records local drafts; it does not supply production consent, authorization, or servicing controls.

## Evidence required before operational use

Complete independent accounting fixtures, API and tenant-isolation tests, duplicate-delivery recovery checks, strict-cutoff forecast backtests, and optimizer replay where applicable. Establish a permissioned data pipeline with reconciliation and source lineage. Review the policy with the lender and confirm borrower consent before changing a schedule.

A prospective pilot should separately measure data coverage, officer review time, recommendation acceptance, observed cash shortfalls, missed installments, interest paid, and adverse outcomes. Every measure needs a denominator, period, and comparison design. Workflow usability does not prove a reduction in defaults.

See [implementation status](implementation-status.md) for the delivery boundary and [the detailed guide](../output/DOMINO-Implementation-Guide.md) for acceptance criteria.
