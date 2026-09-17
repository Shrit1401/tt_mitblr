import { describe, it, expect } from 'vitest';
import { borrowers } from '../src/data.js';
import { assess, defaults, evaluate, forecast, names, schedule, simulate } from '../src/model.js';
import type { PlanId } from '../src/types.js';
const ids = Object.keys(names) as PlanId[];
describe('cash-flow accounting', () => {
  it('matches a hand-calculated first weekly payment', () => {
    const first = simulate(borrowers[0]!, 'fixed', defaults).ledger[0]!;
    expect(first.interestAccruedPaise).toBe(8308);
    expect(first.principalPaidPaise).toBe(92308);
    expect(first.repaymentPaidPaise).toBe(100616);
    expect(first.closingCashPaise).toBe(464384);
    expect(first.outstandingPrincipalPaise).toBe(2307692);
  });
  it('reconciles cash, debt, interest, and scheduled principal in 162 scenarios across all four plans', () => {
    for (const b of borrowers) for (const delay of [0, 4, 8]) for (const reduction of [0, 40, 100]) for (const expenses of [0, 100]) for (const buffer of [0, 150000, 1000000]) {
      for (const id of ids) {
        const config = { incomeDelayWeeks: delay, incomeReductionPct: reduction, expenseIncreasePct: expenses, minimumBufferPaise: buffer };
        const p = simulate(b, id, config);
        expect(p.schedule.reduce((s, r) => s + r.principalDuePaise, 0)).toBe(b.loan.principalPaise);
        let principal = b.loan.principalPaise, interest = 0, cash = b.openingCashPaise;
        for (const r of p.ledger) {
          expect(r.openingCashPaise).toBe(cash);
          expect(r.closingCashPaise).toBe(cash + r.incomePaise - r.essentialsPaidPaise - r.repaymentPaidPaise);
          expect(r.outstandingPrincipalPaise).toBe(principal - r.principalPaidPaise);
          expect(r.outstandingInterestPaise).toBe(interest + r.interestAccruedPaise - r.interestPaidPaise);
          expect(r.interestAccruedPaise).toBe(Math.round(principal * b.loan.aprBps / 10000 / 52));
          expect(r.repaymentPaidPaise).toBe(r.principalPaidPaise + r.interestPaidPaise);
          expect(r.repaymentPaidPaise).toBeLessThanOrEqual(r.repaymentDuePaise);
          expect(r.essentialsPaidPaise + r.unmetEssentialsPaise).toBe(r.essentialsDuePaise);
          expect(r.principalArrearsPaise).toBeLessThanOrEqual(r.outstandingPrincipalPaise);
          expect(r.dueInterestPaise).toBeLessThanOrEqual(r.outstandingInterestPaise);
          if (r.repaymentPaidPaise > 0) expect(r.closingCashPaise).toBeGreaterThanOrEqual(buffer);
          for (const [k, v] of Object.entries(r)) if (k.endsWith('Paise')) { expect(Number.isSafeInteger(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); }
          principal = r.outstandingPrincipalPaise; interest = r.outstandingInterestPaise; cash = r.closingCashPaise;
        }
        expect(p.metrics.remainingDebtPaise).toBe(b.loan.principalPaise + p.metrics.interestAccruedPaise - p.metrics.totalPaidPaise);
        expect(p.ledger.reduce((s, r) => s + r.incomePaise, 0) + p.metrics.incomeOutsideHorizonPaise)
          .toBe(forecast(b).reduce((s, v) => s + Math.round(v * (100 - reduction) / 100), 0));
      }
    }
  });
  it('preserves baseline schedules under stress and carries unpaid debt', () => {
    const b = borrowers[0]!;
    for (const id of ids) {
      const base = simulate(b, id, defaults), stressed = simulate(b, id, { ...defaults, incomeReductionPct: 100 });
      expect(stressed.schedule).toEqual(base.schedule);
      expect(stressed.metrics.remainingDebtPaise).toBeGreaterThan(0);
      expect(stressed.metrics.payoffDate).toBeNull();
    }
  });
  it('does not collect deferred interest before a scheduled payment', () => {
    const p = simulate(borrowers[0]!, 'seasonal', defaults);
    expect(p.ledger[0]!.interestAccruedPaise).toBeGreaterThan(0);
    expect(p.ledger[0]!.repaymentPaidPaise).toBe(0);
    expect(p.ledger[0]!.dueInterestPaise).toBe(0);
    const first = p.schedule.findIndex(r => r.principalDuePaise > 0);
    expect(p.ledger[first]!.interestPaidPaise).toBe(p.ledger.slice(0, first + 1).reduce((s, r) => s + r.interestAccruedPaise, 0));
  });
  it('uses a debt-preserving fallback when no forecast surplus exists', () => {
    const b = borrowers[0]!;
    expect(schedule(b, 'seasonal', Array(26).fill(0)).reduce((s, r) => s + r.principalDuePaise, 0)).toBe(b.loan.principalPaise);
  });
});
describe('evidence and recommendation', () => {
  it('distinguishes seasonal, irregular, declining, and insufficient histories', () => {
    expect(borrowers.map(b => assess(b).classification)).toEqual(['seasonal', 'irregular', 'sustained_decline']);
    expect(assess({ ...borrowers[0]!, history: borrowers[0]!.history.slice(-12) }).classification).toBe('uncertain');
  });
  it('does not infer permanent deterioration from a single missed repayment', () => {
    const b = structuredClone(borrowers[0]!); b.history.at(-1)!.repaymentPaise = 0;
    expect(assess(b).classification).toBe('seasonal');
  });
  it('recommends a feasible farmer plan and refuses a zero-income scenario', () => {
    const normal = evaluate(borrowers[0]!, defaults);
    expect(normal.recommendation.status).toBe('recommended');
    const selected = normal.plans.find(p => p.id === normal.recommendation.planId)!;
    expect(selected.metrics.stressWeeks).toBe(0);
    expect(selected.metrics.remainingDebtPaise).toBe(0);
    const none = evaluate(borrowers[0]!, { ...defaults, incomeReductionPct: 100 });
    expect(none.recommendation).toMatchObject({ status: 'no_feasible_plan', planId: null });
    expect(evaluate(borrowers[2]!, defaults).recommendation.planId).toBeNull();
  });
});
