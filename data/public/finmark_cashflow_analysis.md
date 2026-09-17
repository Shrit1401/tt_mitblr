# Observed monthly income-expense gaps

Source: [India Financial Diaries, hosted by FinMark Trust](https://finmark.org.za/data-portal/IND/financial-diaries). Varanasi and outskirts, Uttar Pradesh, February to June 2013. Retrieved 17 September 2026. Nominal rupees. This sample is not nationally representative.

| Sample | Households with paired observations | Paired household-months | Months where income is below expense outflow | Households with at least one such month |
|---|---:|---:|---:|---:|
| All available paired observations | 85 | 356 | 156 / 356 (43.82%) | 75 / 85 (88.24%) |
| Households with all five paired months | 56 | 280 | 117 / 280 (41.79%) | 49 / 56 (87.50%) |

The downloaded source contains 86 households and 365 household-month rows. Nine rows lack either income or expense and are excluded from comparisons. One household has no paired month, so the all-available household denominator is 85, not 86. The complete subset includes 56 households with observations for both categories in every month from February through June, giving 280 paired household-months.

For each paired month, the calculation compares the source income value with the positive expense outflow. The source stores expense as a negative signed value, so `expense_outflow = -signed_expense`. A gap is counted where `income < expense_outflow`. Decimal arithmetic checks the sign conversion and the gap against the tidy source. No missing observation is replaced with zero.

All 26 negative reported income observations are retained in the all-available analysis. Nineteen occur in the complete subset. These values are neither clipped nor converted to positive amounts. Their income-component definitions require further codebook review before any lending interpretation.

These are observed monthly income-expense gaps. They do not measure essential-spending shortfalls, loan defaults, missed instalments, or people helped by DOMINO. Household expenses are not classified as essential here, borrowing status is unverified, and opening balances or other cash resources are not assessed. A household may cover the difference using savings, credit or other resources. No national estimate or product-impact claim follows from these counts.

Reproduce from the project root:

```sh
python3 data/public/analyze_finmark_diaries.py
python3 data/public/analyze_finmark_cashflow.py
```

The machine-readable output, `finmark_cashflow_analysis.json`, records denominators, method, limitations and SHA-256 checksums of the raw response and input CSV. See `provenance.md` for the source access and license notes.
