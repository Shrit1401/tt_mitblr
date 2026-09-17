#!/usr/bin/env python3
"""Tidy public household-month chart records. Do not infer missing observations."""
from pathlib import Path
from collections import Counter, defaultdict
import csv, hashlib, json
ROOT=Path(__file__).resolve().parent
raw=ROOT/'raw/finmark-household-transactions.json'
x=json.loads(raw.read_text())['data']
assert len(x)==172 and len({r['household_name'] for r in x})==86
long=[]
wide={}
for r in x:
    assert r['category_type'] in ['income','expense'] and r['category_name']=='ALL'
    for v in r['values']:
        assert v['date'].startswith('2013-')
        key=(r['household_name'],v['date'])
        row=wide.setdefault(key,{'household_id':key[0],'month':key[1],
            'income_inr':None,'expense_signed_inr':None,'consumption_outflow_inr':None,
            'income_plus_signed_expense_inr':None,'observed_income':False,'observed_expense':False})
        assert not row['observed_'+r['category_type']], (key,r['category_type'])
        if r['category_type']=='income':
            row['income_inr']=v['value']; row['observed_income']=True
        else:
            row['expense_signed_inr']=v['value']; row['consumption_outflow_inr']=-v['value']; row['observed_expense']=True
        long.append({'household_id':key[0],'month':key[1],'category':r['category_type'],
            'reported_signed_value_inr':v['value'],'source_series_id':r['id'],'source_value_id':v['id'],
            'source_id':'finmark_india_diaries_2013'})
for r in wide.values():
    if r['observed_income'] and r['observed_expense']:
        r['income_plus_signed_expense_inr']=r['income_inr']+r['expense_signed_inr']

def write(name,rows):
    with (ROOT/name).open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
long.sort(key=lambda r:(r['household_id'],r['month'],r['category']))
wide_rows=[wide[k] for k in sorted(wide)]
write('finmark_india_monthly_long.csv',long)
write('finmark_india_household_months.csv',wide_rows)
complete=Counter()
for r in wide_rows:
    if r['observed_income'] and r['observed_expense']: complete[r['household_id']]+=1
example=[r for r in wide_rows if r['household_id']=='LAH31']
assert len(example)==5 and all(r['observed_income'] and r['observed_expense'] for r in example)
write('finmark_example_LAH31_chart.csv',example)
summary={
    'retrieved_on':'2026-09-17','source_url':'https://finmark.org.za/data-portal/IND/financial-diaries',
    'api_url':(ROOT/'raw/finmark-request-url.txt').read_text().strip(),
    'source_sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),
    'study':'India Financial Diaries','geography':'Varanasi and outskirts, Uttar Pradesh, India',
    'period_start':'2013-02','period_end':'2013-06','currency':'INR nominal 2013',
    'frequency':'month','households_in_source':86,'individuals_reported_on_portal':376,
    'household_category_series':len(x),'income_month_observations':sum(r['category']=='income' for r in long),
    'expense_month_observations':sum(r['category']=='expense' for r in long),
    'household_month_rows':len(wide_rows),
    'months_with_income_and_expense':sum(r['observed_income'] and r['observed_expense'] for r in wide_rows),
    'households_with_all_five_paired_months':sum(v==5 for v in complete.values()),
    'negative_reported_income_months':sum(r['category']=='income' and r['reported_signed_value_inr']<0 for r in long),
    'missing_values_imputed':False,'weekly_values_created':False,'nationally_representative':False,
    'loan_borrower_status_verified':False,'domino_beneficiaries':None,
    'chart_example':{'household_id':'LAH31','selection':'First household returned by source API; illustrative case, not representative',
        'series':['income_inr','consumption_outflow_inr'],'source_csv':'finmark_example_LAH31_chart.csv',
        'title':'One household: income and expenses change by month',
        'subtitle':'Varanasi diary LAH31; INR per month; Feb-Jun 2013',
        'source_line':'Source: FinMark Trust, India Financial Diaries, household LAH31, Feb-Jun 2013. Published monthly observations; no DOMINO intervention.'},
    'limitations':['Five monthly values at most, not weekly records or 104-week histories.',
        'Incomplete reporting is retained as blank, not converted to zero.',
        'Negative income values are preserved; their category definitions need further review before lending use.',
        'No opening balance, essential-spending designation, verified debt schedule or default outcome is supplied by this selected endpoint.',
        'Do not describe the 86 households as current borrowers, DOMINO users, or beneficiaries.'],
}
(ROOT/'finmark_data_quality.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:summary[k] for k in ['households_in_source','income_month_observations','expense_month_observations','household_month_rows','months_with_income_and_expense','households_with_all_five_paired_months','negative_reported_income_months']},indent=2))
