#!/usr/bin/env python3
"""Count observed income-expense gaps. Missing observations are not filled."""
from collections import Counter
from decimal import Decimal
from pathlib import Path
import csv
import hashlib
import json

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'finmark_india_household_months.csv'
rows = list(csv.DictReader(SOURCE.open()))
assert len({(r['household_id'], r['month']) for r in rows}) == len(rows)
paired = [r for r in rows if r['observed_income'] == 'True' and r['observed_expense'] == 'True']
for r in paired:
    r['income_decimal'] = Decimal(r['income_inr'])
    r['outflow_decimal'] = Decimal(r['consumption_outflow_inr'])
    assert r['outflow_decimal'] == -Decimal(r['expense_signed_inr'])
    assert r['income_decimal'] - r['outflow_decimal'] == Decimal(r['income_plus_signed_expense_inr'])
expected_months = {f'2013-{m:02d}-01' for m in range(2, 7)}
by_household = {}
for r in paired:
    by_household.setdefault(r['household_id'], set()).add(r['month'])
complete_ids = {hid for hid, months in by_household.items() if months == expected_months}
complete_rows = [r for r in paired if r['household_id'] in complete_ids]

def describe(sample):
    households = {r['household_id'] for r in sample}
    gap_rows = [r for r in sample if r['income_decimal'] < r['outflow_decimal']]
    gap_households = {r['household_id'] for r in gap_rows}
    return {
        'households_with_paired_observations': len(households),
        'paired_household_months': len(sample),
        'income_below_expense_months': len(gap_rows),
        'income_below_expense_month_share_pct': round(len(gap_rows) / len(sample) * 100, 4),
        'households_with_at_least_one_observed_income_below_expense_month': len(gap_households),
        'household_share_with_at_least_one_observed_gap_pct': round(len(gap_households) / len(households) * 100, 4),
        'negative_income_observations_retained': sum(r['income_decimal'] < 0 for r in sample),
        'income_equals_expense_months': sum(r['income_decimal'] == r['outflow_decimal'] for r in sample),
        'income_above_expense_months': sum(r['income_decimal'] > r['outflow_decimal'] for r in sample),
    }

all_stats = describe(paired)
complete_stats = describe(complete_rows)
assert all_stats['paired_household_months'] == 356
assert len(complete_ids) == 56 and complete_stats['paired_household_months'] == 280
for result in [all_stats, complete_stats]:
    assert sum(result[k] for k in ['income_below_expense_months', 'income_equals_expense_months', 'income_above_expense_months']) == result['paired_household_months']
analysis = {
    'source_name': 'India Financial Diaries, public FinMark Trust portal',
    'source_url': 'https://finmark.org.za/data-portal/IND/financial-diaries',
    'retrieved_on': '2026-09-17',
    'geography': 'Varanasi and outskirts, Uttar Pradesh, India',
    'period': 'February to June 2013',
    'currency': 'Nominal Indian rupees, 2013',
    'unit_of_analysis': 'Observed household-month with both income and expense values',
    'raw_response_sha256': hashlib.sha256((ROOT/'raw/finmark-household-transactions.json').read_bytes()).hexdigest(),
    'input_csv': SOURCE.name,
    'input_csv_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'method': 'For each paired month, compare reported signed income with the positive expense outflow, obtained by negating reported signed expense. A gap is counted only where income < expense outflow. Use exact decimal arithmetic. Preserve negative income values. Do not infer missing values.',
    'households_in_downloaded_source': 86,
    'household_month_rows_in_tidy_source': len(rows),
    'unpaired_household_months_excluded': len(rows)-len(paired),
    'households_without_any_paired_month': 86-len(by_household),
    'all_available_paired_months': all_stats,
    'complete_five_month_households': complete_stats,
    'negative_income_handling': 'All 26 negative income observations in the paired sample are preserved and included; 19 are in the complete five-month subset. These source values are not clipped, converted to positive values, or interpreted as a coding error. Their component definitions require further codebook review.',
    'interpretation': 'These counts describe observed monthly income-expense gaps in a historical, nonrepresentative household diary sample. They do not measure essential-spending shortfalls, missed repayments, defaults, borrower distress, or people helped by DOMINO. The source does not establish household borrowing status or other cash resources.',
    'limitations': [
        'The sample is not nationally representative and has no population expansion applied.',
        'Available-month denominators differ by household; the separate complete subset has exactly five paired months per household.',
        'Households may cover a negative monthly difference with savings, borrowing, transfers, asset sales, or other resources not assessed here.',
        'Aggregate expense categories are not a validated essential-spending measure.',
        'No DOMINO intervention or outcome comparison exists in this dataset.',
        'FinMark access and license ambiguity is documented in provenance.md; local research analysis is permitted by the published terms.',
    ],
    'reproduce': ['python3 data/public/analyze_finmark_diaries.py', 'python3 data/public/analyze_finmark_cashflow.py'],
}
(ROOT/'finmark_cashflow_analysis.json').write_text(json.dumps(analysis, indent=2)+'\n')
md = f'''# Observed monthly income-expense gaps

Source: [India Financial Diaries, hosted by FinMark Trust](https://finmark.org.za/data-portal/IND/financial-diaries). Varanasi and outskirts, Uttar Pradesh, February to June 2013. Retrieved 17 September 2026. Nominal rupees. This sample is not nationally representative.

| Sample | Households with paired observations | Paired household-months | Months where income is below expense outflow | Households with at least one such month |
|---|---:|---:|---:|---:|
| All available paired observations | {all_stats['households_with_paired_observations']} | {all_stats['paired_household_months']} | {all_stats['income_below_expense_months']} / {all_stats['paired_household_months']} ({all_stats['income_below_expense_month_share_pct']:.2f}%) | {all_stats['households_with_at_least_one_observed_income_below_expense_month']} / {all_stats['households_with_paired_observations']} ({all_stats['household_share_with_at_least_one_observed_gap_pct']:.2f}%) |
| Households with all five paired months | {complete_stats['households_with_paired_observations']} | {complete_stats['paired_household_months']} | {complete_stats['income_below_expense_months']} / {complete_stats['paired_household_months']} ({complete_stats['income_below_expense_month_share_pct']:.2f}%) | {complete_stats['households_with_at_least_one_observed_income_below_expense_month']} / {complete_stats['households_with_paired_observations']} ({complete_stats['household_share_with_at_least_one_observed_gap_pct']:.2f}%) |

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
'''
assert '\u2014' not in md
(ROOT/'finmark_cashflow_analysis.md').write_text(md)
print(json.dumps({'all_available_paired_months':all_stats, 'complete_five_month_households':complete_stats}, indent=2))
