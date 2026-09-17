#!/usr/bin/env python3
"""Reproduce selected aggregate evidence from downloaded primary reports.
Requires Poppler's pdftotext. No borrower cashflow records are generated.
"""
from pathlib import Path
import csv
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parent
RAW = ROOT / 'raw'
SOURCES = {
    'nabard_nafis_2021_22': 'https://www.nabard.org/auth/writereaddata/tender/2102255939NAFIS%202021-22%20Report%20Final.pdf',
    'sidbi_pulse_27': 'https://www.sidbi.in/head/uploads/microfinancepulse_documents/MFI-Pulse-Report-27th-Edition.pdf',
}
for stem in ['nabard-nafis-2021-22', 'sidbi-microfinance-pulse-27']:
    subprocess.run(['pdftotext', '-layout', str(RAW / (stem+'.pdf')), str(RAW / (stem+'.txt'))], check=True)
nafis = (RAW / 'nabard-nafis-2021-22.txt').read_text()
sidbi = (RAW / 'sidbi-microfinance-pulse-27.txt').read_text()

def write_csv(filename, rows):
    with (ROOT / filename).open('w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

# Restrict extraction to the actual Table 5.2, excluding its contents-page title.
start = nafis.index('Table 5.2 State-wise Average Monthly Income', nafis.index('5.2                         HOUSEHOLD INCOME'))
end = nafis.index('Base = All Households', start)
state_rows = []
for line in nafis[start:end].splitlines():
    m = re.match(r'^\s*([A-Za-z&(). ]+?)\s{2,}([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$', line)
    if not m:
        continue
    state, income, consumption, published_gap = m.groups()
    if state.strip() in ['1', 'States']:
        continue
    income, consumption, published_gap = [int(x.replace(',', '')) for x in [income, consumption, published_gap]]
    if income < 1000:
        continue
    assert income - consumption == published_gap, (state, income, consumption, published_gap)
    state_rows.append({
        'geography': state.strip(),
        'survey': 'NAFIS 2021-22',
        'population_scope': 'All households in covered Tier-3 to Tier-6 centres',
        'avg_monthly_income_inr': income,
        'avg_monthly_consumption_inr': consumption,
        'income_minus_consumption_inr': published_gap,
        'gap_share_of_mean_income_pct': round(100*published_gap/income, 3),
        'source_id': 'nabard_nafis_2021_22',
        'source_table': '5.2',
        'source_printed_pages': '45-46',
    })
assert len(state_rows) == 31, len(state_rows)
assert state_rows[0]['geography'] == 'INDIA'
assert state_rows[0]['avg_monthly_income_inr'] == 12698
assert state_rows[0]['avg_monthly_consumption_inr'] == 11262
write_csv('nafis_state_household_averages.csv', state_rows)

cohort_rows = []
for label, income, consumption in [
    ('All households', 12698, 11262),
    ('Agricultural households', 13661, 11710),
    ('Non-agricultural households', 11438, 10675),
]:
    assert f'{income:,}' in nafis and f'{consumption:,}' in nafis
    cohort_rows.append({
        'household_group': label,
        'avg_monthly_income_inr': income,
        'avg_monthly_consumption_inr': consumption,
        'income_minus_consumption_inr': income-consumption,
        'source_id': 'nabard_nafis_2021_22',
        'source_table': '5.1',
        'source_printed_page': 45,
        'source_pdf_page_1_based': 93,
    })
write_csv('nafis_household_groups.csv', cohort_rows)

# Selected reported facts. 5.5 crore is approximate; it is not the sum of lender clients.
assert '5.5 crore unique live borrowers' in sidbi
assert '2,77,053' in sidbi
market = [{
    'geography':'India', 'as_of':'2026-03-31',
    'metric':'unique_live_microfinance_borrowers', 'value':55000000,
    'unit':'people', 'precision':'approximate',
    'definition':'Live accounts: 0 to 179 DPD plus new/current accounts; unique across lenders',
    'source_id':'sidbi_pulse_27', 'source_printed_pages':'4;8',
}, {
    'geography':'India', 'as_of':'2026-03-31',
    'metric':'live_microfinance_portfolio_outstanding', 'value':277053,
    'unit':'INR crore', 'precision':'reported',
    'definition':'Live portfolio, per report bureau coverage',
    'source_id':'sidbi_pulse_27', 'source_printed_pages':'4;8',
}]
write_csv('sidbi_sector_snapshot.csv', market)

summary = {
    'retrieved_on': '2026-09-17',
    'data_kind': 'Published aggregate survey and bureau statistics',
    'is_borrower_history': False,
    'is_domino_impact_measurement': False,
    'nafis': {
        'sample_households':100000, 'states':28, 'union_territories':2,
        'districts':710, 'villages_or_census_enumeration_blocks':10000,
        'state_or_ut_rows':30, 'india_aggregate_rows':1,
        'all_households_monthly_income_inr':12698,
        'all_households_monthly_consumption_inr':11262,
        'difference_of_means_inr':1436,
        'difference_share_of_mean_income_pct':round(1436/12698*100,3),
        'households_with_outstanding_debt_pct':52,
        'states_or_uts_with_mean_gap_below_1000_inr':sum(r['income_minus_consumption_inr']<1000 for r in state_rows[1:]),
        'source':SOURCES['nabard_nafis_2021_22'],
    },
    'market': {
        'unique_live_microfinance_borrowers_approx':55000000,
        'as_of':'2026-03-31', 'source':SOURCES['sidbi_pulse_27'],
        'interpretation':'Sector scale, not DOMINO users, beneficiaries, customers, or attainable market share',
    },
    'impact': {'verified_domino_beneficiaries':None, 'explanation':'No field outcome or partner deployment evidence supplied'},
    'chart': {
        'recommended_type':'Grouped horizontal bar chart',
        'title':'Income and consumption per household',
        'subtitle':'Survey averages, rupees per month; NAFIS 2021-22',
        'data_csv':'nafis_household_groups.csv',
        'footer':'Source: NABARD, NAFIS 2021-22, Table 5.1, p.45. Published survey averages, not borrower cashflows.',
        'note':'If showing a gap, label it income minus consumption. It is not a disposable-income or repayment-capacity estimate.',
    },
    'sources':SOURCES,
}
(ROOT/'public_evidence_summary.json').write_text(json.dumps(summary,indent=2)+'\n')
checksums=[]
for f in sorted(RAW.iterdir()):
    if f.is_file():
        checksums.append({'file':str(f.relative_to(ROOT)), 'bytes':f.stat().st_size, 'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(ROOT/'raw_checksums.json').write_text(json.dumps(checksums,indent=2)+'\n')
print(json.dumps({'state_rows':len(state_rows), 'groups':len(cohort_rows), 'gap':1436, 'gap_below_1000_state_rows':summary['nafis']['states_or_uts_with_mean_gap_below_1000_inr'], 'sector_unique_live_borrowers_approx':55000000},indent=2))
