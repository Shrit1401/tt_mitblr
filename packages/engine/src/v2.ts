import type { EvaluateRequestV2, OperationalSnapshot, Policy } from '@domino/contracts';
import { checked, halfUp, maxMoney, minMoney, money, weeklyInterest } from './money.js';
export const ENGINE_VERSION = '0.2.0-unverified';
export type CandidateId = EvaluateRequestV2['requestedCandidates'][number];
export interface ScenarioPath {
  id: string;
  required: boolean;
  method: string;
  incomePaise: string[];
  essentialsPaise: string[];
}
export interface Due {
  week: number;
  date: string;
  principalDuePaise: string;
}
export interface LedgerV2 {
  week: number;
  date: string;
  openingCashPaise: string;
  incomePaise: string;
  newEssentialsPaise: string;
  essentialsPaidPaise: string;
  essentialArrearsPaise: string;
  unmetConsumptionPaise: string;
  interestAccruedPaise: string;
  interestPaidPaise: string;
  principalPaidPaise: string;
  repaymentDuePaise: string;
  repaymentPaidPaise: string;
  closingCashPaise: string;
  principalPaise: string;
  interestPaise: string;
  principalArrearsPaise: string;
  dueInterestPaise: string;
  stress: boolean;
}
export interface Replay {
  scenarioId: string;
  required: boolean;
  feasible: boolean;
  violations: string[];
  ledger: LedgerV2[];
  metrics: {
    interestPaidPaise: string;
    remainingDebtPaise: string;
    essentialArrearsPaise: string;
    unmetConsumptionPaise: string;
    minimumCashPaise: string;
    maximumInstallmentPaise: string;
    arrearsWeeks: number;
    stressWeeks: number;
    payoffDate: string | null;
  };
}
export interface Candidate {
  id: CandidateId;
  schedule: Due[];
  feasible: boolean;
  scenarios: Replay[];
}
export interface SolverMetadata {
  status:
    | 'NOT_REQUESTED'
    | 'UNAVAILABLE'
    | 'UNKNOWN'
    | 'INFEASIBLE'
    | 'MODEL_INVALID'
    | 'FEASIBLE'
    | 'OPTIMAL';
  optimalityProved: boolean;
  stages?: unknown[];
  interestReference?: {
    paise: string;
    kind: 'proven_minimum' | 'best_found';
    additionalBudgetPaise: string;
    possiblePremiumAboveOptimumPaise: number;
  };
  reason?: string;
}
export const dateAtWeek = (start: string, index: number) => {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 7 * index);
  return date.toISOString().slice(0, 10);
};
function forecastIncome(snapshot: OperationalSnapshot): bigint[] {
  const history = snapshot.history;
  if (history.at(-1)?.date !== dateAtWeek(snapshot.startDate, -1))
    throw new Error('INSUFFICIENT_DATA');
  if (
    history.some(
      (r, i) =>
        !r.observed ||
        r.incomePaise === null ||
        r.essentialsPaise === null ||
        (i > 0 && r.date !== dateAtWeek(history[i - 1]!.date, 1)),
    )
  )
    throw new Error('INSUFFICIENT_DATA');
  const values = history.map((r) => money(r.incomePaise!));
  const recent = values.slice(-13).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const median = recent[Math.floor(recent.length / 2)]!;
  return Array.from({ length: snapshot.termWeeks }, (_, i) =>
    values.length >= 104
      ? halfUp(values[values.length - 52 + (i % 52)]! + values[values.length - 104 + (i % 52)]!, 2n)
      : median,
  );
}
export function scenarioPaths(
  snapshot: OperationalSnapshot,
  request: EvaluateRequestV2,
): ScenarioPath[] {
  const forecast = forecastIncome(snapshot),
    essentials = money(snapshot.weeklyEssentialsPaise);
  const make = (
    id: string,
    required: boolean,
    delay: number,
    reduction: number,
    increase: number,
  ): ScenarioPath => ({
    id,
    required,
    method: 'Deterministic timing and amount transformation; no probability interpretation.',
    incomePaise: forecast.map((_, i) =>
      i < delay
        ? '0'
        : checked(halfUp(forecast[i - delay]! * BigInt(10000 - reduction), 10000n)).toString(),
    ),
    essentialsPaise: forecast.map(() =>
      checked(halfUp(essentials * BigInt(10000 + increase), 10000n)).toString(),
    ),
  });
  return [
    make('baseline', true, 0, 0, 0),
    make(
      'policy_stress',
      true,
      Math.max(2, request.assumptions.incomeDelayWeeks),
      Math.max(1500, request.assumptions.incomeReductionBps),
      Math.max(1000, request.assumptions.expenseIncreaseBps),
    ),
    make('zero_income', false, 0, 10000, 0),
  ];
}
function baselineSchedule(
  snapshot: OperationalSnapshot,
  policy: Policy,
  id: CandidateId,
  forecast: string[],
): Due[] {
  const allowed = new Set(policy.allowedPaymentWeeks);
  const weights = Array.from({ length: snapshot.termWeeks }, (_, i) => {
    if (!allowed.has(i + 1)) return 0n;
    if (id === 'income_aligned')
      return (i + 1) % 4 === 0 || i === snapshot.termWeeks - 1 ? 100n : 0n;
    if (id === 'seasonal')
      return maxMoney(0n, money(forecast[i]!) - money(snapshot.weeklyEssentialsPaise));
    if (id === 'reduced') return i < 6 ? 20n : 100n;
    return 100n;
  });
  if (weights.every((w) => w === 0n))
    for (let i = 0; i < weights.length; i++) weights[i] = allowed.has(i + 1) ? 1n : 0n;
  const totalWeight = weights.reduce((sum, w) => sum + w, 0n);
  if (totalWeight === 0n) throw new Error('Policy has no payment dates in the loan term.');
  const futurePrincipal =
    money(snapshot.openingPrincipalPaise) - money(snapshot.openingPrincipalArrearsPaise);
  let cumulativeWeight = 0n,
    previous = 0n;
  return weights.map((w, i) => {
    cumulativeWeight += w;
    const due = halfUp(futurePrincipal * cumulativeWeight, totalWeight);
    const principalDuePaise = due - previous;
    previous = due;
    return {
      week: i + 1,
      date: dateAtWeek(snapshot.startDate, i),
      principalDuePaise: principalDuePaise.toString(),
    };
  });
}
export function replay(
  snapshot: OperationalSnapshot,
  policy: Policy,
  dues: Due[],
  path: ScenarioPath,
): Replay {
  if (
    dues.length !== snapshot.termWeeks ||
    path.incomePaise.length !== dues.length ||
    path.essentialsPaise.length !== dues.length
  )
    throw new Error('Invalid horizon.');
  if (dues.some((d, i) => d.week !== i + 1 || d.date !== dateAtWeek(snapshot.startDate, i)))
    throw new Error('Invalid schedule calendar.');
  const allocated = dues.reduce(
    (sum, due) => sum + money(due.principalDuePaise),
    money(snapshot.openingPrincipalArrearsPaise),
  );
  if (allocated !== money(snapshot.openingPrincipalPaise))
    throw new Error('Principal schedule does not reconcile.');
  let cash = money(snapshot.openingCashPaise),
    principal = money(snapshot.openingPrincipalPaise),
    interest = money(snapshot.openingInterestPaise),
    duePrincipal = money(snapshot.openingPrincipalArrearsPaise),
    dueInterest = money(snapshot.openingDueInterestPaise),
    essentialArrears = money(snapshot.openingEssentialArrearsPaise),
    unmet = 0n,
    totalInterestPaid = 0n;
  const buffer = money(policy.minimumBufferPaise),
    collectionCap = money(policy.maximumInstallmentPaise);
  const ledger: LedgerV2[] = [],
    violations = new Set<string>();
  if (cash < buffer) violations.add('OPENING_BUFFER_BELOW_POLICY');
  if (snapshot.termWeeks > policy.maximumTermWeeks) violations.add('TERM_EXCEEDS_POLICY');
  for (const [i, due] of dues.entries()) {
    const openingCash = cash,
      openingPrincipal = principal,
      openingInterest = interest,
      openingEssentialArrears = essentialArrears;
    const newEssentials = money(path.essentialsPaise[i]!),
      income = money(path.incomePaise[i]!);
    const accrual = weeklyInterest(principal, snapshot.aprBps);
    interest = checked(interest + accrual);
    duePrincipal = checked(duePrincipal + money(due.principalDuePaise));
    const paymentDate = BigInt(due.principalDuePaise) > 0n || i === dues.length - 1;
    if (BigInt(due.principalDuePaise) > 0n && !policy.allowedPaymentWeeks.includes(i + 1))
      violations.add('DISALLOWED_PAYMENT_DATE');
    if (paymentDate) dueInterest = interest;
    cash = checked(cash + income);
    const liability = checked(essentialArrears + newEssentials),
      essentialsPaid = minMoney(cash, liability);
    cash -= essentialsPaid;
    const unpaid = liability - essentialsPaid;
    if (policy.essentialTreatment === 'payable') essentialArrears = unpaid;
    else {
      essentialArrears = maxMoney(0n, openingEssentialArrears - essentialsPaid);
      unmet = checked(unmet + unpaid - essentialArrears);
    }
    const repaymentDue = checked(duePrincipal + dueInterest);
    // Overdue principal and already due interest remain payable even between new installment dates.
    const payment = minMoney(collectionCap, minMoney(repaymentDue, maxMoney(0n, cash - buffer)));
    const interestPaid = minMoney(dueInterest, payment),
      principalPaid = payment - interestPaid;
    principal = checked(principal - principalPaid);
    interest = checked(interest - interestPaid);
    duePrincipal = checked(duePrincipal - principalPaid);
    dueInterest = checked(dueInterest - interestPaid);
    cash -= payment;
    totalInterestPaid = checked(totalInterestPaid + interestPaid);
    if (
      cash !== openingCash + income - essentialsPaid - payment ||
      principal !== openingPrincipal - principalPaid ||
      interest !== openingInterest + accrual - interestPaid ||
      (policy.essentialTreatment === 'payable' &&
        essentialArrears !== openingEssentialArrears + newEssentials - essentialsPaid) ||
      duePrincipal > principal ||
      dueInterest > interest
    )
      throw new Error('Accounting invariant failed.');
    const stress = cash < buffer || duePrincipal > 0n || dueInterest > 0n || unpaid > 0n;
    if (cash < buffer) violations.add('CASH_BUFFER');
    if (unpaid > 0n)
      violations.add(
        policy.essentialTreatment === 'payable' ? 'ESSENTIAL_ARREARS' : 'UNMET_CONSUMPTION',
      );
    if (duePrincipal + dueInterest > 0n) violations.add('PAYMENT_ARREARS');
    ledger.push({
      week: i + 1,
      date: due.date,
      openingCashPaise: openingCash.toString(),
      incomePaise: income.toString(),
      newEssentialsPaise: newEssentials.toString(),
      essentialsPaidPaise: essentialsPaid.toString(),
      essentialArrearsPaise: essentialArrears.toString(),
      unmetConsumptionPaise: unmet.toString(),
      interestAccruedPaise: accrual.toString(),
      interestPaidPaise: interestPaid.toString(),
      principalPaidPaise: principalPaid.toString(),
      repaymentDuePaise: repaymentDue.toString(),
      repaymentPaidPaise: payment.toString(),
      closingCashPaise: cash.toString(),
      principalPaise: principal.toString(),
      interestPaise: interest.toString(),
      principalArrearsPaise: duePrincipal.toString(),
      dueInterestPaise: dueInterest.toString(),
      stress,
    });
  }
  if (principal + interest > 0n) violations.add('MATURITY_DEBT');
  if (totalInterestPaid > money(policy.maximumInterestPaise)) violations.add('INTEREST_CAP');
  return {
    scenarioId: path.id,
    required: path.required,
    feasible: violations.size === 0,
    violations: [...violations],
    ledger,
    metrics: {
      interestPaidPaise: totalInterestPaid.toString(),
      remainingDebtPaise: (principal + interest).toString(),
      essentialArrearsPaise: essentialArrears.toString(),
      unmetConsumptionPaise: unmet.toString(),
      minimumCashPaise: ledger
        .reduce((v, r) => minMoney(v, BigInt(r.closingCashPaise)), money(snapshot.openingCashPaise))
        .toString(),
      maximumInstallmentPaise: ledger
        .reduce((v, r) => maxMoney(v, BigInt(r.repaymentPaidPaise)), 0n)
        .toString(),
      arrearsWeeks: ledger.filter(
        (r) => BigInt(r.principalArrearsPaise) + BigInt(r.dueInterestPaise) > 0n,
      ).length,
      stressWeeks: ledger.filter((r) => r.stress).length,
      payoffDate:
        ledger.find((r) => r.principalPaise === '0' && r.interestPaise === '0')?.date ?? null,
    },
  };
}
export function evaluateV2(
  snapshot: OperationalSnapshot,
  originalPolicy: Policy,
  request: EvaluateRequestV2,
  optimized?: { schedule: Due[]; metadata: SolverMetadata },
) {
  const policy = {
    ...originalPolicy,
    minimumBufferPaise: maxMoney(
      money(originalPolicy.minimumBufferPaise),
      money(request.assumptions.minimumBufferPaise),
    ).toString(),
  };
  const paths = scenarioPaths(snapshot, request);
  const candidates: Candidate[] = request.requestedCandidates
    .filter((id) => id !== 'robust_optimized')
    .map((id) => {
      const schedule = baselineSchedule(snapshot, policy, id, paths[0]!.incomePaise),
        scenarios = paths.map((path) => replay(snapshot, policy, schedule, path));
      return {
        id,
        schedule,
        scenarios,
        feasible: scenarios.filter((s) => s.required).every((s) => s.feasible),
      };
    });
  if (optimized) {
    const scenarios = paths.map((path) => replay(snapshot, policy, optimized.schedule, path));
    candidates.push({
      id: 'robust_optimized',
      schedule: optimized.schedule,
      scenarios,
      feasible: scenarios.filter((s) => s.required).every((s) => s.feasible),
    });
  }
  const requestedSolver = request.requestedCandidates.includes('robust_optimized');
  const solver: SolverMetadata = optimized?.metadata ?? {
    status: requestedSolver ? 'UNAVAILABLE' : 'NOT_REQUESTED',
    optimalityProved: false,
  };
  const feasible = candidates
    .filter((c) => c.feasible)
    .sort((a, b) => {
      const ai = BigInt(a.scenarios[0]!.metrics.interestPaidPaise),
        bi = BigInt(b.scenarios[0]!.metrics.interestPaidPaise);
      if (ai !== bi) return ai < bi ? -1 : 1;
      const am = BigInt(a.scenarios[0]!.metrics.maximumInstallmentPaise),
        bm = BigInt(b.scenarios[0]!.metrics.maximumInstallmentPaise);
      return am === bm ? 0 : am < bm ? -1 : 1;
    });
  const best = feasible[0];
  return {
    contractVersion: '2.0',
    engineVersion: ENGINE_VERSION,
    borrowerId: snapshot.borrowerId,
    loanVersion: snapshot.loanVersion,
    sourceKind: snapshot.sourceKind,
    sourceIds: snapshot.sourceIds,
    assumptions: {
      moneyUnit: 'integer paise as decimal strings',
      interest: 'Simple APR / 52, positive half-up weekly rounding, no compounding.',
      essentialTreatment: policy.essentialTreatment,
      forecast:
        snapshot.history.length >= 104
          ? 'Corresponding weeks from the previous two years.'
          : 'Rolling 13-week median; limited evidence.',
      scenarioMethod:
        'Two required deterministic scenarios and one diagnostic total income loss. Coverage is not a probability.',
      eventOrder: 'Income, essential liabilities, interest, principal. Weekly resolution only.',
      ranking:
        'Required feasibility, then lowest baseline-scenario interest, then smallest maximum payment. Stable candidate order resolves remaining ties.',
    },
    dataQuality: {
      status: snapshot.history.length >= 104 ? 'sufficient_for_demo' : 'limited_evidence',
      observedWeeks: snapshot.history.length,
    },
    policy,
    candidates,
    solver,
    recommendation: {
      status: best
        ? 'recommended'
        : requestedSolver
          ? 'search_incomplete'
          : 'no_feasible_candidate',
      planId: best?.id ?? null,
      reasons: best
        ? [
            'All required scenarios pass the independent weekly ledger.',
            'Borrower consent and verified daily replay are required before approval.',
          ]
        : [
            'No independently validated candidate meets every required constraint.',
            'This result does not prove that every possible schedule is infeasible.',
          ],
    },
  };
}
export type EvaluationV2 = ReturnType<typeof evaluateV2>;
