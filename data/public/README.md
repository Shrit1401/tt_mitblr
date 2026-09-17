# Public research evidence

This folder contains analysis code, attributed aggregate facts, and reproducible research summaries. It contains no measured DOMINO outcomes. The [experiment report](../../docs/research-experiments.md) explains the nine completed local experiments and the backend work deliberately left unexecuted.

| File | Purpose |
|---|---|
| `run_experiments.py` | Runs the public evidence experiment register without application imports |
| `experiment-results.json` | Completed local source run: 9 passed, 0 skipped |
| `published-check-results.json` | Public checkout check: 1 passed, 8 source-dependent experiments skipped |
| `analyze_public_data.py` | Extracts selected published facts from local NABARD and SIDBI PDFs |
| `analyze_finmark_diaries.py` | Normalizes locally held historical monthly observations |
| `analyze_finmark_cashflow.py` | Computes descriptive paired-month and complete-household comparisons |
| `nafis_*.csv`, `sidbi_sector_snapshot.csv` | Attributed aggregate facts with units and source references |
| `public_evidence_summary.json` | Public-context metadata and chart guidance |
| `finmark_data_quality.json`, `finmark_cashflow_analysis.*` | Aggregate counts, transformations, limitations, and provenance |
| `provenance.md`, `raw_checksums.json` | Primary sources, access notes, definitions, and pinned source hashes |

Check the public files after cloning:

```sh
python3 data/public/run_experiments.py --published-only
```

Reproduce the complete research run after obtaining the local inputs described in [provenance.md](provenance.md), with Poppler `pdftotext` available:

```sh
python3 data/public/run_experiments.py
```

The complete command fails clearly if local source inputs are absent or their hashes differ. It never downloads source material automatically. The partial command reports skipped source-dependent experiments explicitly.

`raw/`, `finmark_india_household_months.csv`, `finmark_india_monthly_long.csv`, and `finmark_example_LAH31_chart.csv` are local research inputs/outputs excluded from distribution. FinMark publication terms have an ambiguity documented in the provenance file; SIDBI's full report also carries redistribution restrictions. Source links and limited attributed aggregate findings are retained. All amounts retain the reference year's nominal INR units.
