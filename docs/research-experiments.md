# Public evidence experiments

The complete local research run on 17 September 2026 completed **9 public evidence experiments**. Every experiment passed its stated data checks. The application backend, calculation engine, optimizer, queue, database, and API were not executed or tested, following the project request.

The run record is [experiment-results.json](../data/public/experiment-results.json). It records Python 3.13.13, the UTC execution time, input SHA-256 hashes, experiment measurements, and the backend experiments left unexecuted. PDF extraction used Poppler `pdftotext` 26.04.0. These are observations and consistency checks on research data. They do not demonstrate product effectiveness, repayment safety, or backend correctness.

## Reproduce the work

The public repository distributes source code, attributed aggregate facts, and experiment summaries. It excludes third-party source PDFs and household-level diary records. Two commands therefore serve different purposes.

### Check the published tables after cloning

```sh
python3 data/public/run_experiments.py --published-only
```

This checks the distributed aggregate CSVs and summary metadata. It completes R09 and records R01 through R08 as skipped because the command explicitly excludes their local inputs. The measured result is **1 passed, 8 skipped**, recorded in [published-check-results.json](../data/public/published-check-results.json). This mode does not claim to reproduce the original source extraction.

### Reproduce every local research experiment

Use Python 3.10 or later and install Poppler so `pdftotext` is available. Obtain source files under their applicable terms and retain these local paths:

```text
data/public/raw/nabard-nafis-2021-22.pdf
data/public/raw/sidbi-microfinance-pulse-27.pdf
data/public/raw/finmark-household-transactions.json
data/public/raw/finmark-request-url.txt
```

The report links and public diary endpoint are recorded in [provenance.md](../data/public/provenance.md) and [finmark_data_quality.json](../data/public/finmark_data_quality.json). Exact expected source bytes are pinned in [raw_checksums.json](../data/public/raw_checksums.json). A changed remote response is a different snapshot, not an interchangeable reproduction of this run.

```sh
python3 data/public/run_experiments.py
```

This command verifies the four pinned inputs before extraction, runs the three existing public-data scripts in order, and performs the additional coverage and sensitivity analyses below. It stops with an error if an input is missing, a checksum differs, `pdftotext` is missing, or a data check fails. It does not fetch new data or import application modules. The completed source run reported **9 passed, 0 skipped**.

Individual steps remain available:

```sh
python3 data/public/analyze_public_data.py
python3 data/public/analyze_finmark_diaries.py
python3 data/public/analyze_finmark_cashflow.py
```

## Experiment register

| ID | Experiment | Observed result | What it establishes |
|---|---|---|---|
| R01 | Compare local inputs with pinned SHA-256 hashes | 4 source files matched | The run used the recorded research snapshot |
| R02 | Extract selected NABARD and SIDBI facts from PDFs | 31 NAFIS geography rows, 3 household-group rows, 2 SIDBI facts | The published table facts can be recovered from the local reports |
| R03 | Normalize the diary chart response | 86 households, 721 category-month values, 365 household-month rows, 356 paired months | Category signs, observed flags, identifiers, and monthly frequency remain traceable |
| R04 | Compare income with expense outflow for every paired month | 156 / 356 months, 43.82% | The observed share of paired months with income below reported expense outflow |
| R05 | Repeat R04 for complete five-month households | 117 / 280 months, 41.79%, across 56 households | How the descriptive count changes under a fixed observation window |
| R06 | Audit missing observations against the five-month window | 65 absent household-months, 9 unpaired rows | Missing months remain missing; they do not become zero income |
| R07 | Examine the effect of excluding negative income observations | 130 / 330 months, 39.39% in this diagnostic subset | The primary percentage is sensitive to changing the included observations |
| R08 | Break R04 into monthly counts | 5 monthly denominator/count pairs reconcile to 356 / 156 | The pooled result is traceable to its monthly components |
| R09 | Reconcile distributed aggregate tables and summary labels | 36 rows checked; all mean differences reconcile | The published files agree arithmetically and remain labeled as public evidence |

Passing an experiment means its input checks and stated calculation completed. It does not imply that a hypothesis about borrower behavior or a product outcome was proven.

## Published household context

[NABARD NAFIS 2021-22](https://www.nabard.org/auth/writereaddata/tender/2102255939NAFIS%202021-22%20Report%20Final.pdf), Table 5.1, printed page 45, reports the following household averages. Values are nominal Indian rupees per household per month for the survey's covered rural and semi-urban population.

| Household group | Mean income | Mean consumption | Income minus consumption |
|---|---:|---:|---:|
| All households | ₹12,698 | ₹11,262 | ₹1,436 |
| Agricultural households | ₹13,661 | ₹11,710 | ₹1,951 |
| Non-agricultural households | ₹11,438 | ₹10,675 | ₹763 |

The all-household difference is 11.309% of the published mean income. This is a ratio of means, not an average savings rate or a safe repayment amount. R02 also recovers Table 5.2, containing 30 state/UT rows and the India aggregate. Nine state/UT mean differences are below ₹1,000. The India estimate is a published survey aggregate and is not calculated by averaging the state rows.

The [SIDBI and Equifax Microfinance Pulse, volume XXVII](https://www.sidbi.in/head/uploads/microfinancepulse_documents/MFI-Pulse-Report-27th-Edition.pdf), pages 4 and 8, reports approximately **5.5 crore unique live borrowers**, or 55 million, as of **31 March 2026**. The live portfolio outstanding is ₹277,053 crore. This is dated sector context within the report's bureau coverage. It is not a DOMINO customer, beneficiary, or eligible-borrower count.

## Historical monthly diary analysis

The [India Financial Diaries portal hosted by FinMark Trust](https://finmark.org.za/data-portal/IND/financial-diaries) supplies the selected historical records for Varanasi and its outskirts, Uttar Pradesh, February through June 2013. The local response includes 86 households. This sample is not nationally representative. Monthly values remain monthly throughout this analysis.

R03 preserves 357 reported income observations and 364 reported expense observations. Joining categories on household and month gives 365 observed rows. Of these, 356 have both categories. There are 85 households with at least one paired month, so the household denominator for R04 is 85.

For each paired observation, the calculation uses:

```text
expense_outflow = -reported_signed_expense
observed_monthly_difference = reported_income - expense_outflow
income_below_expense = reported_income < expense_outflow
```

The analysis uses exact decimal arithmetic for comparisons and sign reconciliation. It excludes unpaired months and preserves all 26 negative reported income observations. Source values are not clipped, converted to absolute values, or replaced with an assumed amount.

| Sample | Households | Paired months | Income below expense | Households with at least one such month |
|---|---:|---:|---:|---:|
| All available paired observations | 85 | 356 | 156, or 43.82% | 75 / 85, or 88.24% |
| Complete five-month households | 56 | 280 | 117, or 41.79% | 49 / 56, or 87.50% |

In the full sample, income exceeds expense in 199 paired months and equals expense in one month. These counts, together with the 156 below-expense observations, sum to the 356-month denominator.

R05 reduces variation in the number of observations per household by requiring both categories in all five months. That restriction changes which households are included. It does not repair selection bias or make the sample representative. The complete subset retains 19 negative reported income observations.

### Missingness and observation coverage

There are 430 possible household-month positions in the 86-household, five-month window. The source contains at least one category in 365 positions. The remaining 65 positions have neither category. Of the 365 observed rows, one has income only and eight have expense only.

| Paired months available per household | Households |
|---|---:|
| 0 | 1 |
| 1 | 1 |
| 2 | 14 |
| 3 | 9 |
| 4 | 5 |
| 5 | 56 |

No missing value was imputed. No weekly value was manufactured. A household with missing observations contributes only its available paired months to R04.

### Negative-income sensitivity

R07 retains negative values in the primary analysis and separately computes a diagnostic subset that excludes the 26 negative-income months. The subset contains 330 paired observations, of which 130 have income below expense: **39.39%**. This contrasts with **43.82%** when all 356 paired observations are retained.

Exclusion changes the included population. It is not evidence that the negative values are errors. Their component definitions require codebook review before financial interpretation. The primary reported estimate remains 156 / 356.

### Monthly variation

R08 reports each month's numerator and denominator explicitly. The cohort changes as observation availability changes, so the percentages do not by themselves establish a seasonal pattern or a within-household trend.

| Month in 2013 | Paired household-months | Income below expense | Share |
|---|---:|---:|---:|
| February | 82 | 44 | 53.66% |
| March | 83 | 42 | 50.60% |
| April | 71 | 24 | 33.80% |
| May | 61 | 25 | 40.98% |
| June | 59 | 21 | 35.59% |
| Total | 356 | 156 | 43.82% |

The pooled percentage is calculated from 156 / 356. It is not an unweighted average of the five monthly percentages.

## Interpretation and limits

An observed income-expense difference does not identify essential-spending shortfalls, missed installments, defaults, or borrower distress. A household may use savings, transfers, borrowing, or other resources. The selected response does not establish opening cash, verified loan status, repayment schedules, essential-expense designations, treatment assignment, or subsequent default outcomes.

Five monthly observations cannot establish an annual seasonal pattern, validate a two-year weekly forecast, or justify an individual repayment recommendation. None of these experiments estimates a probability of default or the effect of DOMINO. No verified DOMINO beneficiary count or lender pilot result has been supplied.

The prototype's borrower names, balances, schedules, scenario comparisons, and workflow statuses are demonstration fixtures. Keep their source labels separate from these historical research findings and from published survey context.

## Backend experiments deliberately left unexecuted

The implementation guide also specifies work that executes or validates backend behavior. These activities were not run because the project explicitly requests a backend without backend testing:

| Guide area | Unexecuted experiment or acceptance check |
|---|---|
| API and tenancy | Request validation, authentication, tenant isolation, contract parity, duplicate submission |
| Accounting engine | Cash/principal/interest identities, arrears accounting, daily replay, malformed financial inputs |
| Forecasts and scenarios | Rolling-origin forecast comparisons, seeded scenario replay, required-scenario feasibility |
| Optimization | Exhaustive toy-problem comparison, solver timeouts, Python/TypeScript rounding parity, objective bounds |
| Persistence and jobs | Database migrations, worker-crash/retry behavior, transactional outbox, idempotency under concurrency |
| Performance | API latency, queue acceptance latency, ledger throughput, optimizer timing |
| Approval and servicing | Consent/version conflict checks, schedule activation, downstream integration |
| Field outcomes | Pilot impact, actual repayment stress, recovery, defaults, borrower welfare |

The guide's latency targets remain targets. No backend performance number or backend test-pass claim is made. Public evidence checks and frontend checks cannot substitute for those acceptance gates.

## Publication boundary

Source attribution, reference periods, access notes, and checksums remain in [provenance.md](../data/public/provenance.md). Raw PDFs, copied website assets, and household-level CSV/JSON records remain local research material and are excluded from the public repository. This also avoids bundling copyrighted report pages and unnecessary source-site files.

The [FinMark terms](https://finmark.org.za/terms-of-use), rechecked on 17 September 2026, allow research analysis and contain both a public-presentation approval statement and a broad CC BY statement. The repository records that ambiguity and does not claim an unrestricted source-data license. It distributes attributed aggregate findings, methods, source links, and checksums. No data-owner approval or contact is represented.

The source programs are reusable project code. Third-party source content retains its own terms. Access to a public URL is not treated as proof of an unrestricted redistribution license.
