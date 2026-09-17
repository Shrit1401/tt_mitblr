import type { Borrower } from './types.js';
export const addWeeks = (date: string, weeks: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
};
const seasonalIncome = (w: number) =>
  [9, 10, 11, 12, 22, 23, 24, 25].includes(w % 26) ? 5700 : 650;
function fixture(
  id: string,
  name: string,
  occupation: string,
  pattern: string,
  essentials: number,
  income: (w: number) => number,
): Borrower {
  return {
    id,
    name,
    occupation,
    pattern,
    synthetic: true,
    openingCashPaise: 600000,
    weeklyEssentialsPaise: essentials * 100,
    loan: { principalPaise: 2400000, aprBps: 1800, termWeeks: 26, startDate: '2026-09-14' },
    history: Array.from({ length: 104 }, (_, w) => ({
      date: addWeeks('2024-09-16', w),
      incomePaise: Math.round(income(w) * 100),
      essentialsPaise: essentials * 100,
      // Prior lending observations, not payments against the new simulated loan.
      repaymentPaise: Math.round(Math.max(0, Math.min(400, income(w) - essentials)) * 100),
    })),
  };
}
export const borrowers: Borrower[] = [
  fixture(
    'farmer',
    'Rani Devi',
    'Seasonal crop farmer',
    'Two harvest cycles per year',
    1000,
    seasonalIncome,
  ),
  fixture(
    'vendor',
    'Meera Shah',
    'Market vendor',
    'Uneven weekly receipts',
    1400,
    (w) => [1000, 3600, 800, 5000, 2600, 1900, 4800][w % 7]!,
  ),
  fixture('tailor', 'Asha Rao', 'Tailoring business', 'Persistent decline in orders', 1500, (w) =>
    w < 78 ? 3400 + (w % 3) * 100 : Math.max(850, 3200 - (w - 78) * 100),
  ),
];
