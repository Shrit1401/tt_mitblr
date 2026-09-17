import { createHash } from 'node:crypto';
import { transactionRecord, type ImportedTransaction } from '@domino/contracts';
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(',')}}`;
}
export const contentHash = (value: unknown) =>
  createHash('sha256').update(canonicalJson(value)).digest('hex');
export function normalizeTransactions(raw: unknown[]) {
  const records: ImportedTransaction[] = [],
    rejected: { row: number; code: string; fields: string[] }[] = [];
  const keys = new Set<string>();
  raw.forEach((value, i) => {
    const result = transactionRecord.safeParse(value);
    if (!result.success) {
      rejected.push({
        row: i + 1,
        code: 'INVALID_RECORD',
        fields: result.error.issues.map((issue) => issue.path.join('.')),
      });
      return;
    }
    if (keys.has(result.data.sourceKey)) {
      rejected.push({ row: i + 1, code: 'DUPLICATE_SOURCE_KEY', fields: ['sourceKey'] });
      return;
    }
    keys.add(result.data.sourceKey);
    records.push(result.data);
  });
  return {
    records: records.sort(
      (a, b) => a.date.localeCompare(b.date) || a.sourceKey.localeCompare(b.sourceKey),
    ),
    rejected,
  };
}
export function reconcileCash(
  openingPaise: string,
  closingPaise: string,
  events: { amountPaise: string; direction: 'in' | 'out' }[],
) {
  const derived = events.reduce(
    (sum, e) => sum + (e.direction === 'in' ? 1n : -1n) * BigInt(e.amountPaise),
    BigInt(openingPaise),
  );
  const difference = BigInt(closingPaise) - derived;
  return {
    status: difference === 0n ? 'reconciled' : 'unexplained_difference',
    derivedClosingPaise: derived.toString(),
    differencePaise: difference.toString(),
  };
}
export interface PublicContextRecord {
  sourceKind: 'public_aggregate';
  measure: string;
  value: string;
  unit: string;
  referencePeriod: string;
  population: string;
  sourceUrl: string;
  tableReference: string;
}
export interface MonthlyResearchRecord {
  sourceKind: 'public_microdata';
  frequency: 'monthly';
  householdId: string;
  month: string;
  incomeSignedInr: string | null;
  expenseSignedInr: string | null;
  sourceRecordId: string;
}
/** Research rows intentionally cannot satisfy the operational weekly snapshot contract. */
export function inspectMonthlyResearch(rows: MonthlyResearchRecord[]) {
  return {
    households: new Set(rows.map((r) => r.householdId)).size,
    rows: rows.length,
    paired: rows.filter((r) => r.incomeSignedInr !== null && r.expenseSignedInr !== null).length,
    negativeIncome: rows.filter((r) => r.incomeSignedInr !== null && Number(r.incomeSignedInr) < 0)
      .length,
    frequency: 'monthly',
    eligibleForOperationalEvaluation: false,
  };
}
