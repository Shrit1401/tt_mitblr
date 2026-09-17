# DOMINO public evidence pack

Retrieved on 17 September 2026. This pack contains published aggregate statistics plus historical monthly household observations from the public India Financial Diaries portal. It contains no verified weekly borrower histories and no measured DOMINO outcomes.

## Files and reproducibility

- `raw/nabard-nafis-2021-22.pdf`: primary NABARD report, downloaded directly from NABARD.
- `raw/sidbi-microfinance-pulse-27.pdf`: primary SIDBI and Equifax report, downloaded directly from SIDBI.
- `nafis_household_groups.csv`: 3 household-group rows from NABARD Table 5.1.
- `nafis_state_household_averages.csv`: 30 state/UT rows plus the published India aggregate from NABARD Table 5.2.
- `sidbi_sector_snapshot.csv`: 2 selected sector-scale facts from the SIDBI and Equifax report.
- `public_evidence_summary.json`: deck-ready values and chart guidance.
- `analyze_public_data.py`: reproduces the tidy files from the two source PDFs using `pdftotext`; checks the table row count and each state-level subtraction.
- `raw_checksums.json`: exact bytes and SHA-256 checksums for raw files.

Run `python3 data/public/analyze_public_data.py` from the project root. Poppler's `pdftotext` is required. This is extraction and analysis, not synthetic-data generation.

### Public repository distribution

The full local source reproduction is `python3 data/public/run_experiments.py`. Its execution record is `experiment-results.json`; the detailed method and limitations are in [the experiment report](../../docs/research-experiments.md). After cloning without local research inputs, use `python3 data/public/run_experiments.py --published-only` to check the distributed aggregate tables. This mode records the eight source-dependent experiments as skipped.

All `raw/` files and the household-level `finmark_india_household_months.csv`, `finmark_india_monthly_long.csv`, and `finmark_example_LAH31_chart.csv` are retained locally and excluded from the public repository. References to those paths describe local reproduction inputs and outputs, not files bundled with the public source distribution. The repository retains attributed aggregate findings, analysis programs, source links, and checksums. Third-party content retains its own access and redistribution terms.

## Source A: NABARD NAFIS 2021-22

Primary source: [NABARD All India Rural Financial Inclusion Survey 2021-22, full report](https://www.nabard.org/auth/writereaddata/tender/2102255939NAFIS%202021-22%20Report%20Final.pdf).

- Data location: Table 5.1, printed page 45, PDF page 93; Table 5.2, printed pages 45-46, PDF pages 93-94. Sampling and time-reference details are in sections 2.2-2.5, printed pages 8-11. Debt incidence is in section 8.1.1, Figure 8.1.
- Observation unit: household, not person or loan.
- Denominator: all households in the covered survey population, or the indicated agricultural/non-agricultural subgroup. These are published design-weighted estimates, not arithmetic averages of the 30 state/UT rows.
- Survey design: multi-stage stratified random sampling; 100,000 households in 10,000 villages/census enumeration blocks across 710 districts, 28 states and 2 Union Territories, Jammu & Kashmir and Ladakh.
- Geography: rural and some semi-urban centres with populations below 50,000, corresponding to RBI Tier 3-6. This is not an all-urban-and-rural India estimate.
- Time: most income questions refer to agricultural year 1 July 2021 to 30 June 2022. Fieldwork started in September 2022 and lasted 10 months. Consumption uses mixed recall windows, principally the preceding month and preceding year for selected items. Label the figures by the survey period, not as 2026 household incomes.
- Units: Indian rupees per household per month; nominal values. No inflation adjustment is applied here.
- Income and consumption are respondent-reported. Table 5.1 gives income 12,698 and consumption 11,262 for all households; 13,661 and 11,710 for agricultural households; 11,438 and 10,675 for non-agricultural households.
- Derived column: `income_minus_consumption_inr = avg_monthly_income_inr - avg_monthly_consumption_inr`. The India value is 1,436. `gap_share_of_mean_income_pct` divides this difference by the published mean income, multiplied by 100. It is a ratio of means, not the average household savings rate.
- Interpretation: an income-consumption gap is not verified disposable income, savings, or debt-service capacity. Averages hide the distribution and timing of cashflows. Existing loan payments, capital costs, emergencies, variation between households, and differing recall windows prevent using this figure directly as a safe instalment limit.
- Access and license: publicly downloadable report without authentication. No explicit open-data license was identified in the report. Preserve attribution, cite selected facts, and do not describe the full report or its underlying household microdata as freely licensed. The underlying microdata is not included in this pack.

## Source B: SIDBI and Equifax Microfinance Pulse, volume XXVII

Primary source: [Microfinance Pulse Report, 27th edition, May 2026](https://www.sidbi.in/head/uploads/microfinancepulse_documents/MFI-Pulse-Report-27th-Edition.pdf).

- As-of date: 31 March 2026. Published May 2026. It is a dated sector snapshot, not a claim that this is the newest report available.
- Location: unique borrower figure on pages 4 and 8; glossary on page 5; reporting disclaimer on page 29.
- Geography and coverage: India microfinance information substantially supplied by institutions that report to Equifax. This is bureau coverage, not a population census.
- Unique live borrowers: approximately 5.5 crore, equivalent to approximately 55 million. This is deduplicated across lenders, as specified by the note on page 8. The lender-category client total of 60.562 million is not unique and must not replace this figure.
- Scope: the report defines live accounts as 0-179 days past due plus new and current accounts. Counts exclude some other statuses and are not interchangeable with figures from other bureaus or differently scoped microfinance reports.
- Portfolio outstanding: 277,053 crore rupees under the report's live-portfolio scope.
- Interpretation: the borrower count establishes sector scale. It is not DOMINO's user base, validated addressable market, eligible borrowers, attainable penetration, or people already helped.
- Access and license: publicly downloadable without authentication. The document is marked copyright Equifax, all rights reserved, proprietary; its page 29 states that copying/circulation/publication of the report requires approval. Raw copies here are local research evidence. Do not redistribute the report as part of the deck package or call it an open-licensed dataset. Use limited factual values with attribution and a source link.

## Secondary research retained, not used in the deck figures

The MFIN press release dated 1 September 2026 was also downloaded from [MFIN](https://mfinindia.org/assets/upload_image/news/pdf/Micrometer%20Q1%20FY%2026-27%20Press%20Release.pdf), covering 30 June 2026. It uses different coverage and portfolio definitions from the SIDBI and Equifax live-account series. It is retained only as a research cross-check. Do not combine its totals with the SIDBI denominator.

## What this evidence can and cannot establish

It supports a sourced household-income chart, a documented regional benchmark file, a dated sector-scale figure, and research on 86 historical household diary records. It does not establish that changing repayment schedules reduces real-world defaults or improves welfare. No weekly borrower cashflow dataset was downloaded or integrated into the calculation engine. The historical monthly diaries do not verify borrower status. Existing generated borrower histories remain synthetic until separately replaced with suitable observed records. Public survey aggregates must not be expanded into fictitious people or weeks and described as real observations.

A benchmark-calibrated scenario would still be a simulation. Keep labels distinct: published aggregate evidence; observed consented borrower cashflows; simulated repayment schedules; prospective commercial assumptions. There is no verified count of people helped by DOMINO in the supplied evidence.

## Deck-ready source lines

For an income-versus-consumption bar chart:

`Source: NABARD, NAFIS 2021-22, Table 5.1, p.45. Survey averages in INR per household per month.`

For a market-scale number:

`Source: SIDBI and Equifax, Microfinance Pulse XXVII, May 2026, pp.4,8. Approx. unique live borrowers as of 31 Mar 2026.`

Place the source immediately below the relevant chart or number and hyperlink it to the primary report. For the household gap, label it `Income minus consumption`, and add `Published averages, not borrower repayment capacity`.

## Raw PDF checksums

- `nabard-nafis-2021-22.pdf`: SHA-256 `2b09a5e4e64041932908f9427ff3d0dc0246b45b057511fbef82e280d9e3aada`; 10,732,424 bytes.

- `sidbi-microfinance-pulse-27.pdf`: SHA-256 `bb18beef19f4bed8d6335e743c289005881303013b718b082f20673ec736f44f`; 2,265,770 bytes.

- `mfin-q1-fy2026-27-press-release.pdf`: SHA-256 `73514bade3365382fd134d373dfbfb4dba127b59c47a7667debf348ca82065b5`; 165,309 bytes.


## Source C: India Financial Diaries, via FinMark Trust public portal

Primary-hosted portal: [India Financial Diaries](https://finmark.org.za/data-portal/IND/financial-diaries).

- Actual public chart records were downloaded from the same unauthenticated API URL referenced by the portal's JavaScript, without a login or account. The exact encoded request is saved in `raw/finmark-request-url.txt` and in `finmark_data_quality.json`.
- Files: `raw/finmark-household-transactions.json` is the raw response; `finmark_india_monthly_long.csv` preserves 721 observed category-month values; `finmark_india_household_months.csv` joins them into 365 household-month rows; `finmark_data_quality.json` gives counts and quality checks. Reproduce with `python3 data/public/analyze_finmark_diaries.py`.
- Geography: Varanasi and outskirts, Uttar Pradesh. Period: February to June 2013. Currency: nominal Indian rupees. The source states 86 households and 376 individual members. It explicitly states that the sample is not nationally representative.
- Frequency: the API provides monthly values, not transaction-level daily or weekly dates, despite its endpoint name. There are 357 income-month observations, 364 expense-month observations and 356 paired household-month observations. Only 56 households have both categories in all five months. Missing values remain blank and are never assumed to be zero.
- Sign convention: expenses are negative in the source. `expense_signed_inr` retains that value; `consumption_outflow_inr` is its negative, for a positive outflow display. The 26 negative reported income-month values are preserved and flagged, not silently clipped or turned positive. The meanings of net-income components require further codebook review before engine use.
- These are household diary records, not confirmed microloan borrowers. There are no verified loan schedules, opening cash balances, essential-expense classifications, treatment indicators or subsequent default outcomes in this selected response. The records cannot establish how many people DOMINO helped.
- Example chart: `finmark_example_LAH31_chart.csv` contains the five monthly income and expense values for the first household returned by the source API. Selection is an illustrative example, not a representative household or an outcome selected to demonstrate product success. Title and source lines are recorded in `finmark_data_quality.json`.
- Access and license: [FinMark terms](https://finmark.org.za/terms-of-use), downloaded to `raw/finmark-terms-of-use.html`, permit free research analysis and require attribution. The page also says portal publications use CC BY 4.0 or an equivalent license, while an earlier paragraph asks for data-owner approval before public presentation/publication. This is ambiguous. Local research and data-quality analysis are supported by the terms; do not represent it as an unrestricted production-data license or conceal the ambiguity when preparing external publication. No data-owner contact or approval was obtained, and no message was sent.
- Scope change: this source was found after the aggregate reports. Its acquisition does not convert the original weekly synthetic backend fixtures to observed data. No backend files were edited.
