import { z } from 'zod';
export const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
export const moneyPaise = z
  .string()
  .regex(/^(0|[1-9]\d*)$/)
  .refine((v) => BigInt(v) <= 1_000_000_000_000n, 'Amount exceeds supported bound.');
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const date = new Date(`${v}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === v;
  }, 'Invalid calendar date.');
export const legacyScenario = z
  .object({
    incomeDelayWeeks: z.number().int().min(0).max(8).default(0),
    incomeReductionPct: z.number().int().min(0).max(100).default(0),
    expenseIncreasePct: z.number().int().min(0).max(100).default(0),
    minimumBufferPaise: z.number().int().min(0).max(1_000_000).default(150_000),
  })
  .strict();
export const candidateId = z.enum([
  'fixed',
  'income_aligned',
  'seasonal',
  'reduced',
  'robust_optimized',
]);
export const evaluateRequestV2 = z
  .object({
    loanVersion: z.number().int().positive(),
    policyVersionId: id,
    scenarioSetId: z.literal('required_v1'),
    requestedCandidates: z
      .array(candidateId)
      .min(1)
      .max(5)
      .refine((a) => new Set(a).size === a.length, 'Duplicate candidate.'),
    assumptions: z
      .object({
        minimumBufferPaise: moneyPaise,
        incomeDelayWeeks: z.number().int().min(0).max(8),
        incomeReductionBps: z.number().int().min(0).max(10000),
        expenseIncreaseBps: z.number().int().min(0).max(10000),
      })
      .strict(),
  })
  .strict();
export type EvaluateRequestV2 = z.infer<typeof evaluateRequestV2>;
export const selectionRequest = z
  .object({
    planId: candidateId,
    expectedLoanVersion: z.number().int().positive(),
    reason: z.string().trim().min(10).max(2000),
  })
  .strict();
export const approvalRequest = z
  .object({
    expectedLoanVersion: z.number().int().positive(),
    consentReference: z.string().trim().min(5).max(200),
    dailyReplayReference: z.string().trim().min(5).max(200),
  })
  .strict();
export const transactionRecord = z
  .object({
    sourceKey: z.string().min(1).max(200),
    date: dateOnly,
    amountPaise: moneyPaise,
    type: z.enum([
      'income',
      'essential_payable',
      'consumption',
      'repayment',
      'transfer',
      'disbursement',
      'refund',
      'reversal',
    ]),
    accountId: id,
    sourceRecordId: z.string().min(1).max(200),
    observation: z.enum(['observed', 'borrower_entered']),
    relatedSourceKey: z.string().max(200).optional(),
  })
  .strict()
  .superRefine((row, context) => {
    if (['refund', 'reversal'].includes(row.type) && !row.relatedSourceKey)
      context.addIssue({
        code: 'custom',
        path: ['relatedSourceKey'],
        message: 'Refunds and reversals must reference their original event.',
      });
  });
export const importRequest = z
  .object({
    borrowerId: id,
    sourceId: id,
    consentReference: z.string().min(5).max(200),
    currency: z.literal('INR'),
    records: z.array(transactionRecord).min(1).max(1000),
  })
  .strict();
export type ImportedTransaction = z.infer<typeof transactionRecord>;
export const policySchema = z
  .object({
    id,
    minimumBufferPaise: moneyPaise,
    maximumInstallmentPaise: moneyPaise,
    maximumInterestPaise: moneyPaise,
    additionalInterestBudgetPaise: moneyPaise,
    maximumTermWeeks: z.number().int().min(1).max(104),
    allowedPaymentWeeks: z.array(z.number().int().min(1).max(104)).min(1).max(104),
    essentialTreatment: z.enum(['payable', 'nonrecoverable']),
    allowOverdueRescheduling: z.literal(false),
  })
  .strict();
export type Policy = z.infer<typeof policySchema>;
export const operationalSnapshot = z
  .object({
    borrowerId: id,
    loanVersion: z.number().int().positive(),
    currency: z.literal('INR'),
    sourceKind: z.enum(['fixture', 'borrower_observation']),
    consentReference: z.string().min(5).max(200),
    cutoffDate: dateOnly,
    openingCashPaise: moneyPaise,
    openingPrincipalPaise: moneyPaise,
    openingPrincipalArrearsPaise: moneyPaise,
    openingInterestPaise: moneyPaise,
    openingDueInterestPaise: moneyPaise,
    openingEssentialArrearsPaise: moneyPaise,
    aprBps: z.number().int().min(0).max(10000),
    startDate: dateOnly,
    termWeeks: z.number().int().min(1).max(104),
    weeklyEssentialsPaise: moneyPaise,
    history: z
      .array(
        z
          .object({
            date: dateOnly,
            incomePaise: moneyPaise.nullable(),
            essentialsPaise: moneyPaise.nullable(),
            observed: z.boolean(),
          })
          .strict(),
      )
      .min(13)
      .max(520),
    sourceIds: z.array(id).min(1).max(50),
  })
  .strict()
  .superRefine((s, c) => {
    if (BigInt(s.openingPrincipalArrearsPaise) > BigInt(s.openingPrincipalPaise))
      c.addIssue({
        code: 'custom',
        message: 'Principal arrears must be a subset of outstanding principal.',
      });
    if (BigInt(s.openingDueInterestPaise) > BigInt(s.openingInterestPaise))
      c.addIssue({ code: 'custom', message: 'Due interest must be a subset of unpaid interest.' });
    if (s.cutoffDate >= s.startDate)
      c.addIssue({ code: 'custom', message: 'Cutoff must precede the projected schedule.' });
    if (
      s.history.some((r, i) => r.date > s.cutoffDate || (i > 0 && r.date <= s.history[i - 1]!.date))
    )
      c.addIssue({
        code: 'custom',
        message: 'History must be strictly ordered and precede the cutoff.',
      });
  });
export type OperationalSnapshot = z.infer<typeof operationalSnapshot>;
