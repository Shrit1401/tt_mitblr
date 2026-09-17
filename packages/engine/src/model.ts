import { addWeeks } from './data.js';
import type {
  Assessment,
  Borrower,
  LedgerRow,
  PlanId,
  PlanResult,
  Scenario,
  ScheduleRow,
} from './types.js';
export const CONTRACT_VERSION = '1.0';
export const MODEL_VERSION = '0.1.0';
export const defaults: Scenario = {
  incomeDelayWeeks: 0,
  incomeReductionPct: 0,
  expenseIncreasePct: 0,
  minimumBufferPaise: 150000,
};
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
const mean = (v: number[]) => (v.length ? sum(v) / v.length : 0);
export function assess(b: Borrower): Assessment {
  const h = b.history;
  if (h.length < 104)
    return {
      classification: 'uncertain',
      summary:
        'Less than two years of observations. Evidence is insufficient to distinguish a recurring cycle from deterioration.',
      evidence: [],
    };
  const recent = h.slice(-13),
    previousYear = h.slice(-65, -52);
  const ratio =
    mean(recent.map((r) => r.incomePaise)) /
    Math.max(1, mean(previousYear.map((r) => r.incomePaise)));
  const recentBlocks = [0, 1, 2].map((i) => {
    const end = h.length - i * 4;
    return (
      mean(h.slice(end - 4, end).map((r) => r.incomePaise)) /
      Math.max(1, mean(h.slice(end - 56, end - 52).map((r) => r.incomePaise)))
    );
  });
  const a = h.slice(-104, -52).map((r) => r.incomePaise),
    c = h.slice(-52).map((r) => r.incomePaise);
  const ma = mean(a),
    mc = mean(c);
  const correlation =
    sum(a.map((v, i) => (v - ma) * (c[i]! - mc))) /
    Math.max(1, Math.sqrt(sum(a.map((v) => (v - ma) ** 2)) * sum(c.map((v) => (v - mc) ** 2))));
  const variability = Math.sqrt(mean(c.map((v) => (v - mc) ** 2))) / Math.max(1, mc);
  const classification =
    ratio < 0.75 && recentBlocks.every((v) => v < 0.8)
      ? 'sustained_decline'
      : correlation > 0.8 && variability > 0.3
        ? 'seasonal'
        : variability > 0.2
          ? 'irregular'
          : 'uncertain';
  const summaries = {
    sustained_decline:
      'Income is below the same period last year across three recent four-week windows. This supports a persistent decline flag; it does not establish the cause.',
    seasonal:
      'Low-income periods repeat in both observed years, followed by stronger receipts. The pattern supports seasonal timing pressure.',
    irregular:
      'Weekly receipts vary without a strong annual repeat. Review receipt timing and adverse scenarios with the borrower.',
    uncertain:
      'The observed pattern does not clearly support seasonality or persistent deterioration. Additional evidence is needed.',
  };
  return {
    classification,
    summary: summaries[classification],
    evidence: [
      {
        label: 'Recent income / same 13 weeks last year',
        value: Number(ratio.toFixed(3)),
        period: `${recent[0]!.date} to ${recent.at(-1)!.date}`,
      },
      {
        label: 'Annual weekly pattern correlation',
        value: Number(correlation.toFixed(3)),
        period: `${h[0]!.date} to ${h.at(-1)!.date}`,
      },
      {
        label: 'Recent four-week year-on-year ratios',
        value: recentBlocks.map((v) => v.toFixed(2)).join(', '),
        period: 'Latest 12 observed weeks',
      },
    ],
  };
}
export function forecast(b: Borrower): number[] {
  const h = b.history;
  const scale =
    assess(b).classification === 'sustained_decline'
      ? Math.min(
          1,
          mean(h.slice(-13).map((r) => r.incomePaise)) /
            Math.max(1, mean(h.slice(-65, -52).map((r) => r.incomePaise))),
        )
      : 1;
  return Array.from({ length: b.loan.termWeeks }, (_, w) => {
    const samples = [h[h.length - 52 + (w % 52)], h[h.length - 104 + (w % 52)]]
      .filter((r) => r !== undefined)
      .map((r) => r.incomePaise);
    return Math.round((samples.length ? mean(samples) : mean(h.map((r) => r.incomePaise))) * scale);
  });
}
export const names: Record<PlanId, string> = {
  fixed: 'Fixed weekly',
  income_aligned: 'Every four weeks',
  seasonal: 'Seasonal surplus',
  reduced: 'Six-week reduced start',
};
export function schedule(b: Borrower, id: PlanId, income: number[]): ScheduleRow[] {
  const weights = Array.from({ length: b.loan.termWeeks }, (_, w) => {
    if (id === 'income_aligned') return (w + 1) % 4 === 0 || w === b.loan.termWeeks - 1 ? 1 : 0;
    if (id === 'seasonal') return Math.max(0, income[w]! - b.weeklyEssentialsPaise);
    if (id === 'reduced') return w < 6 ? 0.2 : 1;
    return 1;
  });
  // An all-zero surplus cannot erase debt: evaluate equal dues instead.
  if (!sum(weights)) weights.fill(1);
  const total = sum(weights);
  let cumulativeWeight = 0,
    previouslyDue = 0;
  return weights.map((weight, w) => {
    cumulativeWeight += weight;
    const cumulativeDue =
      w === weights.length - 1
        ? b.loan.principalPaise
        : Math.round((b.loan.principalPaise * cumulativeWeight) / total);
    const principalDuePaise = cumulativeDue - previouslyDue;
    previouslyDue = cumulativeDue;
    return { week: w + 1, date: addWeeks(b.loan.startDate, w), principalDuePaise };
  });
}
export function simulate(b: Borrower, id: PlanId, scenario: Scenario): PlanResult {
  const baseline = forecast(b),
    dues = schedule(b, id, baseline);
  const adjusted = baseline.map((v) => Math.round((v * (100 - scenario.incomeReductionPct)) / 100));
  const expense = Math.round((b.weeklyEssentialsPaise * (100 + scenario.expenseIncreasePct)) / 100);
  let cash = b.openingCashPaise,
    principal = b.loan.principalPaise,
    interest = 0,
    dueInterest = 0,
    duePrincipal = 0;
  const ledger: LedgerRow[] = [];
  for (const row of dues) {
    const index = row.week - 1,
      openingCashPaise = cash;
    const incomePaise =
      index >= scenario.incomeDelayWeeks ? adjusted[index - scenario.incomeDelayWeeks]! : 0;
    const interestAccruedPaise = Math.round((principal * b.loan.aprBps) / 10000 / 52);
    interest += interestAccruedPaise;
    duePrincipal += row.principalDuePaise;
    if (row.principalDuePaise > 0) dueInterest = interest;
    cash += incomePaise;
    const essentialsPaidPaise = Math.min(cash, expense);
    cash -= essentialsPaidPaise;
    const unmetEssentialsPaise = expense - essentialsPaidPaise;
    const repaymentDuePaise = duePrincipal + dueInterest;
    const repaymentPaidPaise = Math.min(
      repaymentDuePaise,
      Math.max(0, cash - scenario.minimumBufferPaise),
    );
    const interestPaidPaise = Math.min(dueInterest, repaymentPaidPaise),
      principalPaidPaise = repaymentPaidPaise - interestPaidPaise;
    interest -= interestPaidPaise;
    dueInterest -= interestPaidPaise;
    duePrincipal -= principalPaidPaise;
    principal -= principalPaidPaise;
    cash -= repaymentPaidPaise;
    ledger.push({
      ...row,
      openingCashPaise,
      incomePaise,
      essentialsDuePaise: expense,
      essentialsPaidPaise,
      unmetEssentialsPaise,
      interestAccruedPaise,
      interestPaidPaise,
      principalPaidPaise,
      repaymentDuePaise,
      repaymentPaidPaise,
      closingCashPaise: cash,
      outstandingPrincipalPaise: principal,
      outstandingInterestPaise: interest,
      principalArrearsPaise: duePrincipal,
      dueInterestPaise: dueInterest,
      stress:
        unmetEssentialsPaise > 0 ||
        duePrincipal + dueInterest > 0 ||
        cash < scenario.minimumBufferPaise,
    });
  }
  return {
    id,
    name: names[id],
    schedule: dues,
    ledger,
    metrics: {
      totalPaidPaise: sum(ledger.map((r) => r.repaymentPaidPaise)),
      principalRecoveredPaise: b.loan.principalPaise - principal,
      interestAccruedPaise: sum(ledger.map((r) => r.interestAccruedPaise)),
      interestPaidPaise: sum(ledger.map((r) => r.interestPaidPaise)),
      remainingDebtPaise: principal + interest,
      unpaidEssentialsPaise: sum(ledger.map((r) => r.unmetEssentialsPaise)),
      arrearsWeeks: ledger.filter((r) => r.principalArrearsPaise + r.dueInterestPaise > 0).length,
      stressWeeks: ledger.filter((r) => r.stress).length,
      minimumClosingCashPaise: Math.min(...ledger.map((r) => r.closingCashPaise)),
      payoffDate:
        ledger.find((r) => r.outstandingPrincipalPaise + r.outstandingInterestPaise === 0)?.date ??
        null,
      incomeOutsideHorizonPaise: scenario.incomeDelayWeeks
        ? sum(adjusted.slice(-scenario.incomeDelayWeeks))
        : 0,
    },
  };
}
export function evaluate(b: Borrower, scenario: Scenario) {
  const plans = (Object.keys(names) as PlanId[]).map((id) => simulate(b, id, scenario));
  const feasible = plans.filter(
    (p) => p.metrics.remainingDebtPaise === 0 && p.metrics.stressWeeks === 0,
  );
  feasible.sort((a, c) => a.metrics.interestPaidPaise - c.metrics.interestPaidPaise);
  const best = feasible[0];
  return {
    contractVersion: CONTRACT_VERSION,
    modelVersion: MODEL_VERSION,
    synthetic: true,
    borrowerId: b.id,
    scenario,
    assumptions: {
      currency: 'INR',
      moneyUnit: 'paise',
      horizonWeeks: b.loan.termWeeks,
      aprBps: b.loan.aprBps,
      interest: 'Simple interest on opening principal, APR / 52, rounded weekly; no compounding.',
      paymentOrder:
        'Income, essentials, due interest, due principal; loan payments preserve the configured buffer.',
      schedule:
        'Baseline schedules stay fixed during stress testing. No extensions, fees, forgiveness, or penalty interest.',
      history:
        'Historical repayments are prior lending observations, not payments against the new simulated loan.',
      forecast:
        'Corresponding weeks from the prior two years; sustained decline scales by the recent year-on-year ratio.',
      limits:
        'Synthetic scenario estimates. No calibrated default probabilities. Not an automated lending decision.',
    },
    assessment: assess(b),
    plans,
    recommendation: {
      status: best ? 'recommended' : 'no_feasible_plan',
      planId: best?.id ?? null,
      reasons: best
        ? [
            `${best.name} repays principal and interest by maturity without arrears or unmet essentials in this scenario.`,
            'It has the lowest interest paid among evaluated feasible schedules. Ties use stable candidate order.',
            'Review historical evidence and adverse scenarios before a simulated plan selection.',
          ]
        : [
            'None of the four schedules repays the loan by maturity while preserving the buffer and avoiding arrears and unmet essentials.',
            'Review loan terms and income assumptions with the borrower. Remaining balances are shown for every plan.',
          ],
    },
  };
}

export type EvaluationResponse = ReturnType<typeof evaluate>;
