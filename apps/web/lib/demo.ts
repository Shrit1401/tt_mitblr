import saved from './saved-evaluation.json';
import decline from './saved-decline.json';
import history from './saved-borrower.json';
export const evaluation = saved;
export const declineEvaluation = decline;
export const farmer = history.borrower;
export type Plan = (typeof saved.plans)[number] | (typeof decline.plans)[number];
export type View =
  | 'overview'
  | 'borrowers'
  | 'borrower'
  | 'comparison'
  | 'scenarios'
  | 'evidence'
  | 'decisions';
export const money = (paise: number, exact = false) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: exact ? 2 : 0,
    minimumFractionDigits: exact ? 2 : 0,
  }).format(paise / 100);
// Fixed labels avoid server/browser CLDR differences such as "Sept" versus "Sep".
const monthLabels = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
export const shortDate = (date: string) => {
  const [, month, day] = date.split('-');
  return `${Number(day)} ${monthLabels[Number(month) - 1]}`;
};
export const borrowers = [
  {
    id: 'farmer',
    name: 'Rani Devi',
    initials: 'RD',
    occupation: 'Seasonal crop farmer',
    place: 'Varanasi, Uttar Pradesh',
    pattern: 'Seasonal',
    status: 'Ready for review',
    color: 'green',
    description: 'Two recurring harvest cycles. Repayments can follow stronger receipt weeks.',
  },
  {
    id: 'vendor',
    name: 'Meera Shah',
    initials: 'MS',
    occupation: 'Market vendor',
    place: 'Pune, Maharashtra',
    pattern: 'Irregular',
    status: 'Awaiting evaluation',
    color: 'purple',
    description: 'Uneven weekly receipts. A new evaluation is needed before comparing plans.',
  },
  {
    id: 'tailor',
    name: 'Asha Rao',
    initials: 'AR',
    occupation: 'Tailoring business',
    place: 'Mysuru, Karnataka',
    pattern: 'Income decline',
    status: 'Needs attention',
    color: 'orange',
    description: 'Orders have declined over recent months. The saved example has no feasible plan.',
  },
];
export const planDescription: Record<string, string> = {
  fixed: 'The same principal amount, every week.',
  income_aligned: 'Principal installments every four weeks.',
  seasonal: 'Larger installments in surplus weeks.',
  reduced: 'A gentler start for the first six weeks.',
};
export const sourceLinks = [
  {
    id: 'fixtures',
    name: 'DOMINO demonstration fixtures',
    type: 'Synthetic',
    publisher: 'NueraRangers',
    period: 'Sep 2024 to Mar 2027',
    detail:
      'Three generated borrower profiles. Saved v1 examples illustrate the interface; they are not new evaluations or real borrower outcomes.',
    href: 'https://github.com/Shrit1401/tt_mitblr/tree/main/apps/web/lib',
  },
  {
    id: 'finmark',
    name: 'India Financial Diaries',
    type: 'Research',
    publisher: 'FinMark Trust',
    period: 'February to June 2013',
    detail:
      '86 households, 365 household-month rows and 356 paired observations. Historical Varanasi research, not nationally representative; monthly records cannot be treated as weekly borrower cash flow.',
    href: 'https://finmark.org.za/data-portal/IND/financial-diaries',
  },
  {
    id: 'nabard',
    name: 'NAFIS 2021–22',
    type: 'Public context',
    publisher: 'NABARD',
    period: 'Survey reference: 2021–22',
    detail:
      'Published average monthly household income of ₹12,698 and consumption of ₹11,262. Population averages are context, not an installment limit.',
    href: 'https://www.nabard.org/auth/writereaddata/tender/2102255939NAFIS%202021-22%20Report%20Final.pdf',
  },
  {
    id: 'sidbi',
    name: 'Microfinance Pulse XXVII',
    type: 'Public context',
    publisher: 'SIDBI & Equifax',
    period: 'As of 31 March 2026',
    detail:
      'Approximately 5.5 crore unique live borrowers. A dated sector estimate, not DOMINO users or beneficiaries.',
    href: 'https://www.sidbi.in/head/uploads/microfinancepulse_documents/MFI-Pulse-Report-27th-Edition.pdf',
  },
];
export type Decision = {
  id: string;
  borrowerId: string;
  borrower: string;
  planId: string;
  plan: string;
  reason: string;
  consent: string;
  state: 'Draft' | 'Reviewed';
  createdAt: string;
};
export type ScenarioDraft = {
  id: string;
  name: string;
  delay: number;
  reduction: number;
  expenses: number;
  buffer: number;
  kind: 'Required' | 'Diagnostic';
};
export const presets: ScenarioDraft[] = [
  {
    id: 'baseline',
    name: 'Baseline cash flow',
    delay: 0,
    reduction: 0,
    expenses: 0,
    buffer: 1500,
    kind: 'Required',
  },
  {
    id: 'late-income',
    name: 'A later harvest',
    delay: 2,
    reduction: 0,
    expenses: 0,
    buffer: 1500,
    kind: 'Required',
  },
  {
    id: 'household-pressure',
    name: 'Household pressure',
    delay: 0,
    reduction: 15,
    expenses: 10,
    buffer: 1500,
    kind: 'Required',
  },
  {
    id: 'income-loss',
    name: 'Income interruption',
    delay: 0,
    reduction: 100,
    expenses: 0,
    buffer: 1500,
    kind: 'Diagnostic',
  },
];
export function download(name: string, data: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Browser drafts are untrusted input. Recover only bounded, known fields. */
export function restoreDecisions(value: unknown): Decision[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const d = item as Record<string, unknown>;
    const plan = evaluation.plans.find((p) => p.id === d.planId);
    if (
      d.borrowerId !== 'farmer' ||
      !plan ||
      plan.id !== 'seasonal' ||
      typeof d.id !== 'string' ||
      d.id.length > 80 ||
      typeof d.reason !== 'string' ||
      d.reason.trim().length < 12 ||
      d.reason.length > 2000 ||
      typeof d.consent !== 'string' ||
      d.consent.length > 100 ||
      (d.state !== 'Draft' && d.state !== 'Reviewed') ||
      typeof d.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(d.createdAt))
    )
      return [];
    return [
      {
        id: d.id,
        borrowerId: 'farmer',
        borrower: 'Rani Devi',
        planId: plan.id,
        plan: plan.name,
        reason: d.reason,
        consent: d.consent,
        state: d.state,
        createdAt: d.createdAt,
      },
    ];
  });
}
export function restoreScenarios(value: unknown): ScenarioDraft[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const d = item as Record<string, unknown>;
    if (
      typeof d.id !== 'string' ||
      d.id.length > 80 ||
      typeof d.name !== 'string' ||
      d.name.length > 100 ||
      (d.kind !== 'Required' && d.kind !== 'Diagnostic')
    )
      return [];
    for (const [key, max, step] of [
      ['delay', 8, 1],
      ['reduction', 100, 5],
      ['expenses', 50, 5],
      ['buffer', 6000, 100],
    ] as const) {
      if (
        typeof d[key] !== 'number' ||
        !Number.isInteger(d[key]) ||
        d[key] < 0 ||
        d[key] > max ||
        d[key] % step !== 0
      )
        return [];
    }
    return [
      {
        id: d.id,
        name: d.name,
        delay: d.delay as number,
        reduction: d.reduction as number,
        expenses: d.expenses as number,
        buffer: d.buffer as number,
        kind: d.kind,
      },
    ];
  });
}
