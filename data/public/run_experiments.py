#!/usr/bin/env python3
"""Run the public evidence experiments. Never imports or executes application code.

The complete run requires the locally retained source files described in provenance.md.
Third-party PDFs and household-level records are intentionally excluded from Git.
Use --published-only to check the distributed aggregate tables without these inputs.
"""
from __future__ import annotations

import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import platform
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent


def read_json(name):
    return json.loads((ROOT / name).read_text())


def read_csv(name):
    with (ROOT / name).open(newline="") as handle:
        return list(csv.DictReader(handle))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--published-only", action="store_true",
                        help="Check published aggregate files, skip source-dependent experiments.")
    parser.add_argument("--output", type=Path,
                        help="Write the execution record to a chosen path.")
    args = parser.parse_args()
    results = []
    source_hashes = {}

    def record(identifier, title, measurements, status="passed"):
        results.append({"id": identifier, "title": title, "status": status,
                        "measurements": measurements})

    def run_source_script(filename):
        # Fixed filenames from this directory only. No backend or frontend imports.
        completed = subprocess.run([sys.executable, str(ROOT / filename)],
                                   cwd=ROOT.parent.parent, capture_output=True,
                                   text=True, check=True)
        return json.loads(completed.stdout)

    if not args.published_only:
        needed = ["raw/nabard-nafis-2021-22.pdf", "raw/sidbi-microfinance-pulse-27.pdf",
                  "raw/finmark-household-transactions.json", "raw/finmark-request-url.txt"]
        missing = [name for name in needed if not (ROOT / name).is_file()]
        if missing:
            parser.error("Local research inputs are missing: " + ", ".join(missing)
                         + ". See data/public/provenance.md. Use --published-only for aggregate checks.")
        if not shutil.which("pdftotext"):
            parser.error("Poppler pdftotext is required for local PDF extraction.")
        pinned = {row["file"]: row for row in read_json("raw_checksums.json")}
        for name in needed:
            actual = sha256(ROOT / name)
            require(name in pinned and actual == pinned[name]["sha256"],
                    "Pinned source checksum mismatch: " + name)
            source_hashes[name] = actual
        record("R01", "Pinned source integrity", {"source_files_verified": len(needed)})

        extraction = run_source_script("analyze_public_data.py")
        record("R02", "Published PDF table extraction", extraction)
        diaries = run_source_script("analyze_finmark_diaries.py")
        record("R03", "Monthly diary normalization", diaries)
        gaps = run_source_script("analyze_finmark_cashflow.py")
        record("R04", "Observed paired-month income-expense comparison",
               gaps["all_available_paired_months"])
        record("R05", "Complete five-month household sensitivity",
               gaps["complete_five_month_households"])

        rows = read_csv("finmark_india_household_months.csv")
        households = {row["household_id"] for row in rows}
        months = {f"2013-{month:02d}-01" for month in range(2, 7)}
        require(all(row["month"] in months for row in rows), "Unexpected diary month")
        require(len({(r["household_id"], r["month"]) for r in rows}) == len(rows),
                "Duplicate household-month record")
        paired = [r for r in rows if r["observed_income"] == "True" and r["observed_expense"] == "True"]
        paired_per_household = Counter(r["household_id"] for r in paired)
        coverage = {
            "households": len(households), "months_in_window": len(months),
            "possible_household_months": len(households) * len(months),
            "observed_household_months": len(rows), "paired_household_months": len(paired),
            "absent_both_categories": len(households) * len(months) - len(rows),
            "income_only_months": sum(r["observed_income"] == "True" and r["observed_expense"] == "False" for r in rows),
            "expense_only_months": sum(r["observed_expense"] == "True" and r["observed_income"] == "False" for r in rows),
            "households_by_paired_month_count": {
                str(count): sum(paired_per_household[hid] == count for hid in households)
                for count in range(6)
            },
            "missing_values_imputed": 0, "weekly_values_created": 0,
        }
        for row in rows:
            require((row["income_inr"] != "") == (row["observed_income"] == "True"),
                    "Income missingness flag disagrees with value")
            require((row["expense_signed_inr"] != "") == (row["observed_expense"] == "True"),
                    "Expense missingness flag disagrees with value")
        record("R06", "Missing-observation coverage", coverage)

        nonnegative = [r for r in paired if Decimal(r["income_inr"]) >= 0]
        nonnegative_gaps = sum(Decimal(r["income_inr"]) < Decimal(r["consumption_outflow_inr"])
                               for r in nonnegative)
        record("R07", "Negative-income sensitivity", {
            "primary_analysis_retains_negative_income": True,
            "negative_income_months": len(paired) - len(nonnegative),
            "sensitivity_paired_months_excluding_negative_income": len(nonnegative),
            "sensitivity_gap_months_excluding_negative_income": nonnegative_gaps,
            "sensitivity_gap_share_pct": round(nonnegative_gaps / len(nonnegative) * 100, 4),
            "interpretation": "Diagnostic subset only. Exclusion changes the population and is not a correction to source data.",
        })

        by_month = []
        for month in sorted(months):
            sample = [r for r in paired if r["month"] == month]
            below = sum(Decimal(r["income_inr"]) < Decimal(r["consumption_outflow_inr"]) for r in sample)
            by_month.append({"month": month, "paired_household_months": len(sample),
                             "income_below_expense_months": below,
                             "gap_share_pct": round(below / len(sample) * 100, 4)})
        require(sum(r["paired_household_months"] for r in by_month) == len(paired),
                "Monthly denominators do not reconcile")
        require(sum(r["income_below_expense_months"] for r in by_month) == gaps["all_available_paired_months"]["income_below_expense_months"],
                "Monthly gap counts do not reconcile")
        record("R08", "Monthly variation with explicit denominators", {"months": by_month})
    else:
        for identifier, title in [("R01", "Pinned source integrity"), ("R02", "Published PDF table extraction"),
                                  ("R03", "Monthly diary normalization"), ("R04", "Observed paired-month comparison"),
                                  ("R05", "Complete five-month sensitivity"), ("R06", "Missing-observation coverage"),
                                  ("R07", "Negative-income sensitivity"), ("R08", "Monthly variation")]:
            record(identifier, title, {"reason": "Source-dependent experiment explicitly excluded by --published-only."}, "skipped")

    states = read_csv("nafis_state_household_averages.csv")
    groups = read_csv("nafis_household_groups.csv")
    market = read_csv("sidbi_sector_snapshot.csv")
    require(len(states) == 31 and len(groups) == 3 and len(market) == 2,
            "Published table row counts changed")
    for row in states + groups:
        require(int(row["avg_monthly_income_inr"]) - int(row["avg_monthly_consumption_inr"])
                == int(row["income_minus_consumption_inr"]), "Published mean difference mismatch")
    summary = read_json("public_evidence_summary.json")
    india = next(r for r in states if r["geography"] == "INDIA")
    require(len({r["geography"] for r in states}) == len(states), "Duplicate published geography")
    require(len({r["household_group"] for r in groups}) == len(groups), "Duplicate household group")
    require(int(india["avg_monthly_income_inr"]) == summary["nafis"]["all_households_monthly_income_inr"]
            and int(india["avg_monthly_consumption_inr"]) == summary["nafis"]["all_households_monthly_consumption_inr"],
            "India income/consumption summary mismatch")
    require(int(india["income_minus_consumption_inr"]) == summary["nafis"]["difference_of_means_inr"],
            "India summary mismatch")
    require(sum(int(r["income_minus_consumption_inr"]) < 1000 for r in states if r["geography"] != "INDIA")
            == summary["nafis"]["states_or_uts_with_mean_gap_below_1000_inr"], "Regional count mismatch")
    market_by_metric = {r["metric"]: r for r in market}
    require(len(market_by_metric) == len(market), "Duplicate sector metric")
    borrowers = market_by_metric["unique_live_microfinance_borrowers"]
    portfolio = market_by_metric["live_microfinance_portfolio_outstanding"]
    require(int(borrowers["value"]) == summary["market"]["unique_live_microfinance_borrowers_approx"]
            and borrowers["precision"] == "approximate" and borrowers["unit"] == "people",
            "Sector borrower value, unit, or precision mismatch")
    require(int(portfolio["value"]) == 277053 and portfolio["unit"] == "INR crore"
            and portfolio["precision"] == "reported", "Sector portfolio value, unit, or precision mismatch")
    require(all(r["as_of"] == summary["market"]["as_of"] for r in market), "Sector reference period mismatch")
    require(summary["is_borrower_history"] is False and summary["is_domino_impact_measurement"] is False,
            "Public aggregates must remain separate from borrower observations and product outcomes")
    record("R09", "Published aggregate consistency", {
        "table_rows_checked": len(states) + len(groups) + len(market),
        "income_minus_consumption_inr": int(india["income_minus_consumption_inr"]),
        "mean_difference_as_share_of_mean_income_pct": summary["nafis"]["difference_share_of_mean_income_pct"],
        "product_impact_measurement": False,
    })

    report = {
        "run_at_utc": datetime.now(timezone.utc).isoformat(),
        "scope": "Offline public evidence analysis only",
        "python_version": platform.python_version(),
        "source_reference_periods": ["NAFIS 2021-22", "Microfinance Pulse as of 2026-03-31", "India Financial Diaries February-June 2013"],
        "backend_executed": False, "backend_tested": False,
        "mode": "published-only" if args.published_only else "local-source-reproduction",
        "passed": sum(r["status"] == "passed" for r in results),
        "skipped": sum(r["status"] == "skipped" for r in results),
        "source_sha256": source_hashes, "experiments": results,
        "unexecuted_backend_experiments": [
            "API validation and tenant isolation", "Cash/debt ledger invariant checks and parity",
            "Forecast rolling-origin backtests", "Required/diagnostic scenario replay",
            "Optimizer exhaustive enumeration, timeout and rounding comparisons",
            "Queue retry, worker crash and database tests", "Backend latency and throughput benchmarks",
            "Approval, consent and servicing integration tests",
        ],
        "limitations": [
            "Public evidence results are not measurements of DOMINO's effectiveness or backend correctness.",
            "Historical diaries are monthly and not nationally representative; loan status and repayment outcomes are unverified.",
            "Published-only mode checks distributed aggregates without reproducing source extraction.",
        ],
    }
    output = args.output or ROOT / ("published-check-results.json" if args.published_only else "experiment-results.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"passed": report["passed"], "skipped": report["skipped"],
                      "backend_executed": False, "result_file": str(output)}, indent=2))


if __name__ == "__main__":
    main()
