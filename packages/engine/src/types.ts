export interface HistoryRow {
  date: string;
  incomePaise: number;
  essentialsPaise: number;
  repaymentPaise: number;
}
export interface Borrower {
  id: string;
  name: string;
  occupation: string;
  pattern: string;
  synthetic: true;
  openingCashPaise: number;
  weeklyEssentialsPaise: number;
  loan: { principalPaise: number; aprBps: number; termWeeks: number; startDate: string };
  history: HistoryRow[];
}
export interface Scenario {
  incomeDelayWeeks: number;
  incomeReductionPct: number;
  expenseIncreasePct: number;
  minimumBufferPaise: number;
}
export interface Assessment {
  classification: 'seasonal' | 'irregular' | 'sustained_decline' | 'uncertain';
  summary: string;
  evidence: { label: string; value: number | string; period: string }[];
}
export type PlanId = 'fixed' | 'income_aligned' | 'seasonal' | 'reduced';
export interface ScheduleRow {
  week: number;
  date: string;
  principalDuePaise: number;
}
export interface LedgerRow {
  week: number;
  date: string;
  openingCashPaise: number;
  incomePaise: number;
  essentialsDuePaise: number;
  essentialsPaidPaise: number;
  unmetEssentialsPaise: number;
  interestAccruedPaise: number;
  interestPaidPaise: number;
  principalPaidPaise: number;
  repaymentDuePaise: number;
  repaymentPaidPaise: number;
  closingCashPaise: number;
  outstandingPrincipalPaise: number;
  outstandingInterestPaise: number;
  principalArrearsPaise: number;
  dueInterestPaise: number;
  stress: boolean;
}
export interface PlanResult {
  id: PlanId;
  name: string;
  schedule: ScheduleRow[];
  ledger: LedgerRow[];
  metrics: {
    totalPaidPaise: number;
    principalRecoveredPaise: number;
    interestAccruedPaise: number;
    interestPaidPaise: number;
    remainingDebtPaise: number;
    unpaidEssentialsPaise: number;
    arrearsWeeks: number;
    stressWeeks: number;
    minimumClosingCashPaise: number;
    payoffDate: string | null;
    incomeOutsideHorizonPaise: number;
  };
}
